import { Router } from "express";
import { isAuthenticated, supabase } from "../supabaseAuth";
import { mapCaretakerAssignmentRow } from "../utils/mappers";
import { emailService } from "../services/emailService";
import { z } from "zod";
import crypto from "crypto";

const router = Router();

// POST /api/caretakers/assign
router.post("/assign", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role !== "landlord" && role !== "property_manager") {
      return res.status(403).json({ message: "Only landlords can assign caretakers" });
    }

    const assignmentSchema = z.object({
      caretakerId: z.string().min(1),
      propertyId: z.string().min(1, "Property is required"),
    });

    const assignmentData = assignmentSchema.parse(req.body);

    const { data: caretaker, error: caretakerError } = await supabase
      .from("users").select("id, role").eq("id", assignmentData.caretakerId).single();

    if (caretakerError || !caretaker) return res.status(404).json({ message: "Caretaker not found" });
    if (caretaker.role !== "caretaker") return res.status(400).json({ message: "User is not a caretaker" });

    const { data: property } = await supabase
      .from("properties").select("id").eq("id", assignmentData.propertyId).eq("owner_id", userId).single();

    if (!property) return res.status(403).json({ message: "You do not own the specified property" });

    const { data: existingAssignment } = await supabase
      .from("caretaker_assignments").select("*")
      .eq("caretaker_id", assignmentData.caretakerId).eq("landlord_id", userId)
      .eq("status", "active").eq("property_id", assignmentData.propertyId).single();

    if (existingAssignment) return res.status(200).json(mapCaretakerAssignmentRow(existingAssignment));

    const { data, error } = await supabase
      .from("caretaker_assignments")
      .insert([{
        caretaker_id: assignmentData.caretakerId, landlord_id: userId,
        property_id: assignmentData.propertyId, unit_id: null, status: "active",
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }])
      .select().single();

    if (error) return res.status(500).json({ message: "Failed to assign caretaker" });

    const { data: caretakerProfile } = await supabase
      .from("users").select("id, first_name, last_name, email").eq("id", assignmentData.caretakerId).single();

    return res.status(201).json(mapCaretakerAssignmentRow(data, caretakerProfile));
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: error.errors });
    res.status(500).json({ message: "Failed to assign caretaker" });
  }
});

// GET /api/caretakers
router.get("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role !== "landlord" && role !== "property_manager") {
      return res.status(403).json({ message: "Only landlords can view caretakers" });
    }

    const { data, error } = await supabase
      .from("users").select("id, first_name, last_name, email, status")
      .eq("role", "caretaker").eq("created_by", userId).order("created_at", { ascending: false });

    if (error) return res.status(500).json({ message: "Failed to fetch caretakers" });

    return res.json((data || []).map((row: any) => ({
      id: row.id, firstName: row.first_name, lastName: row.last_name, email: row.email, status: row.status,
    })));
  } catch {
    res.status(500).json({ message: "Failed to fetch caretakers" });
  }
});

// GET /api/caretakers/assignments
router.get("/assignments", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role !== "landlord" && role !== "property_manager" && role !== "caretaker") {
      return res.status(403).json({ message: "Unauthorized" });
    }

    const query = supabase.from("caretaker_assignments").select("*").order("created_at", { ascending: false });
    if (role === "caretaker") query.eq("caretaker_id", userId);
    else query.eq("landlord_id", userId);

    const { data, error } = await query;
    if (error) return res.status(500).json({ message: "Failed to fetch caretaker assignments" });

    const assignments = data || [];
    const caretakerIds = Array.from(new Set(assignments.map((a: any) => a.caretaker_id)));
    const caretakersById = new Map<string, any>();

    if (caretakerIds.length > 0) {
      const { data: caretakers, error: caretakersError } = await supabase
        .from("users").select("id, first_name, last_name, email").in("id", caretakerIds);

      if (caretakersError) return res.status(500).json({ message: "Failed to fetch caretaker profiles" });
      (caretakers || []).forEach((c: any) => caretakersById.set(c.id, c));
    }

    return res.json(assignments.map((a: any) => mapCaretakerAssignmentRow(a, caretakersById.get(a.caretaker_id))));
  } catch {
    res.status(500).json({ message: "Failed to fetch caretaker assignments" });
  }
});

