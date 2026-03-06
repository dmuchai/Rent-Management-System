import { Router } from "express";
import { isAuthenticated } from "../supabaseAuth";
import { pesapalService } from "../services/pesapalService";
import { db } from "../db";
import { sql } from "drizzle-orm";

const router = Router();
const ALLOWED_SETUP_ROLES = new Set(["admin", "landlord", "property_manager"]);
const SETUP_ROUTES_ENABLED =
  process.env.ENABLE_SETUP_ROUTES === "true" || process.env.NODE_ENV !== "production";

router.use(isAuthenticated);
router.use((req: any, res: any, next: any) => {
  if (!SETUP_ROUTES_ENABLED) {
    return res.status(404).json({ message: "Setup routes are disabled" });
  }

  if (!ALLOWED_SETUP_ROLES.has(req.user?.appRole)) {
    return res.status(403).json({ message: "Forbidden" });
  }

  next();
});

// POST /api/create-tables
router.post("/create-tables", async (_req: any, res: any) => {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT, role TEXT DEFAULT 'tenant',
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS properties (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, address TEXT NOT NULL, owner_id TEXT NOT NULL,
        property_type TEXT DEFAULT 'residential', created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS units (
        id TEXT PRIMARY KEY, unit_number TEXT NOT NULL, property_id TEXT NOT NULL,
        monthly_rent NUMERIC NOT NULL, is_occupied BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS tenants (
        id TEXT PRIMARY KEY, user_id TEXT, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
        email TEXT NOT NULL, phone TEXT, unit_id TEXT, property_id TEXT,
        landlord_id TEXT, status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS payments (
        id TEXT PRIMARY KEY, tenant_id TEXT NOT NULL, unit_id TEXT NOT NULL,
        amount NUMERIC NOT NULL, payment_date TIMESTAMP, status TEXT DEFAULT 'pending',
        payment_method TEXT, reference TEXT, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS maintenance_requests (
        id TEXT PRIMARY KEY, unit_id TEXT NOT NULL, tenant_id TEXT NOT NULL,
        title TEXT NOT NULL, description TEXT, priority TEXT DEFAULT 'medium',
        status TEXT DEFAULT 'open', assigned_to TEXT, completed_date TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )
    `);
    res.json({ message: "Tables created successfully" });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to create tables", error: error.message });
  }
});

// POST /api/create-tables-manual
router.post("/create-tables-manual", async (req: any, res: any) => {
  try {
    const { tableNames } = req.body;
    if (!Array.isArray(tableNames) || tableNames.length === 0) {
      return res.status(400).json({ message: "tableNames must be a non-empty array" });
    }

    const allowedTables = ["users", "properties", "units", "tenants", "payments", "maintenance_requests", "leases", "caretaker_assignments", "landlord_payment_channels"];
    const invalid = tableNames.filter((t: string) => !allowedTables.includes(t));
    if (invalid.length > 0) {
      return res.status(400).json({ message: `Invalid table names: ${invalid.join(", ")}` });
    }

    const results: Record<string, string> = {};
    for (const table of tableNames) {
      try {
        await db.execute(sql.raw(`SELECT 1 FROM ${table} LIMIT 1`));
        results[table] = "exists";
      } catch {
        results[table] = "not_found";
      }
    }

    res.json({ message: "Table status checked", results });
  } catch (error: any) {
    res.status(500).json({ message: "Failed to check tables", error: error.message });
  }
});

// GET /api/setup/register-pesapal-ipn
router.get("/setup/register-pesapal-ipn", async (req: any, res: any) => {
  try {
    const baseUrl = req.protocol + "://" + req.get("host");
    const ipnUrl = `${baseUrl}/api/payments/pesapal/ipn`;
    const result = await pesapalService.registerIPN(ipnUrl);
    res.json({ success: true, message: "Pesapal IPN registered", ipnUrl, result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: "Failed to register IPN", error: error.message });
  }
});

export default router;
