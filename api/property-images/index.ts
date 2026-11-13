import type { VercelRequest, VercelResponse } from "@vercel/node";
import { requireAuth, supabaseAdmin, type TrustedAuth } from "../_lib/auth.js";
import { createDbConnection } from "../_lib/db.js";
import {
  PROPERTY_IMAGE_BUCKET,
  PROPERTY_IMAGE_MAX_BYTES,
  PROPERTY_IMAGE_SIGNED_URL_TTL_SECONDS,
  PROPERTY_IMAGE_EXTENSIONS,
  decodePropertyImageReference,
  isValidPropertyImageObjectInfo,
  isValidPropertyImageSignature,
  newPropertyImagePath,
  propertyImageContentTypeForPath,
  propertyImageReference,
} from "../../shared/private-property-image.js";

function canManageProperty(auth: TrustedAuth, ownerId: string): boolean {
  return (auth.role === "landlord" && auth.userId === ownerId && auth.contextOwnerId === ownerId)
    || (auth.role === "property_manager" && auth.contextOwnerId === ownerId);
}

function isOwnedImagePath(path: string, userId: string, propertyId: string): boolean {
  if (!path.startsWith(`${userId}/${propertyId}/`)) return false;
  try {
    return Boolean(decodePropertyImageReference(propertyImageReference(path), propertyId));
  } catch {
    return false;
  }
}