// GET /api/caretakers/properties
router.get("/properties", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role !== "caretaker") return res.status(403).json({ message: "Only caretakers can view assigned properties" });

    const { data: assignments, error } = await supabase
      .from("caretaker_assignments").select("property_id, unit_id")
      .eq("caretaker_id", userId).eq("status", "active");

    if (error) return res.status(500).json({ message: "Failed to fetch caretaker assignments" });

    const propertyIds = new Set<string>();
    const unitIds = (assignments || []).map((a: any) => a.unit_id).filter(Boolean) as string[];
    (assignments || []).forEach((a: any) => { if (a.property_id) propertyIds.add(a.property_id); });

    if (unitIds.length > 0) {
      const { data: units } = await supabase.from("units").select("id, property_id").in("id", unitIds);
      (units || []).forEach((u: any) => { if (u.property_id) propertyIds.add(u.property_id); });
    }

    const propertyIdList = Array.from(propertyIds);
    if (propertyIdList.length === 0) return res.json([]);

    const { data: properties, error: propertiesError } = await supabase
      .from("properties").select("id, name, address").in("id", propertyIdList).order("name", { ascending: true });

    if (propertiesError) return res.status(500).json({ message: "Failed to fetch assigned properties" });
    return res.json(properties || []);
  } catch {
    res.status(500).json({ message: "Failed to fetch assigned properties" });
  }
});

// PUT /api/caretakers/assignments/:id
router.put("/assignments/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role !== "landlord" && role !== "property_manager") {
      return res.status(403).json({ message: "Only landlords can update caretaker assignments" });
    }

    const updateSchema = z.object({
      status: z.enum(["active", "inactive"]).optional(),
      propertyId: z.string().optional().nullable(),
      unitId: z.string().optional().nullable(),
    }).refine((d) => d.propertyId || d.unitId || d.status, { message: "At least one field must be provided", path: ["status"] });

    const updateData = updateSchema.parse(req.body);

    const { data: assignment, error: assignmentError } = await supabase
      .from("caretaker_assignments").select("id, landlord_id").eq("id", req.params.id).single();

    if (assignmentError || !assignment) return res.status(404).json({ message: "Assignment not found" });
    if (assignment.landlord_id !== userId) return res.status(403).json({ message: "Unauthorized" });

    if (updateData.propertyId) {
      const { data: property } = await supabase
        .from("properties").select("id").eq("id", updateData.propertyId).eq("owner_id", userId).single();
      if (!property) return res.status(403).json({ message: "Property not found or does not belong to you" });
    }

    if (updateData.unitId) {
      const { data: unit } = await supabase.from("units").select("id, property_id").eq("id", updateData.unitId).single();
      if (!unit) return res.status(403).json({ message: "Unit not found" });
      const { data: property } = await supabase.from("properties").select("id").eq("id", unit.property_id).eq("owner_id", userId).single();
      if (!property) return res.status(403).json({ message: "Unit not found or does not belong to you" });
    }

    const updates: any = { updated_at: new Date().toISOString() };
    if (updateData.status !== undefined) updates.status = updateData.status;
    if (updateData.propertyId !== undefined) updates.property_id = updateData.propertyId;
    if (updateData.unitId !== undefined) updates.unit_id = updateData.unitId;

    const { data, error } = await supabase
      .from("caretaker_assignments").update(updates).eq("id", req.params.id).select().single();

    if (error) return res.status(500).json({ message: "Failed to update caretaker assignment" });

    const { data: caretakerProfile } = await supabase
      .from("users").select("id, first_name, last_name, email").eq("id", data.caretaker_id).single();

    return res.json(mapCaretakerAssignmentRow(data, caretakerProfile));
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: error.errors });
    res.status(500).json({ message: "Failed to update caretaker assignment" });
  }
});

