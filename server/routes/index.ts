import type { Express } from "express";
import { setupAuth } from "../supabaseAuth";
import { corsMiddleware } from "../middleware/cors";

import authRouter from "./auth";
import landlordRouter from "./landlord";
import propertiesRouter from "./properties";
import unitsRouter from "./units";
import tenantsRouter from "./tenants";
import caretakersRouter from "./caretakers";
import paymentsRouter from "./payments";
import reportsRouter from "./reports";
import leasesRouter from "./leases";
import maintenanceRouter from "./maintenance";
import dashboardRouter from "./dashboard";
import cronRouter from "./cron";
import adminRouter from "./admin";
import exportRouter from "./export";
import subscriptionRouter from "./subscription";

export async function registerRoutes(app: Express): Promise<void> {
  // Setup Supabase auth middleware
  setupAuth(app);

  // Apply CORS
  app.use(corsMiddleware);

  // Auth routes — individual endpoints mounted at root /api
  app.use("/api", authRouter);

  // Landlord payment channels
  app.use("/api/landlord", landlordRouter);

  // Properties & Units
  app.use("/api/properties", propertiesRouter);
  app.use("/api/units", unitsRouter);

  // Tenants
  app.use("/api/tenants", tenantsRouter);

  // Caretakers & invitations
  app.use("/api/caretakers", caretakersRouter);

  // Backward-compat alias: /api/caretaker-invitations → caretakersRouter /invitations/*
  // Note: req.url rewrite + next() won't work because Express re-checks mount paths.
  // Instead, invoke caretakersRouter directly as a function after rewriting the URL.
  app.use("/api/caretaker-invitations", (req, res, next) => {
    req.url =
      req.url === "/"          ? "/invitations" :
      req.url.startsWith("/?") ? "/invitations" + req.url.slice(1) :  // "/?x" → "/invitations?x"
                                 "/invitations" + req.url;             // "/resend" → "/invitations/resend"
    caretakersRouter(req, res, next);
  });

  // Payments
  app.use("/api/payments", paymentsRouter);

  // Reports
  app.use("/api/reports", reportsRouter);

  // Leases
  app.use("/api/leases", leasesRouter);

  // Maintenance requests
  app.use("/api/maintenance-requests", maintenanceRouter);

  // Dashboard
  app.use("/api/dashboard", dashboardRouter);

  // Essential account portability (available on every plan)
  app.use("/api/export", exportRouter);
  app.use("/api/subscription", subscriptionRouter);

  // Cron workers
  app.use("/api/cron", cronRouter);

  // Admin / setup utilities
  app.use("/api", adminRouter);
}
