// GET/POST/PATCH/DELETE /api/maintenance-requests - Manage maintenance requests
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth } from '../_lib/auth.js';
import { createDbConnection } from '../_lib/db.js';
import { z } from 'zod';

export default requireAuth(async (req: VercelRequest, res: VercelResponse, auth) => {
  const sql = createDbConnection();
  
  try {
    if (req.method === 'GET') {
      // Parse query parameters
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const status = req.query.status as string | undefined;

      let maintenanceRequests;
      
      if (auth.role === 'landlord') {
        // Get all maintenance requests for landlord's properties
        if (status) {
          maintenanceRequests = await sql`
            SELECT 
              mr.*,
              t.id as tenant_id, t.first_name as tenant_first_name, t.last_name as tenant_last_name,
              u.id as unit_id, u.unit_number,
              p.id as property_id, p.name as property_name
            FROM public.maintenance_requests mr
            INNER JOIN public.units u ON mr.unit_id = u.id
            INNER JOIN public.properties p ON u.property_id = p.id
            INNER JOIN public.tenants t ON mr.tenant_id = t.id
            WHERE p.owner_id = ${auth.userId} AND mr.status = ${status}
            ORDER BY 
              CASE mr.priority
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
              END,
              mr.created_at DESC
            LIMIT ${limit}
          `;
        } else {
          maintenanceRequests = await sql`
            SELECT 
              mr.*,
              t.id as tenant_id, t.first_name as tenant_first_name, t.last_name as tenant_last_name,
              u.id as unit_id, u.unit_number,
              p.id as property_id, p.name as property_name
            FROM public.maintenance_requests mr
            INNER JOIN public.units u ON mr.unit_id = u.id
            INNER JOIN public.properties p ON u.property_id = p.id
            INNER JOIN public.tenants t ON mr.tenant_id = t.id
            WHERE p.owner_id = ${auth.userId}
            ORDER BY 
              CASE mr.priority
                WHEN 'urgent' THEN 1
                WHEN 'high' THEN 2
                WHEN 'medium' THEN 3
                WHEN 'low' THEN 4
              END,
              mr.created_at DESC
            LIMIT ${limit}
          `;
        }
      } else {
        // Get maintenance requests for tenant
        const tenants = await sql`
          SELECT id FROM public.tenants WHERE user_id = ${auth.userId}
        `;
        
        if (tenants.length === 0) {
          return res.status(200).json({ data: [], pagination: { limit, nextCursor: null } });
        }

        const tenantId = tenants[0].id;
        
        if (status) {
          maintenanceRequests = await sql`
            SELECT 
              mr.*,
              u.id as unit_id, u.unit_number,
              p.id as property_id, p.name as property_name
            FROM public.maintenance_requests mr
            INNER JOIN public.units u ON mr.unit_id = u.id
            INNER JOIN public.properties p ON u.property_id = p.id
            WHERE mr.tenant_id = ${tenantId} AND mr.status = ${status}
            ORDER BY mr.created_at DESC
            LIMIT ${limit}
          `;
        } else {
          maintenanceRequests = await sql`
            SELECT 
              mr.*,
              u.id as unit_id, u.unit_number,
              p.id as property_id, p.name as property_name
            FROM public.maintenance_requests mr
            INNER JOIN public.units u ON mr.unit_id = u.id
            INNER JOIN public.properties p ON u.property_id = p.id
            WHERE mr.tenant_id = ${tenantId}
            ORDER BY mr.created_at DESC
            LIMIT ${limit}
          `;
        }
      }

      // Format the response
      const formattedRequests = maintenanceRequests.map((request: any) => ({
        id: request.id,
        unitId: request.unit_id,
        tenantId: request.tenant_id,
        title: request.title,
        description: request.description,
        priority: request.priority,
        status: request.status,
        assignedTo: request.assigned_to,
        completedDate: request.completed_date,
        createdAt: request.created_at,
        updatedAt: request.updated_at,
        unit: {
          id: request.unit_id,
          unitNumber: request.unit_number,
        },
        property: {
          id: request.property_id,
          name: request.property_name,
        },
        ...(auth.role === 'landlord' && {
          tenant: {
            id: request.tenant_id,
            firstName: request.tenant_first_name,
            lastName: request.tenant_last_name,
          }
        })
      }));

      return res.status(200).json({
        data: formattedRequests,
        pagination: {
          limit,
          nextCursor: null,
        }
      });
    }

    if (req.method === 'POST') {
      const requestCreateSchema = z.object({
        unitId: z.string().optional(),
        title: z.string().min(3, 'Title must be at least 3 characters'),
        description: z.string().min(10, 'Description must be at least 10 characters'),
        priority: z.enum(['low', 'medium', 'high', 'urgent']).default('medium'),
      });

      const requestData = requestCreateSchema.parse(req.body);

      // Get tenant ID from user
      const tenants = await sql`
        SELECT id, user_id FROM public.tenants WHERE user_id = ${auth.userId}
      `;

      if (tenants.length === 0) {
        return res.status(404).json({ error: 'Tenant profile not found', details: null });
      }

      const tenantId = tenants[0].id;

      // Get unit ID from active lease if not provided
      let unitId = requestData.unitId;
      if (!unitId) {
        const leases = await sql`
          SELECT unit_id FROM public.leases 
          WHERE tenant_id = ${tenantId} 
            AND status = 'active'
            AND start_date <= CURRENT_DATE
            AND end_date >= CURRENT_DATE
          LIMIT 1
        `;

        if (leases.length === 0) {
          return res.status(400).json({ 
            error: 'No active lease found', 
            details: 'You must have an active lease to submit maintenance requests' 
          });
        }

        unitId = leases[0].unit_id;
      }

      // Create maintenance request  
      const maintenanceRequest = await sql`
        INSERT INTO public.maintenance_requests (
          unit_id, 
          tenant_id, 
          title, 
          description, 
          priority,
          status
        )
        VALUES (
          ${unitId!},
          ${tenantId},
          ${requestData.title},
          ${requestData.description},
          ${requestData.priority},
          'open'
        )
        RETURNING *
      `;

      return res.status(201).json(maintenanceRequest[0]);
    }

    if (req.method === 'PATCH') {
      const { id } = req.query;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Invalid request ID', details: null });
      }

      const updateSchema = z.object({
        status: z.enum(['open', 'in_progress', 'completed', 'cancelled']).optional(),
        assignedTo: z.string().optional(),
        completedDate: z.string().or(z.date()).optional(),
      });

      const updateData = updateSchema.parse(req.body);

      // Verify the request exists and user has access
      const requests = await sql`
        SELECT mr.*, p.owner_id, t.user_id as tenant_user_id
        FROM public.maintenance_requests mr
        INNER JOIN public.units u ON mr.unit_id = u.id
        INNER JOIN public.properties p ON u.property_id = p.id
        INNER JOIN public.tenants t ON mr.tenant_id = t.id
        WHERE mr.id = ${id}
      `;

      if (requests.length === 0) {
        return res.status(404).json({ error: 'Maintenance request not found', details: null });
      }

      // Check if user has permission (get user role from metadata)
      const { data: { user } } = await sql.begin(async () => {
        return { data: { user: { user_metadata: { role: requests[0].owner_id === auth.userId ? 'landlord' : 'tenant' } } } };
      });

      // Only landlords can update maintenance requests
      if (requests[0].owner_id !== auth.userId) {
        return res.status(403).json({ error: 'Access denied - only landlords can update requests', details: null });
      }

      // Build update query dynamically
      const setParts = [];
      
      if (updateData.status !== undefined) {
        setParts.push(`status = '${updateData.status}'`);
      }
      
      if (updateData.assignedTo !== undefined) {
        setParts.push(`assigned_to = '${updateData.assignedTo}'`);
      }
      
      if (updateData.completedDate !== undefined) {
        setParts.push(`completed_date = '${new Date(updateData.completedDate).toISOString()}'`);
      }

      if (setParts.length === 0) {
        return res.status(400).json({ error: 'No updates provided', details: null });
      }

      setParts.push(`updated_at = '${new Date().toISOString()}'`);

      const updatedRequest = await sql`
        UPDATE public.maintenance_requests
        SET ${sql.unsafe(setParts.join(', '))}
        WHERE id = ${id}
        RETURNING *
      `;

      return res.status(200).json(updatedRequest[0]);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      
      if (!id || typeof id !== 'string') {
        return res.status(400).json({ error: 'Invalid request ID', details: null });
      }

      // Verify the request exists and user has access
      const requests = await sql`
        SELECT mr.*, t.user_id as tenant_user_id, p.owner_id
        FROM public.maintenance_requests mr
        INNER JOIN public.tenants t ON mr.tenant_id = t.id
        INNER JOIN public.units u ON mr.unit_id = u.id
        INNER JOIN public.properties p ON u.property_id = p.id
        WHERE mr.id = ${id}
      `;

      if (requests.length === 0) {
        return res.status(404).json({ error: 'Maintenance request not found', details: null });
      }

      // Tenants can only delete their own requests, landlords can delete any
      const canDelete = 
        (requests[0].tenant_user_id === auth.userId) ||
        (requests[0].owner_id === auth.userId);

      if (!canDelete) {
        return res.status(403).json({ error: 'Access denied', details: null });
      }

      await sql`
        DELETE FROM public.maintenance_requests WHERE id = ${id}
      `;

      return res.status(200).json({ message: 'Maintenance request deleted successfully' });
    }
    
    return res.status(405).json({ error: 'Method not allowed', details: null });
  } catch (error) {
    console.error('Maintenance request error:', error);
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid input', details: error.errors });
    } else {
      res.status(500).json({ error: 'Failed to process request', details: null });
    }
  } finally {
    await sql.end();
  }
});
