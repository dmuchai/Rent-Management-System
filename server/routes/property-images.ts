import { Router } from "express";
import { isAuthenticated, supabase } from "../supabaseAuth";
import {
  PROPERTY_IMAGE_BUCKET,
  PROPERTY_IMAGE_EXTENSIONS,
  PROPERTY_IMAGE_MAX_BYTES,
  PROPERTY_IMAGE_SIGNED_URL_TTL_SECONDS,
  decodePropertyImageReference,
  isValidPropertyImageObjectInfo,
  isValidPropertyImageSignature,
  newPropertyImagePath,
  propertyImageReference,
} from "../../shared/private-property-image";
import { requirePropertyOwnership } from "../middleware/ownership";

const router = Router();

function isOwnedImagePath(path: string, userId: string, propertyId: string): boolean {
  if (!path.startsWith(`${userId}/${propertyId}/`)) return false;
  try {
    return Boolean(decodePropertyImageReference(propertyImageReference(path), propertyId));
  } catch {
    return false;
  }
}

async function canCaretakerViewProperty(userId: string, ownerId: string, propertyId: string): Promise<boolean> {
  const { data: assignments, error } = await supabase.from("caretaker_assignments")
    .select("property_id, unit_id")
    .eq("caretaker_id", userId)
    .eq("landlord_id", ownerId)
    .eq("status", "active");
  if (error) throw error;
  if (assignments?.some((assignment: any) => assignment.property_id === propertyId)) return true;
  const unitIds = (assignments || []).map((assignment: any) => assignment.unit_id).filter(Boolean);
  if (!unitIds.length) return false;
  const { data: units, error: unitsError } = await supabase.from("units")
    .select("id").in("id", unitIds).eq("property_id", propertyId).limit(1);
  if (unitsError) throw unitsError;
  return Boolean(units?.length);
}

router.get("/", isAuthenticated, async (req: any, res: any) => {
  const propertyId = typeof req.query.propertyId === "string" ? req.query.propertyId : "";
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(propertyId)) return res.status(400).json({ message: "Invalid property ID" });
  const { data: property } = await supabase.from("properties").select("id, owner_id, image_url").eq("id", propertyId).maybeSingle();
  if (!property) return res.status(404).json({ message: "Image unavailable" });
  const tenant = req.user.appRole === "tenant" && req.user.contextOwnerId === property.owner_id
    ? await supabase.from("leases").select("id, units!inner(property_id), tenants!inner(user_id)").eq("units.property_id", propertyId).eq("tenants.user_id", req.user.sub).eq("status", "active").limit(1)
    : { data: [] };
  const canManage = (req.user.appRole === "landlord" && req.user.sub === property.owner_id)
    || (req.user.appRole === "property_manager" && req.user.contextOwnerId === property.owner_id);
  const caretakerAccess = req.user.appRole === "caretaker"
    && req.user.contextOwnerId === property.owner_id
    && await canCaretakerViewProperty(req.user.sub, property.owner_id, propertyId);
  if (!canManage && !caretakerAccess && !tenant.data?.length) {
    return res.status(404).json({ message: "Image unavailable" });
  }
  const path = decodePropertyImageReference(property.image_url, propertyId);
  if (!path) return res.status(404).json({ message: "Image unavailable" });
  const { data, error } = await supabase.storage.from(PROPERTY_IMAGE_BUCKET)
    .createSignedUrl(path, PROPERTY_IMAGE_SIGNED_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) return res.status(404).json({ message: "Image unavailable" });
  const signed = new URL(data.signedUrl);
  const storageOrigin = new URL(process.env.SUPABASE_URL!).origin;
  if (signed.origin !== storageOrigin
    || !signed.pathname.startsWith(`/storage/v1/object/sign/${PROPERTY_IMAGE_BUCKET}/`)) {
    return res.status(502).json({ message: "Invalid storage response" });
  }
  res.setHeader("Cache-Control", "private, no-store, max-age=0");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Content-Type-Options", "nosniff");
  return res.redirect(302, data.signedUrl);
});