// DELETE /api/caretakers/assignments/:id
router.delete("/assignments/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role !== "landlord" && role !== "property_manager") {
      return res.status(403).json({ message: "Only landlords can delete caretaker assignments" });
    }

    const { data: assignment, error: assignmentError } = await supabase
      .from("caretaker_assignments").select("id, landlord_id").eq("id", req.params.id).single();

    if (assignmentError || !assignment) return res.status(404).json({ message: "Assignment not found" });
    if (assignment.landlord_id !== userId) return res.status(403).json({ message: "Unauthorized" });

    const { error } = await supabase.from("caretaker_assignments").delete().eq("id", req.params.id);
    if (error) return res.status(500).json({ message: "Failed to delete caretaker assignment" });

    return res.json({ message: "Caretaker assignment deleted", id: req.params.id });
  } catch {
    res.status(500).json({ message: "Failed to delete caretaker assignment" });
  }
});

// ─── Caretaker Invitations ───────────────────────────────────────────────────

// GET /api/caretaker-invitations
router.get("/invitations", async (req: any, res: any, next: any) => {
  const token = req.query.token as string | undefined;

  if (token) {
    try {
      const { data: invitation, error } = await supabase
        .from("caretaker_invitations")
        .select("id, first_name, last_name, email, invitation_sent_at, status, expires_at")
        .eq("invitation_token", token).in("status", ["invited", "pending"]).single();

      if (error || !invitation) {
        return res.status(404).json({ error: "Invalid or expired invitation token", message: "This invitation link is invalid or has already been used." });
      }

      if (!invitation.invitation_sent_at) {
        return res.status(400).json({ error: "Invitation not sent", message: "This invitation has not been sent yet." });
      }

      const expiresAt = invitation.expires_at
        ? new Date(invitation.expires_at)
        : new Date(new Date(invitation.invitation_sent_at).getTime() + 7 * 24 * 60 * 60 * 1000);

      if (new Date() > expiresAt) {
        return res.status(410).json({ error: "Invitation expired", message: "This invitation link has expired.", expired: true });
      }

      return res.status(200).json({ firstName: invitation.first_name, lastName: invitation.last_name, email: invitation.email, valid: true });
    } catch {
      return res.status(500).json({ error: "Server error", message: "Failed to verify invitation" });
    }
  }

  return isAuthenticated(req, res, next);
}, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role !== "landlord" && role !== "property_manager") {
      return res.status(403).json({ message: "Only landlords can view caretaker invitations" });
    }

    const { data, error } = await supabase
      .from("caretaker_invitations")
      .select("id, email, first_name, last_name, status, invitation_sent_at, invitation_accepted_at, expires_at, property_id, unit_id, created_at")
      .eq("landlord_id", userId).order("created_at", { ascending: false });

    if (error) return res.status(500).json({ message: "Failed to fetch caretaker invitations" });

    return res.json((data || []).map((inv: any) => ({
      id: inv.id, email: inv.email, firstName: inv.first_name, lastName: inv.last_name,
      status: inv.status, invitationSentAt: inv.invitation_sent_at, invitationAcceptedAt: inv.invitation_accepted_at,
      expiresAt: inv.expires_at, propertyId: inv.property_id, unitId: inv.unit_id, createdAt: inv.created_at,
    })));
  } catch {
    res.status(500).json({ message: "Failed to fetch caretaker invitations" });
  }
});