class InvalidUploadedImageError extends Error {}

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const sql = createDbConnection();
  try {
    const propertyId = typeof req.query.propertyId === "string" ? req.query.propertyId : "";
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(propertyId)) {
      return res.status(400).json({ message: "Invalid property ID" });
    }

    const [property] = await sql`
      SELECT id, owner_id, image_url FROM public.properties WHERE id = ${propertyId}
    `;
    if (!property) return res.status(404).json({ message: "Image unavailable" });

    if (req.method === "GET") {
      const caretakerAccess = auth.role === "caretaker" && auth.contextOwnerId === property.owner_id ? await sql`
        SELECT 1
        FROM public.caretaker_assignments ca
        LEFT JOIN public.units assigned_unit ON assigned_unit.id = ca.unit_id
        WHERE ca.caretaker_id = ${auth.userId}
          AND ca.landlord_id = ${property.owner_id}
          AND ca.status = 'active'
          AND (ca.property_id = ${propertyId} OR assigned_unit.property_id = ${propertyId})
        LIMIT 1
      ` : [];
      const tenantAccess = auth.role === "tenant" && auth.contextOwnerId === property.owner_id ? await sql`
        SELECT 1
        FROM public.leases l
        JOIN public.units u ON u.id = l.unit_id
        JOIN public.tenants t ON t.id = l.tenant_id
        WHERE u.property_id = ${propertyId}
          AND t.user_id = ${auth.userId}
          AND l.status = 'active'
        LIMIT 1
      ` : [];
      if (!canManageProperty(auth, property.owner_id)
        && caretakerAccess.length === 0
        && tenantAccess.length === 0) {
        return res.status(404).json({ message: "Image unavailable" });
      }
      const path = decodePropertyImageReference(property.image_url, propertyId);
      if (!path) return res.status(404).json({ message: "Image unavailable" });
      const { data, error } = await supabaseAdmin.storage.from(PROPERTY_IMAGE_BUCKET)
        .createSignedUrl(path, PROPERTY_IMAGE_SIGNED_URL_TTL_SECONDS);
      if (error || !data?.signedUrl) return res.status(404).json({ message: "Image unavailable" });
      const signed = new URL(data.signedUrl);
      const storageOrigin = new URL(process.env.SUPABASE_URL!).origin;
      if (signed.origin !== storageOrigin
        || !signed.pathname.startsWith(`/storage/v1/object/sign/${PROPERTY_IMAGE_BUCKET}/`)) {
        return res.status(502).json({ message: "Invalid storage response" });
      }
      const expectedContentType = propertyImageContentTypeForPath(path);
      const imageResponse = await fetch(data.signedUrl, {
        redirect: "error",
        signal: AbortSignal.timeout(10_000),
      });
      const receivedContentType = imageResponse.headers.get("content-type")?.split(";", 1)[0].toLowerCase();
      const contentLength = Number(imageResponse.headers.get("content-length"));
      if (!imageResponse.ok
        || !expectedContentType
        || receivedContentType !== expectedContentType
        || (Number.isFinite(contentLength) && contentLength > PROPERTY_IMAGE_MAX_BYTES)) {
        return res.status(502).json({ message: "Image read failed" });
      }
      const imageBytes = Buffer.from(await imageResponse.arrayBuffer());
      if (imageBytes.length === 0 || imageBytes.length > PROPERTY_IMAGE_MAX_BYTES
        || !isValidPropertyImageSignature(path, imageBytes.subarray(0, 12))) {
        return res.status(502).json({ message: "Image read failed" });
      }
      res.setHeader("Cache-Control", "private, no-store, max-age=0");
      res.setHeader("Referrer-Policy", "no-referrer");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Content-Type", expectedContentType);
      res.setHeader("Content-Length", String(imageBytes.length));
      return res.status(200).send(imageBytes);
    }

    if (req.method === "DELETE") {
      if (!canManageProperty(auth, property.owner_id)) {
        return res.status(403).json({ message: "Access denied" });
      }
      const path = typeof req.body?.path === "string" ? req.body.path : "";
      if (!isOwnedImagePath(path, auth.userId, propertyId)) {
        return res.status(400).json({ message: "Invalid property image path" });
      }
      let cleanupConflict = false;
      let cleanupFailed = false;
      await sql.begin(async (tx) => {
        const [lockedProperty] = await tx`
          SELECT owner_id, image_url FROM public.properties WHERE id = ${propertyId} FOR UPDATE
        `;
        if (!lockedProperty || !canManageProperty(auth, lockedProperty.owner_id)) {
          cleanupConflict = true;
          return;
        }
        if (decodePropertyImageReference(lockedProperty.image_url, propertyId) === path) {
          cleanupConflict = true;
          return;
        }
        const { error: removeError } = await supabaseAdmin.storage.from(PROPERTY_IMAGE_BUCKET).remove([path]);
        cleanupFailed = Boolean(removeError);
      });
      if (cleanupConflict) return res.status(409).json({ message: "Referenced property image cannot be deleted" });
      if (cleanupFailed) return res.status(502).json({ message: "Property image cleanup failed" });
      return res.status(204).end();
    }
    if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });
    if (!canManageProperty(auth, property.owner_id)) return res.status(403).json({ message: "Access denied" });

    const body = req.body as { action?: unknown; contentType?: unknown; path?: unknown; size?: unknown };
    const contentType = typeof body?.contentType === "string" ? body.contentType : "";
    if (body?.action === "prepare") {
      if (!PROPERTY_IMAGE_EXTENSIONS[contentType]
        || typeof body.size !== "number"
        || !Number.isInteger(body.size)
        || body.size <= 0
        || body.size > PROPERTY_IMAGE_MAX_BYTES) {
        return res.status(400).json({ message: "Invalid property image size or type" });
      }
      const path = newPropertyImagePath(auth.userId, propertyId, contentType);
      const { data, error } = await supabaseAdmin.storage.from(PROPERTY_IMAGE_BUCKET).createSignedUploadUrl(path);
      if (error || !data?.token) return res.status(502).json({ message: "Property image upload preparation failed" });
      return res.status(200).json({ path, token: data.token });
    }
    if (body?.action !== "complete" || typeof body.path !== "string") {
      return res.status(400).json({ message: "Invalid property image" });
    }
    const path = body.path;
    if (!isOwnedImagePath(path, auth.userId, propertyId)) {
      return res.status(403).json({ message: "Invalid property image path" });
    }
    const reference = propertyImageReference(path);
    try {
      await sql.begin(async (tx) => {
        const [lockedProperty] = await tx`
          SELECT owner_id, image_url FROM public.properties WHERE id = ${propertyId} FOR UPDATE
        `;
        if (!lockedProperty || !canManageProperty(auth, lockedProperty.owner_id)) {
          throw new Error("Property image attachment authorization changed");
        }
        const { data: objectInfo, error: objectInfoError } = await supabaseAdmin.storage
          .from(PROPERTY_IMAGE_BUCKET).info(path);
        if (objectInfoError || !objectInfo || !isValidPropertyImageObjectInfo(path, objectInfo)) {
          throw new InvalidUploadedImageError("Uploaded property image is missing or invalid");
        }
        const { data: objectBlob, error: objectDownloadError } = await supabaseAdmin.storage
          .from(PROPERTY_IMAGE_BUCKET).download(path);
        const signatureBytes = objectBlob
          ? new Uint8Array(await objectBlob.slice(0, 12).arrayBuffer())
          : new Uint8Array();
        if (objectDownloadError || !isValidPropertyImageSignature(path, signatureBytes)) {
          throw new InvalidUploadedImageError("Uploaded property image content is invalid");
        }
        const previousPath = decodePropertyImageReference(lockedProperty.image_url, propertyId);
        const [updated] = await tx`
          UPDATE public.properties
          SET image_url = ${reference}, updated_at = NOW()
          WHERE id = ${propertyId} AND owner_id = ${lockedProperty.owner_id}
          RETURNING id
        `;
        if (!updated) throw new Error("Property image attachment failed");
        if (previousPath && previousPath !== path) {
          const { error: cleanupError } = await supabaseAdmin.storage.from(PROPERTY_IMAGE_BUCKET).remove([previousPath]);
          if (cleanupError) console.error("Previous property image cleanup failed", cleanupError.message);
        }
      });
    } catch (error) {
      await supabaseAdmin.storage.from(PROPERTY_IMAGE_BUCKET).remove([path]);
      if (error instanceof InvalidUploadedImageError) {
        return res.status(400).json({ message: error.message });
      }
      throw error;
    }
    return res.status(201).json({ imageUrl: `/api/property-images?propertyId=${encodeURIComponent(propertyId)}` });
  } finally {
    await sql.end();
  }
});