router.post("/:propertyId", isAuthenticated, requirePropertyOwnership, async (req: any, res: any) => {
  const propertyId = req.params.propertyId;
  if (typeof propertyId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(propertyId)) return res.status(400).json({ message: "Invalid property ID" });
  const contentType = typeof req.body?.contentType === "string" ? req.body.contentType : "";
  if (req.body?.action === "prepare") {
    if (!PROPERTY_IMAGE_EXTENSIONS[contentType]
      || !Number.isInteger(req.body?.size)
      || req.body.size <= 0
      || req.body.size > PROPERTY_IMAGE_MAX_BYTES) {
      return res.status(400).json({ message: "Invalid property image size or type" });
    }
    const path = newPropertyImagePath(req.user.sub, propertyId, contentType);
    const { data, error } = await supabase.storage.from(PROPERTY_IMAGE_BUCKET).createSignedUploadUrl(path);
    if (error || !data?.token) return res.status(502).json({ message: "Property image upload preparation failed" });
    return res.status(200).json({ path, token: data.token });
  }
  const path = typeof req.body?.path === "string" ? req.body.path : "";
  if (req.body?.action !== "complete" || !isOwnedImagePath(path, req.user.sub, propertyId)) return res.status(400).json({ message: "Invalid property image" });
  const { data: objectInfo, error: objectInfoError } = await supabase.storage
    .from(PROPERTY_IMAGE_BUCKET).info(path);
  if (objectInfoError || !objectInfo || !isValidPropertyImageObjectInfo(path, objectInfo)) {
    await supabase.storage.from(PROPERTY_IMAGE_BUCKET).remove([path]);
    return res.status(400).json({ message: "Uploaded property image is missing or invalid" });
  }
  const { data: objectBlob, error: objectDownloadError } = await supabase.storage
    .from(PROPERTY_IMAGE_BUCKET).download(path);
  const signatureBytes = objectBlob
    ? new Uint8Array(await objectBlob.slice(0, 12).arrayBuffer())
    : new Uint8Array();
  if (objectDownloadError || !isValidPropertyImageSignature(path, signatureBytes)) {
    await supabase.storage.from(PROPERTY_IMAGE_BUCKET).remove([path]);
    return res.status(400).json({ message: "Uploaded property image content is invalid" });
  }
  const reference = propertyImageReference(path);
  const { data: currentProperty, error: currentError } = await supabase.from("properties")
    .select("owner_id, image_url").eq("id", propertyId).single();
  if (currentError || !currentProperty || currentProperty.owner_id !== req.user.contextOwnerId) {
    await supabase.storage.from(PROPERTY_IMAGE_BUCKET).remove([path]);
    return res.status(403).json({ message: "Access denied" });
  }
  const previousPath = decodePropertyImageReference(currentProperty.image_url, propertyId);
  const update = supabase.from("properties")
    .update({ image_url: reference, updated_at: new Date().toISOString() })
    .eq("id", propertyId)
    .eq("owner_id", currentProperty.owner_id);
  const { data: updated, error: updateError } = currentProperty.image_url === null
    ? await update.is("image_url", null).select("id")
    : await update.eq("image_url", currentProperty.image_url).select("id");
  if (updateError || !updated?.length) {
    await supabase.storage.from(PROPERTY_IMAGE_BUCKET).remove([path]);
    return res.status(500).json({ message: "Property image attachment failed" });
  }
  if (previousPath && previousPath !== path) {
    const { error: cleanupError } = await supabase.storage.from(PROPERTY_IMAGE_BUCKET).remove([previousPath]);
    if (cleanupError) console.error("Previous property image cleanup failed", cleanupError.message);
  }
  return res.status(201).json({ imageUrl: `/api/property-images?propertyId=${encodeURIComponent(propertyId)}` });
});

router.delete("/:propertyId", isAuthenticated, requirePropertyOwnership, async (req: any, res: any) => {
  const path = typeof req.body?.path === "string" ? req.body.path : "";
  if (!isOwnedImagePath(path, req.user.sub, req.params.propertyId)) {
    return res.status(400).json({ message: "Invalid property image path" });
  }
  const { data: property } = await supabase.from("properties").select("image_url")
    .eq("id", req.params.propertyId).single();
  if (decodePropertyImageReference(property?.image_url, req.params.propertyId) === path) {
    return res.status(409).json({ message: "Referenced property image cannot be deleted" });
  }
  const { error } = await supabase.storage.from(PROPERTY_IMAGE_BUCKET).remove([path]);
  if (error) return res.status(502).json({ message: "Property image cleanup failed" });
  return res.status(204).end();
});

export default router;