// POST /api/caretaker-invitations
router.post("/invitations", async (req: any, res: any, next: any) => {
  const action = req.query.action as string | undefined;
  if (action === "accept") return next();
  return isAuthenticated(req, res, next);
}, async (req: any, res: any) => {
  const action = req.query.action as string | undefined;

  // ── Accept invitation (public) ──
  if (action === "accept") {
    try {
      const acceptSchema = z.object({
        token: z.string().min(1),
        password: z.string().min(8),
      });
      const { token, password } = acceptSchema.parse(req.body);

      const { data: invitation, error } = await supabase
        .from("caretaker_invitations")
        .select("id, landlord_id, email, first_name, last_name, invitation_sent_at, status, expires_at, property_id, unit_id")
        .eq("invitation_token", token).in("status", ["invited", "pending"]).single();

      if (error || !invitation) {
        return res.status(404).json({ error: "Invalid invitation", message: "This invitation link is invalid or has already been used." });
      }

      if (!invitation.invitation_sent_at) {
        return res.status(410).json({ error: "Invalid invitation", message: "This invitation is invalid." });
      }

      const expiresAt = invitation.expires_at
        ? new Date(invitation.expires_at)
        : new Date(new Date(invitation.invitation_sent_at).getTime() + 7 * 24 * 60 * 60 * 1000);

      if (new Date() > expiresAt) {
        return res.status(410).json({ error: "Invitation expired", message: "This invitation link has expired." });
      }

      const { data: existingUserRecord } = await supabase
        .from("users").select("id, role").eq("email", invitation.email).maybeSingle();

      if (existingUserRecord?.role && existingUserRecord.role !== "caretaker") {
        return res.status(400).json({ error: "Account already exists", message: `This email is already registered as a ${existingUserRecord.role}.` });
      }

      let authUserId = existingUserRecord?.id as string | undefined;

      if (authUserId) {
        const { error: updateError } = await supabase.auth.admin.updateUserById(authUserId, {
          password,
          user_metadata: { role: "caretaker", first_name: invitation.first_name, last_name: invitation.last_name },
        });
        if (updateError) return res.status(500).json({ error: "Account update failed" });
      } else {
        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
          email: invitation.email, password, email_confirm: true,
          user_metadata: { first_name: invitation.first_name, last_name: invitation.last_name, role: "caretaker" },
        });
        if (authError || !authData.user) {
          return res.status(500).json({ error: "Account creation failed", message: authError?.message });
        }
        authUserId = authData.user.id;
      }

      await supabase.from("users").upsert({
        id: authUserId, email: invitation.email, first_name: invitation.first_name, last_name: invitation.last_name,
        role: "caretaker", created_by: invitation.landlord_id, status: "active",
      }, { onConflict: "id" });

      if (invitation.property_id || invitation.unit_id) {
        await supabase.from("caretaker_assignments").insert([{
          caretaker_id: authUserId, landlord_id: invitation.landlord_id,
          property_id: invitation.property_id || null, unit_id: invitation.unit_id || null,
          status: "active", created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
        }]);
      }

      await supabase.from("caretaker_invitations").update({
        invitation_accepted_at: new Date().toISOString(), status: "accepted",
        invitation_token: null, updated_at: new Date().toISOString(),
      }).eq("id", invitation.id);

      return res.status(201).json({ message: "Account created successfully", requireLogin: true, email: invitation.email });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "Invalid input", errors: error.errors });
      return res.status(500).json({ error: "Server error", message: "Failed to accept invitation" });
    }
  }

  // ── Create / resend invitation (authenticated landlord) ──
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role !== "landlord" && role !== "property_manager") {
      return res.status(403).json({ message: "Only landlords can invite caretakers" });
    }

    if (action === "resend") {
      const resendSchema = z.object({ invitationId: z.string().min(1) });
      const { invitationId } = resendSchema.parse(req.body);

      const { data: invitation } = await supabase
        .from("caretaker_invitations").select("*").eq("id", invitationId).eq("landlord_id", userId).single();

      if (!invitation) return res.status(404).json({ message: "Invitation not found" });

      const token = crypto.randomBytes(32).toString("hex");
      await supabase.from("caretaker_invitations").update({
        invitation_token: token, invitation_sent_at: new Date().toISOString(),
        status: "invited", expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", invitationId);

      const { data: landlordProfile } = await supabase
        .from("users").select("first_name, last_name").eq("id", userId).single();

      await emailService.sendCaretakerInvitation(
        invitation.email, `${invitation.first_name} ${invitation.last_name}`, token,
        landlordProfile ? `${landlordProfile.first_name} ${landlordProfile.last_name}` : undefined
      );

      return res.status(200).json({ message: "Invitation resent successfully", email: invitation.email });
    }

    // Create new invitation
    const inviteSchema = z.object({
      email: z.string().email(), firstName: z.string().min(1), lastName: z.string().min(1),
      propertyId: z.string().min(1, "Property is required"),
    });
    const inviteData = inviteSchema.parse(req.body);

    const { data: property } = await supabase
      .from("properties").select("id").eq("id", inviteData.propertyId).eq("owner_id", userId).single();

    if (!property) return res.status(403).json({ message: "Property not found for this landlord" });

    const token = crypto.randomBytes(32).toString("hex");

    const { data: invitation, error } = await supabase
      .from("caretaker_invitations")
      .insert([{
        landlord_id: userId, invited_by: userId, email: inviteData.email,
        first_name: inviteData.firstName, last_name: inviteData.lastName,
        invitation_token: token, status: "pending",
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        property_id: inviteData.propertyId || null, unit_id: null,
        created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
      }])
      .select().single();

    if (error || !invitation) return res.status(500).json({ message: "Failed to create caretaker invitation" });

    const { data: landlordProfile } = await supabase
      .from("users").select("first_name, last_name").eq("id", userId).single();

    await emailService.sendCaretakerInvitation(
      invitation.email, `${invitation.first_name} ${invitation.last_name}`, token,
      landlordProfile ? `${landlordProfile.first_name} ${landlordProfile.last_name}` : undefined
    );

    const { data: updatedInvitation } = await supabase
      .from("caretaker_invitations")
      .update({ invitation_sent_at: new Date().toISOString(), status: "invited", updated_at: new Date().toISOString() })
      .eq("id", invitation.id)
      .select("id, email, first_name, last_name, status, invitation_sent_at, expires_at, property_id, unit_id")
      .single();

    return res.status(201).json({
      id: updatedInvitation?.id, email: updatedInvitation?.email,
      firstName: updatedInvitation?.first_name, lastName: updatedInvitation?.last_name,
      status: updatedInvitation?.status, invitationSentAt: updatedInvitation?.invitation_sent_at,
      expiresAt: updatedInvitation?.expires_at, propertyId: updatedInvitation?.property_id, unitId: updatedInvitation?.unit_id,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: error.errors });
    res.status(500).json({ message: "Failed to create caretaker invitation" });
  }
});

