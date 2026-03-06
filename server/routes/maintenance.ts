import { Router } from "express";
import { isAuthenticated, supabase } from "../supabaseAuth";
import { supabaseStorage } from "../storageInstance";
import { getCaretakerUnitIds } from "../utils/caretakerHelpers";
import { z } from "zod";

const router = Router();

// GET /api/maintenance-requests
router.get("/", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;
    let requests: any[] = [];

    if (role === "tenant") {
      const tenant = await supabaseStorage.getTenantByUserId(userId);
      if (tenant) requests = await supabaseStorage.getMaintenanceRequestsByTenantId(tenant.id);
    } else if (role === "caretaker") {
      const unitIds = await getCaretakerUnitIds(userId);
      if (unitIds.length === 0) return res.json([]);

      const { data, error } = await supabase
        .from("maintenance_requests").select("*").in("unit_id", unitIds).order("created_at", { ascending: false });

      if (error) return res.status(500).json({ message: "Failed to fetch maintenance requests" });

      requests = (data || []).map((row: any) => ({
        id: row.id, unitId: row.unit_id, tenantId: row.tenant_id, title: row.title,
        description: row.description, priority: row.priority, status: row.status,
        assignedTo: row.assigned_to, completedDate: row.completed_date,
        createdAt: row.created_at, updatedAt: row.updated_at,
      }));
    } else {
      requests = await supabaseStorage.getMaintenanceRequestsByOwnerId(userId);
    }

    res.json(requests);
  } catch {
    res.status(500).json({ message: "Failed to fetch maintenance requests" });
  }
});

// PUT /api/maintenance-requests/:id
router.put("/:id", isAuthenticated, async (req: any, res: any) => {
  try {
    const userId = req.user.sub;
    const role = req.user.appRole;
    const requestId = req.params.id;

    if (role === "tenant") {
      return res.status(403).json({ message: "Only landlords or property managers can update maintenance requests" });
    }

    const updateSchema = z.object({
      status: z.enum(["open", "pending", "in_progress", "completed", "cancelled"]).optional(),
      assignedTo: z.string().optional().nullable(),
      completedDate: z.string().optional().nullable(),
    });

    const updateData = updateSchema.parse(req.body);

    if (role === "caretaker") {
      const unitIds = await getCaretakerUnitIds(userId);
      if (unitIds.length === 0) return res.status(403).json({ message: "Caretaker not assigned to this request" });

      const { data: existingRequest, error } = await supabase
        .from("maintenance_requests").select("unit_id").eq("id", requestId).single();

      if (error || !existingRequest) return res.status(404).json({ message: "Maintenance request not found" });
      if (!unitIds.includes(existingRequest.unit_id)) return res.status(403).json({ message: "Caretaker not assigned to this request" });
    } else {
      const ownerRequests = await supabaseStorage.getMaintenanceRequestsByOwnerId(userId);
      if (!ownerRequests.some((r) => r.id === requestId)) {
        return res.status(404).json({ message: "Maintenance request not found" });
      }
    }

    const updatePayload: any = { updated_at: new Date().toISOString() };
    if (updateData.status !== undefined) updatePayload.status = updateData.status;
    if (updateData.assignedTo !== undefined) updatePayload.assigned_to = updateData.assignedTo;
    if (updateData.completedDate !== undefined) {
      updatePayload.completed_date = updateData.completedDate ? new Date(updateData.completedDate).toISOString() : null;
    }

    const { data, error } = await supabase
      .from("maintenance_requests").update(updatePayload).eq("id", requestId).select().single();

    if (error) return res.status(500).json({ message: "Failed to update maintenance request", details: error.message });

    res.json({
      id: data.id, unitId: data.unit_id, tenantId: data.tenant_id, title: data.title,
      description: data.description, priority: data.priority, status: data.status,
      assignedTo: data.assigned_to, completedDate: data.completed_date,
      createdAt: data.created_at, updatedAt: data.updated_at,
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ message: "Invalid input", errors: error.errors });
    res.status(500).json({ message: "Failed to update maintenance request" });
  }
});

export default router;
