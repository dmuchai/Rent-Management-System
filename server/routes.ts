import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { ObjectStorageService, ObjectNotFoundError } from "./objectStorage";
import { ObjectPermission } from "./objectAcl";
import { pesapalService } from "./services/pesapalService";
import { emailService } from "./services/emailService";
import {
  insertPropertySchema,
  insertUnitSchema,
  insertTenantSchema,
  insertLeaseSchema,
  insertPaymentSchema,
  insertMaintenanceRequestSchema,
  insertDocumentSchema,
} from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Object storage routes for documents
  app.get("/objects/:objectPath(*)", isAuthenticated, async (req: any, res) => {
    const userId = req.user?.claims?.sub;
    const objectStorageService = new ObjectStorageService();
    try {
      const objectFile = await objectStorageService.getObjectEntityFile(req.path);
      const canAccess = await objectStorageService.canAccessObjectEntity({
        objectFile,
        userId: userId,
        requestedPermission: ObjectPermission.READ,
      });
      if (!canAccess) {
        return res.sendStatus(401);
      }
      objectStorageService.downloadObject(objectFile, res);
    } catch (error) {
      console.error("Error checking object access:", error);
      if (error instanceof ObjectNotFoundError) {
        return res.sendStatus(404);
      }
      return res.sendStatus(500);
    }
  });

  app.post("/api/objects/upload", isAuthenticated, async (req, res) => {
    const objectStorageService = new ObjectStorageService();
    try {
      const uploadURL = await objectStorageService.getObjectEntityUploadURL();
      res.json({ uploadURL });
    } catch (error) {
      console.error("Error getting upload URL:", error);
      res.status(500).json({ error: "Failed to get upload URL" });
    }
  });

  // Property routes
  app.get("/api/properties", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const properties = await storage.getPropertiesByOwnerId(userId);
      res.json(properties);
    } catch (error) {
      console.error("Error fetching properties:", error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });

  app.post("/api/properties", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const propertyData = insertPropertySchema.parse({
        ...req.body,
        ownerId: userId,
      });
      const property = await storage.createProperty(propertyData);
      res.status(201).json(property);
    } catch (error) {
      console.error("Error creating property:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create property" });
      }
    }
  });

  app.put("/api/properties/:id", isAuthenticated, async (req: any, res) => {
    try {
      const propertyData = insertPropertySchema.partial().parse(req.body);
      const property = await storage.updateProperty(req.params.id, propertyData);
      res.json(property);
    } catch (error) {
      console.error("Error updating property:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update property" });
      }
    }
  });

  app.delete("/api/properties/:id", isAuthenticated, async (req, res) => {
    try {
      await storage.deleteProperty(req.params.id);
      res.status(204).send();
    } catch (error) {
      console.error("Error deleting property:", error);
      res.status(500).json({ message: "Failed to delete property" });
    }
  });

  // Unit routes
  app.get("/api/properties/:propertyId/units", isAuthenticated, async (req, res) => {
    try {
      const units = await storage.getUnitsByPropertyId(req.params.propertyId);
      res.json(units);
    } catch (error) {
      console.error("Error fetching units:", error);
      res.status(500).json({ message: "Failed to fetch units" });
    }
  });

  app.post("/api/units", isAuthenticated, async (req, res) => {
    try {
      const unitData = insertUnitSchema.parse(req.body);
      const unit = await storage.createUnit(unitData);
      res.status(201).json(unit);
    } catch (error) {
      console.error("Error creating unit:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create unit" });
      }
    }
  });

  app.put("/api/units/:id", isAuthenticated, async (req, res) => {
    try {
      const unitData = insertUnitSchema.partial().parse(req.body);
      const unit = await storage.updateUnit(req.params.id, unitData);
      res.json(unit);
    } catch (error) {
      console.error("Error updating unit:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update unit" });
      }
    }
  });

  // Tenant routes
  app.get("/api/tenants", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role === "tenant") {
        const tenant = await storage.getTenantByUserId(userId);
        res.json(tenant ? [tenant] : []);
      } else {
        const tenants = await storage.getTenantsByOwnerId(userId);
        res.json(tenants);
      }
    } catch (error) {
      console.error("Error fetching tenants:", error);
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });

  app.post("/api/tenants", isAuthenticated, async (req, res) => {
    try {
      const tenantData = insertTenantSchema.parse(req.body);
      const tenant = await storage.createTenant(tenantData);
      res.status(201).json(tenant);
    } catch (error) {
      console.error("Error creating tenant:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create tenant" });
      }
    }
  });

  app.put("/api/tenants/:id", isAuthenticated, async (req, res) => {
    try {
      const tenantData = insertTenantSchema.partial().parse(req.body);
      const tenant = await storage.updateTenant(req.params.id, tenantData);
      res.json(tenant);
    } catch (error) {
      console.error("Error updating tenant:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update tenant" });
      }
    }
  });

  // Lease routes
  app.get("/api/leases", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role === "tenant") {
        const tenant = await storage.getTenantByUserId(userId);
        if (tenant) {
          const leases = await storage.getLeasesByTenantId(tenant.id);
          res.json(leases);
        } else {
          res.json([]);
        }
      } else {
        const leases = await storage.getLeasesByOwnerId(userId);
        res.json(leases);
      }
    } catch (error) {
      console.error("Error fetching leases:", error);
      res.status(500).json({ message: "Failed to fetch leases" });
    }
  });

  app.post("/api/leases", isAuthenticated, async (req, res) => {
    try {
      const leaseData = insertLeaseSchema.parse(req.body);
      const lease = await storage.createLease(leaseData);
      
      // Update unit as occupied
      await storage.updateUnit(leaseData.unitId, { isOccupied: true });
      
      res.status(201).json(lease);
    } catch (error) {
      console.error("Error creating lease:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create lease" });
      }
    }
  });

  // Payment routes
  app.get("/api/payments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role === "tenant") {
        const tenant = await storage.getTenantByUserId(userId);
        if (tenant) {
          const leases = await storage.getLeasesByTenantId(tenant.id);
          const allPayments = [];
          for (const lease of leases) {
            const payments = await storage.getPaymentsByLeaseId(lease.id);
            allPayments.push(...payments);
          }
          res.json(allPayments);
        } else {
          res.json([]);
        }
      } else {
        const payments = await storage.getPaymentsByOwnerId(userId);
        res.json(payments);
      }
    } catch (error) {
      console.error("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });

  app.post("/api/payments", isAuthenticated, async (req, res) => {
    try {
      const paymentData = insertPaymentSchema.parse(req.body);
      const payment = await storage.createPayment(paymentData);
      res.status(201).json(payment);
    } catch (error) {
      console.error("Error creating payment:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create payment" });
      }
    }
  });

  // Pesapal payment routes
  app.post("/api/payments/pesapal/initiate", isAuthenticated, async (req: any, res) => {
    try {
      if (!pesapalService.isConfigured()) {
        return res.status(503).json({ message: "Payment service not configured" });
      }

      const { leaseId, amount, description } = req.body;
      
      // Get lease and tenant details
      const lease = await storage.getLeaseById(leaseId);
      if (!lease) {
        return res.status(404).json({ message: "Lease not found" });
      }
      
      const tenant = await storage.getTenantById(lease.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      // Create payment record
      const payment = await storage.createPayment({
        leaseId,
        amount: amount.toString(),
        dueDate: new Date(),
        status: "pending",
        description,
      });

      // Get callback URL
      const callbackUrl = `${req.protocol}://${req.get('host')}/api/payments/pesapal/callback`;

      // Submit order to Pesapal
      const pesapalResponse = await pesapalService.submitOrderRequest({
        amount: parseFloat(amount),
        description,
        callbackUrl,
        merchantReference: payment.id,
        email: tenant.email,
        phone: tenant.phone,
        firstName: tenant.firstName,
        lastName: tenant.lastName,
      });

      // Update payment with Pesapal details
      await storage.updatePayment(payment.id, {
        pesapalOrderTrackingId: pesapalResponse.order_tracking_id,
      });

      res.json({
        paymentId: payment.id,
        redirectUrl: pesapalResponse.redirect_url,
        orderTrackingId: pesapalResponse.order_tracking_id,
      });
    } catch (error) {
      console.error("Error initiating Pesapal payment:", error);
      res.status(500).json({ message: "Failed to initiate payment" });
    }
  });

  app.get("/api/payments/pesapal/callback", async (req, res) => {
    try {
      const { OrderTrackingId, OrderMerchantReference } = req.query;
      
      if (!OrderTrackingId || !OrderMerchantReference) {
        return res.status(400).json({ message: "Missing required parameters" });
      }

      // Get transaction status from Pesapal
      const status = await pesapalService.getTransactionStatus(OrderTrackingId as string);
      
      // Update payment record
      const payment = await storage.getPaymentById(OrderMerchantReference as string);
      if (payment) {
        const paymentStatus = status.payment_status_code === "1" ? "completed" : "failed";
        
        await storage.updatePayment(payment.id, {
          status: paymentStatus,
          paymentMethod: status.payment_method,
          paidDate: paymentStatus === "completed" ? new Date() : undefined,
        });

        // Send confirmation email if payment successful
        if (paymentStatus === "completed") {
          const lease = await storage.getLeaseById(payment.leaseId);
          if (lease) {
            const tenant = await storage.getTenantById(lease.tenantId);
            const unit = await storage.getUnitById(lease.unitId);
            const property = unit ? await storage.getPropertyById(unit.propertyId) : null;

            if (tenant && unit && property) {
              await emailService.sendPaymentConfirmation(
                tenant.email,
                `${tenant.firstName} ${tenant.lastName}`,
                parseFloat(payment.amount),
                new Date(),
                property.name,
                unit.unitNumber,
                status.confirmation_code || payment.id
              );
            }
          }
        }
      }

      // Redirect to appropriate page
      const redirectUrl = status.payment_status_code === "1" 
        ? `/dashboard?payment=success`
        : `/dashboard?payment=failed`;
      
      res.redirect(redirectUrl);
    } catch (error) {
      console.error("Error handling Pesapal callback:", error);
      res.redirect('/dashboard?payment=error');
    }
  });

  app.post("/api/payments/pesapal/status/:orderTrackingId", isAuthenticated, async (req, res) => {
    try {
      if (!pesapalService.isConfigured()) {
        return res.status(503).json({ message: "Payment service not configured" });
      }

      const status = await pesapalService.getTransactionStatus(req.params.orderTrackingId);
      res.json(status);
    } catch (error) {
      console.error("Error getting payment status:", error);
      res.status(500).json({ message: "Failed to get payment status" });
    }
  });

  // Dashboard stats routes
  app.get("/api/dashboard/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);

      if (user?.role === "tenant") {
        // Tenant dashboard stats
        const tenant = await storage.getTenantByUserId(userId);
        if (!tenant) {
          return res.json({});
        }

        const leases = await storage.getLeasesByTenantId(tenant.id);
        const activeLease = leases.find(lease => lease.isActive);
        
        if (!activeLease) {
          return res.json({});
        }

        const payments = await storage.getPaymentsByLeaseId(activeLease.id);
        const recentPayments = payments.slice(0, 5);

        res.json({
          activeLease,
          recentPayments,
          nextDueDate: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1),
        });
      } else {
        // Landlord dashboard stats
        const properties = await storage.getPropertiesByOwnerId(userId);
        const allPayments = await storage.getPaymentsByOwnerId(userId);
        const overduePayments = await storage.getOverduePayments(userId);
        
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
        
        const paymentStats = await storage.getPaymentStats(userId, startOfMonth, endOfMonth);

        // Count total units and tenants
        let totalUnits = 0;
        let occupiedUnits = 0;
        
        for (const property of properties) {
          const units = await storage.getUnitsByPropertyId(property.id);
          totalUnits += units.length;
          occupiedUnits += units.filter(unit => unit.isOccupied).length;
        }

        res.json({
          totalProperties: properties.length,
          totalUnits,
          occupiedUnits,
          totalTenants: occupiedUnits,
          monthlyRevenue: paymentStats.totalCollected,
          overduePayments: overduePayments.length,
          recentPayments: allPayments.slice(0, 5),
          paymentStats,
        });
      }
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard stats" });
    }
  });

  // Maintenance request routes
  app.get("/api/maintenance-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (user?.role === "tenant") {
        const tenant = await storage.getTenantByUserId(userId);
        if (tenant) {
          const requests = await storage.getMaintenanceRequestsByTenantId(tenant.id);
          res.json(requests);
        } else {
          res.json([]);
        }
      } else {
        const requests = await storage.getMaintenanceRequestsByOwnerId(userId);
        res.json(requests);
      }
    } catch (error) {
      console.error("Error fetching maintenance requests:", error);
      res.status(500).json({ message: "Failed to fetch maintenance requests" });
    }
  });

  app.post("/api/maintenance-requests", isAuthenticated, async (req, res) => {
    try {
      const requestData = insertMaintenanceRequestSchema.parse(req.body);
      const request = await storage.createMaintenanceRequest(requestData);
      res.status(201).json(request);
    } catch (error) {
      console.error("Error creating maintenance request:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create maintenance request" });
      }
    }
  });

  // Document routes
  app.get("/api/documents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { category, relatedId } = req.query;
      
      if (category) {
        const documents = await storage.getDocumentsByCategory(category as string, relatedId as string);
        res.json(documents);
      } else {
        const documents = await storage.getDocumentsByOwnerId(userId);
        res.json(documents);
      }
    } catch (error) {
      console.error("Error fetching documents:", error);
      res.status(500).json({ message: "Failed to fetch documents" });
    }
  });

  app.post("/api/documents", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const documentData = insertDocumentSchema.parse({
        ...req.body,
        uploadedBy: userId,
      });
      
      const document = await storage.createDocument(documentData);

      // Set ACL policy for the document
      const objectStorageService = new ObjectStorageService();
      await objectStorageService.trySetObjectEntityAclPolicy(documentData.fileUrl, {
        owner: userId,
        visibility: "private",
      });

      res.status(201).json(document);
    } catch (error) {
      console.error("Error creating document:", error);
      if (error instanceof z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create document" });
      }
    }
  });

  // Report routes
  app.get("/api/reports/payments", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { startDate, endDate } = req.query;
      
      const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      const end = endDate ? new Date(endDate as string) : new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0);
      
      const stats = await storage.getPaymentStats(userId, start, end);
      const payments = await storage.getPaymentsByOwnerId(userId);
      
      res.json({
        stats,
        payments: payments.filter(p => {
          const paymentDate = new Date(p.dueDate);
          return paymentDate >= start && paymentDate <= end;
        }),
      });
    } catch (error) {
      console.error("Error generating payment report:", error);
      res.status(500).json({ message: "Failed to generate payment report" });
    }
  });

  // Email notification routes
  app.post("/api/notifications/rent-reminder", isAuthenticated, async (req: any, res) => {
    try {
      const { tenantId, leaseId } = req.body;
      
      const tenant = await storage.getTenantById(tenantId);
      const lease = await storage.getLeaseById(leaseId);
      
      if (!tenant || !lease) {
        return res.status(404).json({ message: "Tenant or lease not found" });
      }
      
      const unit = await storage.getUnitById(lease.unitId);
      const property = unit ? await storage.getPropertyById(unit.propertyId) : null;
      
      if (!unit || !property) {
        return res.status(404).json({ message: "Unit or property not found" });
      }
      
      const nextDueDate = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1);
      
      await emailService.sendRentReminder(
        tenant.email,
        `${tenant.firstName} ${tenant.lastName}`,
        parseFloat(lease.monthlyRent),
        nextDueDate,
        property.name,
        unit.unitNumber
      );
      
      res.json({ message: "Rent reminder sent successfully" });
    } catch (error) {
      console.error("Error sending rent reminder:", error);
      res.status(500).json({ message: "Failed to send rent reminder" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