// POST /api/caretakers/invitations/resend  (dedicated resend endpoint)
router.post("/invitations/resend", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;

    if (role !== "landlord" && role !== "property_manager") {
      return res.status(403).json({ message: "Only landlords can resend caretaker invitations" });
    }

    const { invitationId } = z.object({ invitationId: z.string().min(1) }).parse(req.body);

    const { data: invitation } = await supabase
      .from("caretaker_invitations").select("*").eq("id", invitationId).eq("landlord_id", userId).single();

    if (!invitation) return res.status(404).json({ message: "Invitation not found" });

    const token = crypto.randomBytes(32).toString("hex");
    await supabase.from("caretaker_invitations").update({
      invitation_token: token, invitation_sent_at: new Date().toISOString(),
      status: "invited", expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", invitationId);

    const { data: landlordProfile } = await supabase
      .from("users").select("first_name, last_name").eq("id", userId).single();

    await emailService.sendCaretakerInvitation(
      invitation.email, `${invitation.first_name} ${invitation.last_name}`, token,
      landlordProfile ? `${landlordProfile.first_name} ${landlordProfile.last_name}` : undefined
    );

    return res.status(200).json({ message: "Invitation resent successfully", email: invitation.email });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: error.errors });
    res.status(500).json({ message: "Failed to resend caretaker invitation" });
  }
});

export default router;
