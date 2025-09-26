"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc2) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc2 = __getOwnPropDesc(from, key)) || desc2.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server/index.ts
var import_dotenv2 = __toESM(require("dotenv"), 1);
var import_express2 = __toESM(require("express"), 1);
var import_http = require("http");

// server/supabaseAuth.ts
var import_dotenv = __toESM(require("dotenv"), 1);
var import_supabase_js = require("@supabase/supabase-js");
var import_jsonwebtoken = __toESM(require("jsonwebtoken"), 1);
import_dotenv.default.config();
var supabaseUrl = process.env.SUPABASE_URL;
var supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
console.log("Environment check:");
console.log("SUPABASE_URL:", supabaseUrl ? "loaded" : "missing");
console.log("SUPABASE_SERVICE_ROLE_KEY:", supabaseKey ? "loaded" : "missing");
if (!supabaseUrl || !supabaseKey) {
  throw new Error("Missing required Supabase environment variables");
}
var supabase = (0, import_supabase_js.createClient)(supabaseUrl, supabaseKey);
async function setupAuth(app2) {
}
var isAuthenticated = (req, res, next) => {
  let token = null;
  const authHeader = req.headers["authorization"];
  if (authHeader) {
    token = authHeader.split(" ")[1];
    console.log("Token found in Authorization header");
  } else if (req.cookies && req.cookies["supabase-auth-token"]) {
    token = req.cookies["supabase-auth-token"];
    console.log("Token found in cookie");
  }
  if (!token) {
    console.log("No token found in request");
    return res.status(401).json({ message: "Unauthorized" });
  }
  try {
    console.log("Verifying token...");
    const payload = import_jsonwebtoken.default.verify(token, process.env.SUPABASE_JWT_SECRET);
    console.log("Token verified successfully for user:", payload.sub);
    req.user = payload;
    next();
  } catch (err) {
    console.log("Token verification failed:", err instanceof Error ? err.message : "Unknown error");
    return res.status(401).json({ message: "Unauthorized" });
  }
};

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  documents: () => documents,
  documentsRelations: () => documentsRelations,
  insertDocumentSchema: () => insertDocumentSchema,
  insertLeaseSchema: () => insertLeaseSchema,
  insertMaintenanceRequestSchema: () => insertMaintenanceRequestSchema,
  insertPaymentSchema: () => insertPaymentSchema,
  insertPropertySchema: () => insertPropertySchema,
  insertTenantSchema: () => insertTenantSchema,
  insertUnitSchema: () => insertUnitSchema,
  insertUserSchema: () => insertUserSchema,
  leases: () => leases,
  leasesRelations: () => leasesRelations,
  maintenanceRequests: () => maintenanceRequests,
  maintenanceRequestsRelations: () => maintenanceRequestsRelations,
  paymentStatusEnum: () => paymentStatusEnum,
  payments: () => payments,
  paymentsRelations: () => paymentsRelations,
  properties: () => properties,
  propertiesRelations: () => propertiesRelations,
  sessions: () => sessions,
  tenants: () => tenants,
  tenantsRelations: () => tenantsRelations,
  units: () => units,
  unitsRelations: () => unitsRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
var import_drizzle_orm = require("drizzle-orm");
var import_pg_core = require("drizzle-orm/pg-core");
var import_drizzle_orm2 = require("drizzle-orm");
var import_drizzle_zod = require("drizzle-zod");
var sessions = (0, import_pg_core.pgTable)(
  "sessions",
  {
    sid: (0, import_pg_core.varchar)("sid").primaryKey(),
    sess: (0, import_pg_core.jsonb)("sess").notNull(),
    expire: (0, import_pg_core.timestamp)("expire").notNull()
  },
  (table) => [(0, import_pg_core.index)("IDX_session_expire").on(table.expire)]
);
var users = (0, import_pg_core.pgTable)("users", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  email: (0, import_pg_core.varchar)("email").unique(),
  firstName: (0, import_pg_core.varchar)("first_name"),
  lastName: (0, import_pg_core.varchar)("last_name"),
  profileImageUrl: (0, import_pg_core.varchar)("profile_image_url"),
  role: (0, import_pg_core.varchar)("role").notNull().default("landlord"),
  // landlord or property_manager
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var properties = (0, import_pg_core.pgTable)("properties", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  name: (0, import_pg_core.varchar)("name").notNull(),
  address: (0, import_pg_core.text)("address").notNull(),
  propertyType: (0, import_pg_core.varchar)("property_type").notNull(),
  // apartment, villa, house, etc.
  totalUnits: (0, import_pg_core.integer)("total_units").notNull(),
  description: (0, import_pg_core.text)("description"),
  imageUrl: (0, import_pg_core.varchar)("image_url"),
  ownerId: (0, import_pg_core.varchar)("owner_id").notNull().references(() => users.id),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var units = (0, import_pg_core.pgTable)("units", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  propertyId: (0, import_pg_core.varchar)("property_id").notNull().references(() => properties.id),
  unitNumber: (0, import_pg_core.varchar)("unit_number").notNull(),
  bedrooms: (0, import_pg_core.integer)("bedrooms"),
  bathrooms: (0, import_pg_core.integer)("bathrooms"),
  size: (0, import_pg_core.decimal)("size"),
  // square feet
  rentAmount: (0, import_pg_core.decimal)("rent_amount", { precision: 10, scale: 2 }).notNull(),
  isOccupied: (0, import_pg_core.boolean)("is_occupied").default(false),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var tenants = (0, import_pg_core.pgTable)("tenants", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  userId: (0, import_pg_core.varchar)("user_id").references(() => users.id),
  firstName: (0, import_pg_core.varchar)("first_name").notNull(),
  lastName: (0, import_pg_core.varchar)("last_name").notNull(),
  email: (0, import_pg_core.varchar)("email").notNull(),
  phone: (0, import_pg_core.varchar)("phone").notNull(),
  emergencyContact: (0, import_pg_core.varchar)("emergency_contact"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var leases = (0, import_pg_core.pgTable)("leases", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  tenantId: (0, import_pg_core.varchar)("tenant_id").notNull().references(() => tenants.id),
  unitId: (0, import_pg_core.varchar)("unit_id").notNull().references(() => units.id),
  startDate: (0, import_pg_core.timestamp)("start_date").notNull(),
  endDate: (0, import_pg_core.timestamp)("end_date").notNull(),
  monthlyRent: (0, import_pg_core.decimal)("monthly_rent", { precision: 10, scale: 2 }).notNull(),
  securityDeposit: (0, import_pg_core.decimal)("security_deposit", { precision: 10, scale: 2 }),
  leaseDocumentUrl: (0, import_pg_core.varchar)("lease_document_url"),
  isActive: (0, import_pg_core.boolean)("is_active").default(true),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var paymentStatusEnum = (0, import_pg_core.pgEnum)("payment_status", [
  "pending",
  "completed",
  "failed",
  "cancelled"
]);
var payments = (0, import_pg_core.pgTable)("payments", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  leaseId: (0, import_pg_core.varchar)("lease_id").notNull().references(() => leases.id),
  amount: (0, import_pg_core.decimal)("amount", { precision: 10, scale: 2 }).notNull(),
  dueDate: (0, import_pg_core.timestamp)("due_date").notNull(),
  paidDate: (0, import_pg_core.timestamp)("paid_date"),
  paymentMethod: (0, import_pg_core.varchar)("payment_method"),
  // mpesa, card, bank_transfer
  pesapalTransactionId: (0, import_pg_core.varchar)("pesapal_transaction_id"),
  pesapalOrderTrackingId: (0, import_pg_core.varchar)("pesapal_order_tracking_id"),
  status: paymentStatusEnum("status").default("pending"),
  description: (0, import_pg_core.text)("description"),
  receiptUrl: (0, import_pg_core.varchar)("receipt_url"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var maintenanceRequests = (0, import_pg_core.pgTable)("maintenance_requests", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  unitId: (0, import_pg_core.varchar)("unit_id").notNull().references(() => units.id),
  tenantId: (0, import_pg_core.varchar)("tenant_id").notNull().references(() => tenants.id),
  title: (0, import_pg_core.varchar)("title").notNull(),
  description: (0, import_pg_core.text)("description").notNull(),
  priority: (0, import_pg_core.varchar)("priority").notNull().default("medium"),
  // low, medium, high, urgent
  status: (0, import_pg_core.varchar)("status").notNull().default("open"),
  // open, in_progress, completed, cancelled
  assignedTo: (0, import_pg_core.varchar)("assigned_to"),
  completedDate: (0, import_pg_core.timestamp)("completed_date"),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var documents = (0, import_pg_core.pgTable)("documents", {
  id: (0, import_pg_core.varchar)("id").primaryKey().default(import_drizzle_orm.sql`gen_random_uuid()`),
  name: (0, import_pg_core.varchar)("name").notNull(),
  fileUrl: (0, import_pg_core.varchar)("file_url").notNull(),
  fileSize: (0, import_pg_core.integer)("file_size"),
  fileType: (0, import_pg_core.varchar)("file_type"),
  category: (0, import_pg_core.varchar)("category").notNull(),
  // lease, property, maintenance, financial
  relatedId: (0, import_pg_core.varchar)("related_id"),
  // ID of related entity (lease, property, etc.)
  relatedType: (0, import_pg_core.varchar)("related_type"),
  // lease, property, maintenance, etc.
  uploadedBy: (0, import_pg_core.varchar)("uploaded_by").notNull().references(() => users.id),
  createdAt: (0, import_pg_core.timestamp)("created_at").defaultNow(),
  updatedAt: (0, import_pg_core.timestamp)("updated_at").defaultNow()
});
var usersRelations = (0, import_drizzle_orm2.relations)(users, ({ many }) => ({
  properties: many(properties),
  documents: many(documents)
}));
var propertiesRelations = (0, import_drizzle_orm2.relations)(properties, ({ one, many }) => ({
  owner: one(users, {
    fields: [properties.ownerId],
    references: [users.id]
  }),
  units: many(units)
}));
var unitsRelations = (0, import_drizzle_orm2.relations)(units, ({ one, many }) => ({
  property: one(properties, {
    fields: [units.propertyId],
    references: [properties.id]
  }),
  leases: many(leases),
  maintenanceRequests: many(maintenanceRequests)
}));
var tenantsRelations = (0, import_drizzle_orm2.relations)(tenants, ({ one, many }) => ({
  user: one(users, {
    fields: [tenants.userId],
    references: [users.id]
  }),
  leases: many(leases),
  maintenanceRequests: many(maintenanceRequests)
}));
var leasesRelations = (0, import_drizzle_orm2.relations)(leases, ({ one, many }) => ({
  tenant: one(tenants, {
    fields: [leases.tenantId],
    references: [tenants.id]
  }),
  unit: one(units, {
    fields: [leases.unitId],
    references: [units.id]
  }),
  payments: many(payments)
}));
var paymentsRelations = (0, import_drizzle_orm2.relations)(payments, ({ one }) => ({
  lease: one(leases, {
    fields: [payments.leaseId],
    references: [leases.id]
  })
}));
var maintenanceRequestsRelations = (0, import_drizzle_orm2.relations)(maintenanceRequests, ({ one }) => ({
  unit: one(units, {
    fields: [maintenanceRequests.unitId],
    references: [units.id]
  }),
  tenant: one(tenants, {
    fields: [maintenanceRequests.tenantId],
    references: [tenants.id]
  })
}));
var documentsRelations = (0, import_drizzle_orm2.relations)(documents, ({ one }) => ({
  uploadedBy: one(users, {
    fields: [documents.uploadedBy],
    references: [users.id]
  })
}));
var insertUserSchema = (0, import_drizzle_zod.createInsertSchema)(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertPropertySchema = (0, import_drizzle_zod.createInsertSchema)(properties).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertUnitSchema = (0, import_drizzle_zod.createInsertSchema)(units).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertTenantSchema = (0, import_drizzle_zod.createInsertSchema)(tenants).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertLeaseSchema = (0, import_drizzle_zod.createInsertSchema)(leases).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertPaymentSchema = (0, import_drizzle_zod.createInsertSchema)(payments).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertMaintenanceRequestSchema = (0, import_drizzle_zod.createInsertSchema)(maintenanceRequests).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertDocumentSchema = (0, import_drizzle_zod.createInsertSchema)(documents).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});

// server/db.ts
var import_postgres_js = require("drizzle-orm/postgres-js");
var import_postgres = __toESM(require("postgres"), 1);
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var connectionString = process.env.DATABASE_URL.replace(":6543/", ":5432/");
console.log("Connecting to database...");
var client = (0, import_postgres.default)(connectionString, {
  prepare: false,
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10
});
var db = (0, import_postgres_js.drizzle)(client, { schema: schema_exports });

// server/storage.ts
var import_drizzle_orm3 = require("drizzle-orm");
var SupabaseStorage = class {
  // Unit operations
  async getUnitsByPropertyId(propertyId) {
    const { data, error } = await supabase.from("units").select("*").eq("property_id", propertyId).order("unit_number", { ascending: true });
    if (error) throw error;
    const units2 = data?.map((unit) => ({
      id: unit.id,
      propertyId: unit.property_id,
      unitNumber: unit.unit_number,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      size: unit.size,
      rentAmount: unit.rent_amount,
      isOccupied: unit.is_occupied,
      createdAt: unit.created_at,
      updatedAt: unit.updated_at
    })) || [];
    return units2;
  }
  async getUnitById(id) {
    const { data, error } = await supabase.from("units").select("*").eq("id", id).single();
    if (error) {
      console.log("getUnitById error:", error);
      return void 0;
    }
    if (!data) return void 0;
    const unit = {
      id: data.id,
      propertyId: data.property_id,
      unitNumber: data.unit_number,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      size: data.size,
      rentAmount: data.rent_amount,
      isOccupied: data.is_occupied,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    return unit;
  }
  async createUnit(unit) {
    const unitData = {
      property_id: unit.propertyId,
      unit_number: unit.unitNumber,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      size: unit.size,
      rent_amount: unit.rentAmount,
      is_occupied: unit.isOccupied || false
    };
    console.log("Inserting unit data to Supabase:", unitData);
    const { data, error } = await supabase.from("units").insert(unitData).select().single();
    if (error) {
      console.error("Supabase unit creation error:", error);
      throw error;
    }
    console.log("Supabase unit created:", data);
    const mappedUnit = {
      id: data.id,
      propertyId: data.property_id,
      unitNumber: data.unit_number,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      size: data.size,
      rentAmount: data.rent_amount,
      isOccupied: data.is_occupied,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    return mappedUnit;
  }
  async updateUnit(id, unit) {
    const updateData = {};
    if (unit.propertyId !== void 0) updateData.property_id = unit.propertyId;
    if (unit.unitNumber !== void 0) updateData.unit_number = unit.unitNumber;
    if (unit.bedrooms !== void 0) updateData.bedrooms = unit.bedrooms;
    if (unit.bathrooms !== void 0) updateData.bathrooms = unit.bathrooms;
    if (unit.size !== void 0) updateData.size = unit.size;
    if (unit.rentAmount !== void 0) updateData.rent_amount = unit.rentAmount;
    if (unit.isOccupied !== void 0) updateData.is_occupied = unit.isOccupied;
    updateData.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    console.log("Updating unit data to Supabase:", updateData);
    const { data, error } = await supabase.from("units").update(updateData).eq("id", id).select().single();
    if (error) {
      console.error("Supabase unit update error:", error);
      throw error;
    }
    console.log("Supabase unit updated:", data);
    const updatedUnit = {
      id: data.id,
      propertyId: data.property_id,
      unitNumber: data.unit_number,
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      size: data.size,
      rentAmount: data.rent_amount,
      isOccupied: data.is_occupied,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    return updatedUnit;
  }
  async deleteUnit(id) {
  }
  // Lease operations
  async getLeasesByOwnerId(ownerId) {
    try {
      console.log("Fetching leases for owner:", ownerId);
      const { data: properties2, error: propertiesError } = await supabase.from("properties").select("id").eq("owner_id", ownerId);
      if (propertiesError) {
        console.error("Error fetching properties:", propertiesError);
        throw propertiesError;
      }
      if (!properties2 || properties2.length === 0) {
        console.log("No properties found for owner:", ownerId);
        return [];
      }
      const propertyIds = properties2.map((p) => p.id);
      console.log("Found property IDs:", propertyIds);
      const { data: units2, error: unitsError } = await supabase.from("units").select("id").in("property_id", propertyIds);
      if (unitsError) {
        console.error("Error fetching units:", unitsError);
        throw unitsError;
      }
      if (!units2 || units2.length === 0) {
        console.log("No units found in properties");
        return [];
      }
      const unitIds = units2.map((u) => u.id);
      console.log("Found unit IDs:", unitIds);
      const { data: leases2, error: leasesError } = await supabase.from("leases").select("*").in("unit_id", unitIds).order("created_at", { ascending: false });
      if (leasesError) {
        console.error("Error fetching leases:", leasesError);
        throw leasesError;
      }
      if (!leases2 || leases2.length === 0) {
        console.log("No leases found for units");
        return [];
      }
      console.log("Fetched leases from Supabase:", leases2.length);
      const leasesWithRelatedData = await Promise.all(
        leases2.map(async (lease) => {
          const unit = await this.getUnitById(lease.unit_id);
          const tenant = await this.getTenantById(lease.tenant_id);
          const property = unit ? await this.getPropertyById(unit.propertyId) : null;
          return {
            id: lease.id,
            tenantId: lease.tenant_id,
            unitId: lease.unit_id,
            startDate: lease.start_date,
            endDate: lease.end_date,
            monthlyRent: lease.monthly_rent,
            securityDeposit: lease.security_deposit,
            leaseDocumentUrl: lease.lease_document_url,
            isActive: lease.is_active,
            createdAt: lease.created_at,
            updatedAt: lease.updated_at,
            // Include related data for display
            unit: unit ? {
              id: unit.id,
              unitNumber: unit.unitNumber,
              propertyName: property?.name || "Unknown Property"
            } : null,
            tenant: tenant ? {
              id: tenant.id,
              firstName: tenant.firstName,
              lastName: tenant.lastName,
              email: tenant.email
            } : null
          };
        })
      );
      return leasesWithRelatedData;
    } catch (error) {
      console.error("Error in getLeasesByOwnerId:", error);
      return [];
    }
  }
  async getLeasesByTenantId(tenantId) {
    try {
      console.log("Fetching leases for tenant:", tenantId);
      const { data: leases2, error } = await supabase.from("leases").select("*").eq("tenant_id", tenantId).order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching leases by tenant:", error);
        throw error;
      }
      if (!leases2 || leases2.length === 0) {
        console.log("No leases found for tenant:", tenantId);
        return [];
      }
      console.log("Fetched leases for tenant:", leases2.length);
      const leasesWithRelatedData = await Promise.all(
        leases2.map(async (lease) => {
          const unit = await this.getUnitById(lease.unit_id);
          const tenant = await this.getTenantById(lease.tenant_id);
          const property = unit ? await this.getPropertyById(unit.propertyId) : null;
          return {
            id: lease.id,
            tenantId: lease.tenant_id,
            unitId: lease.unit_id,
            startDate: lease.start_date,
            endDate: lease.end_date,
            monthlyRent: lease.monthly_rent,
            securityDeposit: lease.security_deposit,
            leaseDocumentUrl: lease.lease_document_url,
            isActive: lease.is_active,
            createdAt: lease.created_at,
            updatedAt: lease.updated_at,
            // Include related data for display
            unit: unit ? {
              id: unit.id,
              unitNumber: unit.unitNumber,
              propertyName: property?.name || "Unknown Property"
            } : null,
            tenant: tenant ? {
              id: tenant.id,
              firstName: tenant.firstName,
              lastName: tenant.lastName,
              email: tenant.email
            } : null
          };
        })
      );
      return leasesWithRelatedData;
    } catch (error) {
      console.error("Error in getLeasesByTenantId:", error);
      return [];
    }
  }
  async getLeaseById(id) {
    return void 0;
  }
  async createLease(lease) {
    const leaseData = {
      tenant_id: lease.tenantId,
      unit_id: lease.unitId,
      start_date: lease.startDate,
      end_date: lease.endDate,
      monthly_rent: lease.monthlyRent,
      security_deposit: lease.securityDeposit,
      lease_document_url: lease.leaseDocumentUrl,
      is_active: lease.isActive
    };
    console.log("Inserting lease data to Supabase:", leaseData);
    const { data, error } = await supabase.from("leases").insert(leaseData).select().single();
    if (error) {
      console.error("Supabase lease creation error:", error);
      throw error;
    }
    console.log("Supabase lease created:", data);
    const createdLease = {
      id: data.id,
      tenantId: data.tenant_id,
      unitId: data.unit_id,
      startDate: data.start_date,
      endDate: data.end_date,
      monthlyRent: data.monthly_rent,
      securityDeposit: data.security_deposit,
      leaseDocumentUrl: data.lease_document_url,
      isActive: data.is_active,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    return createdLease;
  }
  async updateLease(id, lease) {
    return lease;
  }
  async deleteLease(id) {
  }
  // Maintenance request operations
  async getMaintenanceRequestsByOwnerId(ownerId) {
    return [];
  }
  async createMaintenanceRequest(request) {
    return request;
  }
  // Document operations
  async getDocumentsByOwnerId(ownerId) {
    return [];
  }
  async createDocument(document) {
    return document;
  }
  // Tenants CRUD
  async getTenantsByOwnerId(ownerId) {
    console.log("getTenantsByOwnerId called for owner:", ownerId);
    const { data, error } = await supabase.from("tenants").select("*").eq("user_id", ownerId).order("created_at", { ascending: true });
    if (error) {
      console.log("Error fetching tenants:", error);
      throw error;
    }
    console.log("Found tenants:", data?.length || 0);
    const mappedTenants = data?.map((tenant) => ({
      id: tenant.id,
      userId: tenant.user_id,
      firstName: tenant.first_name,
      lastName: tenant.last_name,
      email: tenant.email,
      phone: tenant.phone,
      emergencyContact: tenant.emergency_contact,
      createdAt: tenant.created_at,
      updatedAt: tenant.updated_at
    })) || [];
    return mappedTenants;
  }
  async getTenantById(id) {
    const { data, error } = await supabase.from("tenants").select("*").eq("id", id).single();
    if (error) {
      console.log("getTenantById error:", error);
      return void 0;
    }
    if (!data) return void 0;
    const tenant = {
      id: data.id,
      userId: data.user_id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      phone: data.phone,
      emergencyContact: data.emergency_contact,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    return tenant;
  }
  async createTenant(tenant, landlordId) {
    const dbTenant = {
      user_id: landlordId || tenant.userId,
      // Use landlord ID for association
      first_name: tenant.firstName,
      last_name: tenant.lastName,
      email: tenant.email,
      phone: tenant.phone,
      emergency_contact: tenant.emergencyContact
    };
    const { data, error } = await supabase.from("tenants").insert([dbTenant]).select().single();
    if (error) throw error;
    return data;
  }
  async updateTenant(id, tenant) {
    const { data, error } = await supabase.from("tenants").update({ ...tenant, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }
  async deleteTenant(id) {
    const { error } = await supabase.from("tenants").delete().eq("id", id);
    if (error) throw error;
  }
  // Payments CRUD
  async getPaymentsByOwnerId(ownerId) {
    try {
      const { data: tenants2, error: tenantsError } = await supabase.from("tenants").select("id").eq("user_id", ownerId);
      if (tenantsError) throw tenantsError;
      if (!tenants2 || tenants2.length === 0) return [];
      const tenantIds = tenants2.map((t) => t.id);
      const { data: leases2, error: leasesError } = await supabase.from("leases").select("id").in("tenant_id", tenantIds);
      if (leasesError) throw leasesError;
      if (!leases2 || leases2.length === 0) return [];
      const leaseIds = leases2.map((l) => l.id);
      const { data: payments2, error: paymentsError } = await supabase.from("payments").select("*").in("lease_id", leaseIds).order("due_date", { ascending: false });
      if (paymentsError) throw paymentsError;
      const mappedPayments = (payments2 || []).map((payment) => ({
        id: payment.id,
        leaseId: payment.lease_id,
        amount: payment.amount,
        dueDate: payment.due_date,
        paidDate: payment.paid_date,
        paymentMethod: payment.payment_method,
        pesapalTransactionId: payment.pesapal_transaction_id,
        pesapalOrderTrackingId: payment.pesapal_order_tracking_id,
        status: payment.status,
        description: payment.description,
        receiptUrl: payment.receipt_url,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at
      }));
      return mappedPayments;
    } catch (error) {
      console.error("Error in getPaymentsByOwnerId:", error);
      return [];
    }
  }
  async getPaymentById(id) {
    const { data, error } = await supabase.from("payments").select("*").eq("id", id).single();
    if (error) throw error;
    if (!data) return void 0;
    const payment = {
      id: data.id,
      leaseId: data.lease_id,
      amount: data.amount,
      dueDate: data.due_date,
      paidDate: data.paid_date,
      paymentMethod: data.payment_method,
      pesapalTransactionId: data.pesapal_transaction_id,
      pesapalOrderTrackingId: data.pesapal_order_tracking_id,
      status: data.status,
      description: data.description,
      receiptUrl: data.receipt_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    return payment;
  }
  async createPayment(payment) {
    const paymentData = {
      lease_id: payment.leaseId,
      amount: payment.amount,
      due_date: payment.dueDate,
      paid_date: payment.paidDate,
      payment_method: payment.paymentMethod,
      pesapal_transaction_id: payment.pesapalTransactionId,
      pesapal_order_tracking_id: payment.pesapalOrderTrackingId,
      status: payment.status,
      description: payment.description,
      receipt_url: payment.receiptUrl
    };
    console.log("Creating payment with data:", paymentData);
    const { data, error } = await supabase.from("payments").insert([paymentData]).select().single();
    if (error) {
      console.error("Payment creation error:", error);
      throw error;
    }
    console.log("Payment created:", data);
    const createdPayment = {
      id: data.id,
      leaseId: data.lease_id,
      amount: data.amount,
      dueDate: data.due_date,
      paidDate: data.paid_date,
      paymentMethod: data.payment_method,
      pesapalTransactionId: data.pesapal_transaction_id,
      pesapalOrderTrackingId: data.pesapal_order_tracking_id,
      status: data.status,
      description: data.description,
      receiptUrl: data.receipt_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    return createdPayment;
  }
  async updatePayment(id, payment) {
    const { data, error } = await supabase.from("payments").update({ ...payment, updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", id).select().single();
    if (error) throw error;
    return data;
  }
  async deletePayment(id) {
    const { error } = await supabase.from("payments").delete().eq("id", id);
    if (error) throw error;
  }
  // Get properties by owner
  async getPropertiesByOwnerId(ownerId) {
    const { data: propertiesData, error: propertiesError } = await supabase.from("properties").select("*").eq("owner_id", ownerId).order("name", { ascending: true });
    if (propertiesError) throw propertiesError;
    console.log("Raw property data from DB:", {
      ownerId,
      dataCount: propertiesData?.length || 0,
      firstPropertyRaw: propertiesData?.[0] ? Object.keys(propertiesData[0]) : "none",
      firstPropertyData: propertiesData?.[0]
    });
    if (!propertiesData || propertiesData.length === 0) {
      return [];
    }
    const propertiesWithUnits = await Promise.all(
      propertiesData.map(async (property) => {
        const units2 = await this.getUnitsByPropertyId(property.id);
        return {
          // Convert snake_case to camelCase for consistency
          id: property.id,
          ownerId: property.owner_id,
          name: property.name,
          address: property.address,
          propertyType: property.property_type,
          totalUnits: property.total_units,
          description: property.description,
          imageUrl: property.image_url,
          createdAt: property.created_at,
          updatedAt: property.updated_at,
          units: units2
          // Include units
        };
      })
    );
    return propertiesWithUnits;
  }
  // Get property by ID
  async getPropertyById(id) {
    const { data, error } = await supabase.from("properties").select("*").eq("id", id).single();
    if (error) {
      console.log("getPropertyById error:", error);
      return void 0;
    }
    if (!data) return void 0;
    const property = {
      id: data.id,
      ownerId: data.owner_id,
      name: data.name,
      address: data.address,
      propertyType: data.property_type,
      totalUnits: data.total_units,
      description: data.description,
      imageUrl: data.image_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    return property;
  }
  // Create property
  async createProperty(property) {
    const propertyData = {
      name: property.name,
      address: property.address,
      property_type: property.propertyType,
      total_units: property.totalUnits,
      description: property.description,
      owner_id: property.ownerId
      // Note: imageUrl excluded as the column doesn't exist in the current database schema
    };
    const { data, error } = await supabase.from("properties").insert([propertyData]).select().single();
    if (error) {
      console.error("Error creating property:", error);
      throw error;
    }
    return data;
  }
  // Update property
  async updateProperty(id, property) {
    const updateData = {
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (property.name) updateData.name = property.name;
    if (property.address) updateData.address = property.address;
    if (property.propertyType) updateData.property_type = property.propertyType;
    if (property.totalUnits) updateData.total_units = property.totalUnits;
    if (property.description) updateData.description = property.description;
    if (property.ownerId) updateData.owner_id = property.ownerId;
    const { data, error } = await supabase.from("properties").update(updateData).eq("id", id).select().single();
    if (error) {
      console.error("Error updating property:", error);
      throw error;
    }
    return data;
  }
  // Delete property
  async deleteProperty(id) {
    const { error } = await supabase.from("properties").delete().eq("id", id);
    if (error) throw error;
  }
  // User operations
  async getUser(id) {
    const { data, error } = await supabase.from("users").select("*").eq("id", id).single();
    if (error) {
      if (error.code === "PGRST116") {
        return void 0;
      }
      throw error;
    }
    const user = {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      profileImageUrl: data.profile_image_url,
      role: data.role,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    return user;
  }
  async upsertUser(userData) {
    const dbUserData = {
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (userData.firstName !== void 0) {
      dbUserData.first_name = userData.firstName;
    }
    if (userData.lastName !== void 0) {
      dbUserData.last_name = userData.lastName;
    }
    if (userData.email !== void 0) {
      dbUserData.email = userData.email;
    }
    if (userData.profileImageUrl !== void 0) {
      dbUserData.profile_image_url = userData.profileImageUrl;
    }
    if (userData.role !== void 0) {
      dbUserData.role = userData.role;
    }
    const { data, error } = await supabase.from("users").upsert(dbUserData, { onConflict: "email" }).select().single();
    if (error) throw error;
    const user = {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      profileImageUrl: data.profile_image_url,
      role: data.role,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    return user;
  }
  async updateUser(id, userData) {
    const dbUserData = {
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    if (userData.firstName !== void 0) {
      dbUserData.first_name = userData.firstName;
    }
    if (userData.lastName !== void 0) {
      dbUserData.last_name = userData.lastName;
    }
    if (userData.email !== void 0) {
      dbUserData.email = userData.email;
    }
    if (userData.profileImageUrl !== void 0) {
      dbUserData.profile_image_url = userData.profileImageUrl;
    }
    if (userData.role !== void 0) {
      dbUserData.role = userData.role;
    }
    const { data, error } = await supabase.from("users").update(dbUserData).eq("id", id).select().single();
    if (error) throw error;
    const user = {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      profileImageUrl: data.profile_image_url,
      role: data.role,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
    return user;
  }
};
var DatabaseStorage = class {
  // User operations
  async getUser(id) {
    const [user] = await db.select().from(users).where((0, import_drizzle_orm3.eq)(users.id, id));
    return user;
  }
  async upsertUser(userData) {
    const [user] = await db.insert(users).values(userData).onConflictDoUpdate({
      target: users.email,
      set: {
        ...userData,
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    return user;
  }
  async updateUser(id, userData) {
    const [user] = await db.update(users).set({
      ...userData,
      updatedAt: /* @__PURE__ */ new Date()
    }).where((0, import_drizzle_orm3.eq)(users.id, id)).returning();
    if (!user) {
      throw new Error("User not found");
    }
    return user;
  }
  // Property operations
  async getPropertiesByOwnerId(ownerId) {
    return await db.select().from(properties).where((0, import_drizzle_orm3.eq)(properties.ownerId, ownerId)).orderBy((0, import_drizzle_orm3.asc)(properties.name));
  }
  async getPropertyById(id) {
    const [property] = await db.select().from(properties).where((0, import_drizzle_orm3.eq)(properties.id, id));
    return property;
  }
  async createProperty(property) {
    const [newProperty] = await db.insert(properties).values(property).returning();
    return newProperty;
  }
  async updateProperty(id, property) {
    const [updatedProperty] = await db.update(properties).set({ ...property, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm3.eq)(properties.id, id)).returning();
    return updatedProperty;
  }
  async deleteProperty(id) {
    await db.delete(properties).where((0, import_drizzle_orm3.eq)(properties.id, id));
  }
  // Unit operations
  async getUnitsByPropertyId(propertyId) {
    return await db.select().from(units).where((0, import_drizzle_orm3.eq)(units.propertyId, propertyId)).orderBy((0, import_drizzle_orm3.asc)(units.unitNumber));
  }
  async getUnitById(id) {
    const [unit] = await db.select().from(units).where((0, import_drizzle_orm3.eq)(units.id, id));
    return unit;
  }
  async createUnit(unit) {
    const [newUnit] = await db.insert(units).values(unit).returning();
    return newUnit;
  }
  async updateUnit(id, unit) {
    const [updatedUnit] = await db.update(units).set({ ...unit, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm3.eq)(units.id, id)).returning();
    return updatedUnit;
  }
  async deleteUnit(id) {
    await db.delete(units).where((0, import_drizzle_orm3.eq)(units.id, id));
  }
  // Tenant operations
  async getTenantsByOwnerId(ownerId) {
    return await db.select({
      id: tenants.id,
      userId: tenants.userId,
      firstName: tenants.firstName,
      lastName: tenants.lastName,
      email: tenants.email,
      phone: tenants.phone,
      emergencyContact: tenants.emergencyContact,
      createdAt: tenants.createdAt,
      updatedAt: tenants.updatedAt
    }).from(tenants).innerJoin(leases, (0, import_drizzle_orm3.eq)(tenants.id, leases.tenantId)).innerJoin(units, (0, import_drizzle_orm3.eq)(leases.unitId, units.id)).innerJoin(properties, (0, import_drizzle_orm3.eq)(units.propertyId, properties.id)).where((0, import_drizzle_orm3.eq)(properties.ownerId, ownerId)).orderBy((0, import_drizzle_orm3.asc)(tenants.lastName));
  }
  async getTenantById(id) {
    const [tenant] = await db.select().from(tenants).where((0, import_drizzle_orm3.eq)(tenants.id, id));
    return tenant;
  }
  async getTenantByUserId(userId) {
    const [tenant] = await db.select().from(tenants).where((0, import_drizzle_orm3.eq)(tenants.userId, userId));
    return tenant;
  }
  async createTenant(tenant) {
    const [newTenant] = await db.insert(tenants).values(tenant).returning();
    return newTenant;
  }
  async updateTenant(id, tenant) {
    const [updatedTenant] = await db.update(tenants).set({ ...tenant, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm3.eq)(tenants.id, id)).returning();
    return updatedTenant;
  }
  async deleteTenant(id) {
    await db.delete(tenants).where((0, import_drizzle_orm3.eq)(tenants.id, id));
  }
  // Lease operations
  async getLeasesByOwnerId(ownerId) {
    return await db.select({
      id: leases.id,
      tenantId: leases.tenantId,
      unitId: leases.unitId,
      startDate: leases.startDate,
      endDate: leases.endDate,
      monthlyRent: leases.monthlyRent,
      securityDeposit: leases.securityDeposit,
      leaseDocumentUrl: leases.leaseDocumentUrl,
      isActive: leases.isActive,
      createdAt: leases.createdAt,
      updatedAt: leases.updatedAt
    }).from(leases).innerJoin(units, (0, import_drizzle_orm3.eq)(leases.unitId, units.id)).innerJoin(properties, (0, import_drizzle_orm3.eq)(units.propertyId, properties.id)).where((0, import_drizzle_orm3.eq)(properties.ownerId, ownerId)).orderBy((0, import_drizzle_orm3.desc)(leases.createdAt));
  }
  async getLeasesByTenantId(tenantId) {
    return await db.select().from(leases).where((0, import_drizzle_orm3.eq)(leases.tenantId, tenantId)).orderBy((0, import_drizzle_orm3.desc)(leases.createdAt));
  }
  async getLeaseById(id) {
    const [lease] = await db.select().from(leases).where((0, import_drizzle_orm3.eq)(leases.id, id));
    return lease;
  }
  async getActiveLeaseByUnitId(unitId) {
    const [lease] = await db.select().from(leases).where((0, import_drizzle_orm3.and)((0, import_drizzle_orm3.eq)(leases.unitId, unitId), (0, import_drizzle_orm3.eq)(leases.isActive, true)));
    return lease;
  }
  async createLease(lease) {
    const [newLease] = await db.insert(leases).values(lease).returning();
    return newLease;
  }
  async updateLease(id, lease) {
    const [updatedLease] = await db.update(leases).set({ ...lease, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm3.eq)(leases.id, id)).returning();
    return updatedLease;
  }
  async deleteLease(id) {
    await db.delete(leases).where((0, import_drizzle_orm3.eq)(leases.id, id));
  }
  // Payment operations
  async getPaymentsByOwnerId(ownerId) {
    return await db.select({
      id: payments.id,
      leaseId: payments.leaseId,
      amount: payments.amount,
      dueDate: payments.dueDate,
      paidDate: payments.paidDate,
      paymentMethod: payments.paymentMethod,
      pesapalTransactionId: payments.pesapalTransactionId,
      pesapalOrderTrackingId: payments.pesapalOrderTrackingId,
      status: payments.status,
      description: payments.description,
      receiptUrl: payments.receiptUrl,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt
    }).from(payments).innerJoin(leases, (0, import_drizzle_orm3.eq)(payments.leaseId, leases.id)).innerJoin(units, (0, import_drizzle_orm3.eq)(leases.unitId, units.id)).innerJoin(properties, (0, import_drizzle_orm3.eq)(units.propertyId, properties.id)).where((0, import_drizzle_orm3.eq)(properties.ownerId, ownerId)).orderBy((0, import_drizzle_orm3.desc)(payments.dueDate));
  }
  async getPaymentsByLeaseId(leaseId) {
    return await db.select().from(payments).where((0, import_drizzle_orm3.eq)(payments.leaseId, leaseId)).orderBy((0, import_drizzle_orm3.desc)(payments.dueDate));
  }
  async getPaymentById(id) {
    const [payment] = await db.select().from(payments).where((0, import_drizzle_orm3.eq)(payments.id, id));
    return payment;
  }
  async getPaymentByPesapalId(pesapalId) {
    const [payment] = await db.select().from(payments).where((0, import_drizzle_orm3.eq)(payments.pesapalOrderTrackingId, pesapalId));
    return payment;
  }
  async createPayment(payment) {
    const [newPayment] = await db.insert(payments).values(payment).returning();
    return newPayment;
  }
  async updatePayment(id, payment) {
    const [updatedPayment] = await db.update(payments).set({ ...payment, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm3.eq)(payments.id, id)).returning();
    return updatedPayment;
  }
  async getOverduePayments(ownerId) {
    const today = /* @__PURE__ */ new Date();
    return await db.select({
      id: payments.id,
      leaseId: payments.leaseId,
      amount: payments.amount,
      dueDate: payments.dueDate,
      paidDate: payments.paidDate,
      paymentMethod: payments.paymentMethod,
      pesapalTransactionId: payments.pesapalTransactionId,
      pesapalOrderTrackingId: payments.pesapalOrderTrackingId,
      status: payments.status,
      description: payments.description,
      receiptUrl: payments.receiptUrl,
      createdAt: payments.createdAt,
      updatedAt: payments.updatedAt
    }).from(payments).innerJoin(leases, (0, import_drizzle_orm3.eq)(payments.leaseId, leases.id)).innerJoin(units, (0, import_drizzle_orm3.eq)(leases.unitId, units.id)).innerJoin(properties, (0, import_drizzle_orm3.eq)(units.propertyId, properties.id)).where(
      (0, import_drizzle_orm3.and)(
        (0, import_drizzle_orm3.eq)(properties.ownerId, ownerId),
        (0, import_drizzle_orm3.eq)(payments.status, "pending"),
        import_drizzle_orm3.sql`${payments.dueDate} < ${today}`
      )
    );
  }
  async getPaymentStats(ownerId, startDate, endDate) {
    const results = await db.select({
      totalExpected: import_drizzle_orm3.sql`SUM(${payments.amount})`,
      totalCollected: import_drizzle_orm3.sql`SUM(CASE WHEN ${payments.status} = 'completed' THEN ${payments.amount} ELSE 0 END)`,
      totalOverdue: import_drizzle_orm3.sql`SUM(CASE WHEN ${payments.status} = 'pending' AND ${payments.dueDate} < NOW() THEN ${payments.amount} ELSE 0 END)`
    }).from(payments).innerJoin(leases, (0, import_drizzle_orm3.eq)(payments.leaseId, leases.id)).innerJoin(units, (0, import_drizzle_orm3.eq)(leases.unitId, units.id)).innerJoin(properties, (0, import_drizzle_orm3.eq)(units.propertyId, properties.id)).where(
      (0, import_drizzle_orm3.and)(
        (0, import_drizzle_orm3.eq)(properties.ownerId, ownerId),
        (0, import_drizzle_orm3.between)(payments.dueDate, startDate, endDate)
      )
    );
    const stats = results[0];
    const totalExpected = Number(stats.totalExpected) || 0;
    const totalCollected = Number(stats.totalCollected) || 0;
    const totalOverdue = Number(stats.totalOverdue) || 0;
    const collectionRate = totalExpected > 0 ? totalCollected / totalExpected * 100 : 0;
    return {
      totalExpected,
      totalCollected,
      totalOverdue,
      collectionRate
    };
  }
  // Maintenance request operations
  async getMaintenanceRequestsByOwnerId(ownerId) {
    return await db.select({
      id: maintenanceRequests.id,
      unitId: maintenanceRequests.unitId,
      tenantId: maintenanceRequests.tenantId,
      title: maintenanceRequests.title,
      description: maintenanceRequests.description,
      priority: maintenanceRequests.priority,
      status: maintenanceRequests.status,
      assignedTo: maintenanceRequests.assignedTo,
      completedDate: maintenanceRequests.completedDate,
      createdAt: maintenanceRequests.createdAt,
      updatedAt: maintenanceRequests.updatedAt
    }).from(maintenanceRequests).innerJoin(units, (0, import_drizzle_orm3.eq)(maintenanceRequests.unitId, units.id)).innerJoin(properties, (0, import_drizzle_orm3.eq)(units.propertyId, properties.id)).where((0, import_drizzle_orm3.eq)(properties.ownerId, ownerId)).orderBy((0, import_drizzle_orm3.desc)(maintenanceRequests.createdAt));
  }
  async getMaintenanceRequestsByTenantId(tenantId) {
    return await db.select().from(maintenanceRequests).where((0, import_drizzle_orm3.eq)(maintenanceRequests.tenantId, tenantId)).orderBy((0, import_drizzle_orm3.desc)(maintenanceRequests.createdAt));
  }
  async getMaintenanceRequestById(id) {
    const [request] = await db.select().from(maintenanceRequests).where((0, import_drizzle_orm3.eq)(maintenanceRequests.id, id));
    return request;
  }
  async createMaintenanceRequest(request) {
    const [newRequest] = await db.insert(maintenanceRequests).values(request).returning();
    return newRequest;
  }
  async updateMaintenanceRequest(id, request) {
    const [updatedRequest] = await db.update(maintenanceRequests).set({ ...request, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm3.eq)(maintenanceRequests.id, id)).returning();
    return updatedRequest;
  }
  // Document operations
  async getDocumentsByOwnerId(ownerId) {
    return await db.select().from(documents).where((0, import_drizzle_orm3.eq)(documents.uploadedBy, ownerId)).orderBy((0, import_drizzle_orm3.desc)(documents.createdAt));
  }
  async getDocumentsByCategory(category, relatedId) {
    const conditions = [(0, import_drizzle_orm3.eq)(documents.category, category)];
    if (relatedId) {
      conditions.push((0, import_drizzle_orm3.eq)(documents.relatedId, relatedId));
    }
    return await db.select().from(documents).where((0, import_drizzle_orm3.and)(...conditions)).orderBy((0, import_drizzle_orm3.desc)(documents.createdAt));
  }
  async getDocumentById(id) {
    const [document] = await db.select().from(documents).where((0, import_drizzle_orm3.eq)(documents.id, id));
    return document;
  }
  async createDocument(document) {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }
  async updateDocument(id, document) {
    const [updatedDocument] = await db.update(documents).set({ ...document, updatedAt: /* @__PURE__ */ new Date() }).where((0, import_drizzle_orm3.eq)(documents.id, id)).returning();
    return updatedDocument;
  }
  async deleteDocument(id) {
    await db.delete(documents).where((0, import_drizzle_orm3.eq)(documents.id, id));
  }
};
var storage = new DatabaseStorage();

// server/routes.ts
var import_drizzle_orm4 = require("drizzle-orm");
var import_zod = require("zod");
function validateSupabaseUrl(url) {
  if (!url || typeof url !== "string") {
    console.warn("SUPABASE_URL is missing or not a string");
    return null;
  }
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.includes("supabase.co") && !parsedUrl.hostname.includes("localhost")) {
      console.warn("SUPABASE_URL does not appear to be a valid Supabase URL");
      return null;
    }
    return url;
  } catch (error) {
    console.warn("SUPABASE_URL is not a valid URL format");
    return null;
  }
}
function validateSupabaseAnonKey(key) {
  if (!key || typeof key !== "string") {
    console.warn("SUPABASE_ANON_KEY is missing or not a string");
    return null;
  }
  if (!key.startsWith("eyJ") || key.length < 100 || key.length > 500) {
    console.warn("SUPABASE_ANON_KEY does not match expected JWT format");
    return null;
  }
  const parts = key.split(".");
  if (parts.length !== 3) {
    console.warn("SUPABASE_ANON_KEY does not have valid JWT structure");
    return null;
  }
  return key;
}
function htmlEscape(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/\//g, "&#x2F;");
}
function getValidatedSupabaseConfig() {
  const validatedUrl = validateSupabaseUrl(process.env.SUPABASE_URL);
  const validatedKey = validateSupabaseAnonKey(process.env.SUPABASE_ANON_KEY);
  if (!validatedUrl || !validatedKey) {
    console.error("Failed to validate Supabase configuration. Check environment variables.");
    return null;
  }
  return {
    url: validatedUrl,
    // Don't escape URLs - they need to be valid URLs
    key: htmlEscape(validatedKey)
    // Only escape the key for HTML safety
  };
}
async function registerRoutes(app2) {
  await setupAuth(app2);
  const supabaseStorage = new SupabaseStorage();
  app2.get("/api/login", (req, res) => {
    const supabaseConfig = getValidatedSupabaseConfig();
    console.log("Login page requested, config validation result:", supabaseConfig ? "SUCCESS" : "FAILED");
    if (!supabaseConfig) {
      console.error("Supabase configuration failed validation");
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Configuration Error</title></head>
        <body>
          <h1>Configuration Error</h1>
          <p>Server configuration is invalid. Please contact the administrator.</p>
        </body>
        </html>
      `);
    }
    const loginHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Sign In - Property Management System</title>
        <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
        <style>
            body { font-family: Arial, sans-serif; max-width: 400px; margin: 100px auto; padding: 20px; background-color: #f5f5f5; }
            .login-container { 
                text-align: center; 
                background: white; 
                padding: 40px; 
                border-radius: 12px; 
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .logo { font-size: 2rem; margin-bottom: 10px; }
            .title { color: #333; margin-bottom: 30px; }
            input { 
                width: 100%; 
                padding: 12px 16px; 
                margin: 8px 0; 
                border: 2px solid #e1e5e9; 
                border-radius: 8px; 
                font-size: 14px;
                box-sizing: border-box;
            }
            input:focus { 
                outline: none; 
                border-color: #007bff; 
            }
            .btn { 
                width: 100%;
                padding: 12px; 
                border: none; 
                border-radius: 8px; 
                font-size: 16px; 
                font-weight: 500;
                cursor: pointer; 
                margin: 8px 0;
                transition: background-color 0.2s;
            }
            .btn-primary { 
                background: #007bff; 
                color: white; 
            }
            .btn-primary:hover { 
                background: #0056b3; 
            }
            .btn-outline { 
                background: transparent; 
                color: #007bff; 
                border: 2px solid #007bff;
            }
            .btn-outline:hover { 
                background: #007bff; 
                color: white; 
            }
            .btn-google {
                background: #db4437;
                color: white;
                margin-top: 20px;
            }
            .btn-google:hover {
                background: #c23321;
            }
            .error { 
                color: #dc3545; 
                background: #f8d7da; 
                border: 1px solid #f5c6cb; 
                padding: 10px; 
                border-radius: 4px; 
                margin: 15px 0; 
            }
            .success { 
                color: #155724; 
                background: #d4edda; 
                border: 1px solid #c3e6cb; 
                padding: 10px; 
                border-radius: 4px; 
                margin: 15px 0; 
            }
            .divider { 
                margin: 20px 0; 
                text-align: center; 
                color: #666; 
                position: relative;
            }
            .divider::before {
                content: '';
                position: absolute;
                top: 50%;
                left: 0;
                right: 0;
                height: 1px;
                background: #ddd;
            }
            .divider span {
                background: white;
                padding: 0 15px;
            }
            .link { 
                color: #007bff; 
                text-decoration: none; 
                font-size: 14px;
            }
            .link:hover { 
                text-decoration: underline; 
            }
        </style>
    </head>
    <body>
        <div class="login-container">
            <div class="logo">\u{1F3E0}</div>
            <h2 class="title">Property Management System</h2>
            <p>Sign in to manage your properties</p>
            
            <div id="message"></div>
            
            <input type="email" id="email" placeholder="Email address" required>
            <input type="password" id="password" placeholder="Password" required>
            
            <button class="btn btn-primary" onclick="signIn()">Sign In</button>
            
            <div class="divider">
                <span>or</span>
            </div>
            
            <button class="btn btn-google" onclick="signInWithGoogle()">Sign in with Google</button>
            
            <div style="margin-top: 20px;">
                <span>Don't have an account? </span>
                <a href="/api/register" class="link">Create one here</a>
            </div>
        </div>

        <script>
            function showMessage(text, type = 'error') {
                const messageDiv = document.getElementById('message');
                messageDiv.className = type;
                messageDiv.textContent = text;
                messageDiv.style.display = 'block';
            }
            
            function clearMessage() {
                document.getElementById('message').style.display = 'none';
            }
            
            // Initialize when DOM is ready
            document.addEventListener('DOMContentLoaded', function() {
                console.log('DOM ready');
                
                // Check Supabase
                if (typeof supabase === 'undefined') {
                    console.error('Supabase not loaded');
                    document.getElementById('error').textContent = 'Supabase library failed to load';
                    return;
                }
                
                console.log('Supabase available');
                
                // Create Supabase client
                try {
                    const { createClient } = supabase;
                    window.supabaseClient = createClient('${supabaseConfig.url}', '${supabaseConfig.key}');
                    console.log('Supabase client created');
                } catch (e) {
                    console.error('Failed to create Supabase client:', e);
                    return;
                }
                
                // Define auth functions
                window.signIn = async function() {
                    clearMessage();
                    const email = document.getElementById('email').value;
                    const password = document.getElementById('password').value;
                    
                    if (!email || !password) {
                        showMessage('Please enter email and password');
                        return;
                    }
                    
                    try {
                        showMessage('Signing in...', 'success');
                        
                        const { data, error } = await window.supabaseClient.auth.signInWithPassword({
                            email: email,
                            password: password
                        });
                        
                        if (error) {
                            showMessage(error.message);
                        } else if (data.session) {
                            showMessage('Sign in successful! Redirecting...', 'success');
                            
                            // Send the token to our backend and set as cookie
                            const response = await fetch('/api/auth/set-session', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json'
                                },
                                body: JSON.stringify({
                                    access_token: data.session.access_token,
                                    refresh_token: data.session.refresh_token
                                })
                            });
                            
                            if (response.ok) {
                                setTimeout(() => {
                                    window.location.href = '/dashboard';
                                }, 1000);
                            } else {
                                showMessage('Failed to set session');
                            }
                        }
                    } catch (e) {
                        showMessage('Sign in failed. Please try again.');
                    }
                };
                
                window.signInWithGoogle = async function() {
                    showMessage('Google Sign-In coming soon!', 'success');
                };
            });
        </script>
    </body>
    </html>`;
    res.send(loginHtml);
  });
  app2.post("/api/auth/set-session", (req, res) => {
    try {
      const { access_token, refresh_token } = req.body;
      if (!access_token) {
        return res.status(400).json({ message: "Access token required" });
      }
      res.cookie("supabase-auth-token", access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 24 * 60 * 60 * 1e3
        // 24 hours
      });
      if (refresh_token) {
        res.cookie("supabase-refresh-token", refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: "lax",
          maxAge: 7 * 24 * 60 * 60 * 1e3
          // 7 days
        });
      }
      res.json({ message: "Session set successfully" });
    } catch (error) {
      console.error("Set session error:", error);
      res.status(500).json({ message: "Failed to set session" });
    }
  });
  app2.get("/api/auth/callback", async (req, res) => {
    try {
      const { access_token, refresh_token } = req.query;
      if (access_token) {
        res.cookie("supabase-auth-token", access_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === "production"
        });
        res.redirect("/dashboard");
      } else {
        res.redirect("/login?error=auth_failed");
      }
    } catch (error) {
      res.redirect("/login?error=auth_failed");
    }
  });
  app2.get("/api/auth/user", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.sub;
      const { data: userData, error } = await supabase.from("users").select("*").eq("id", userId).single();
      if (error) {
        console.log("Error fetching user from database:", error.message);
        return res.json(req.user);
      }
      if (userData) {
        const userResponse = {
          id: userData.id,
          email: userData.email,
          firstName: userData.first_name,
          lastName: userData.last_name,
          role: userData.role,
          profileImageUrl: userData.profile_image_url,
          createdAt: userData.created_at,
          updatedAt: userData.updated_at
        };
        return res.json(userResponse);
      }
      res.json(req.user);
    } catch (error) {
      console.log("Error in /api/auth/user:", error);
      res.json(req.user);
    }
  });
  app2.post("/api/auth/logout", (req, res) => {
    res.clearCookie("supabase-auth-token");
    res.json({ message: "Logged out successfully" });
  });
  app2.post("/api/auth/sync-user", isAuthenticated, async (req, res) => {
    try {
      const userPayload = req.user;
      const userId = userPayload.sub;
      const email = userPayload.email;
      console.log("Syncing user:", { userId, email, userPayload });
      try {
        const { data: existingUsers, error: selectError } = await supabase.from("users").select("*").eq("id", userId).limit(1);
        if (selectError) {
          console.log("Error checking existing user:", selectError.message);
        } else if (existingUsers && existingUsers.length > 0) {
          console.log("User already exists in custom table");
          return res.json({ user: existingUsers[0], message: "User already exists" });
        }
        const firstName = req.body.firstName || userPayload.user_metadata?.first_name || null;
        const lastName = req.body.lastName || userPayload.user_metadata?.last_name || null;
        const newUser = {
          id: userId,
          email,
          first_name: firstName,
          last_name: lastName,
          role: req.body.role || "landlord",
          created_at: (/* @__PURE__ */ new Date()).toISOString(),
          updated_at: (/* @__PURE__ */ new Date()).toISOString()
        };
        console.log("Creating new user in database via Supabase client:", newUser);
        const { data: createdUser, error: insertError } = await supabase.from("users").insert([newUser]).select().single();
        if (insertError) {
          console.log("Supabase insert error:", insertError);
          throw new Error(insertError.message);
        }
        console.log("User created successfully in database via Supabase:", createdUser);
        res.status(201).json({ user: createdUser, message: "User created successfully in database" });
      } catch (dbError) {
        const errorMessage = dbError instanceof Error ? dbError.message : "Unknown database error";
        console.log("Database operation failed:", errorMessage);
        const userData = {
          id: userId,
          email,
          firstName: req.body.firstName || userPayload.user_metadata?.first_name || null,
          lastName: req.body.lastName || userPayload.user_metadata?.last_name || null,
          role: req.body.role || "landlord",
          createdAt: (/* @__PURE__ */ new Date()).toISOString()
        };
        console.log("User sync fallback (auth only):", userData);
        res.status(201).json({
          user: userData,
          message: "User authenticated successfully. Database insert failed: " + errorMessage
        });
      }
    } catch (error) {
      console.error("Sync user error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to sync user", error: errorMessage });
    }
  });
  app2.get("/api/register", (req, res) => {
    const supabaseConfig = getValidatedSupabaseConfig();
    if (!supabaseConfig) {
      return res.status(500).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Configuration Error</title></head>
        <body>
          <h1>Configuration Error</h1>
          <p>Server configuration is invalid. Please contact the administrator.</p>
        </body>
        </html>
      `);
    }
    const registerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
        <title>Create Account - Property Management System</title>
        <script src="https://unpkg.com/@supabase/supabase-js@2"></script>
        <style>
            body { font-family: Arial, sans-serif; max-width: 450px; margin: 50px auto; padding: 20px; background-color: #f5f5f5; }
            .register-container { 
                text-align: center; 
                background: white; 
                padding: 40px; 
                border-radius: 12px; 
                box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .logo { font-size: 2rem; margin-bottom: 10px; }
            .title { color: #333; margin-bottom: 30px; }
            .form-group { margin-bottom: 20px; text-align: left; }
            .form-row { display: flex; gap: 10px; }
            .form-row .form-group { flex: 1; }
            label { 
                display: block; 
                margin-bottom: 5px; 
                font-weight: 500; 
                color: #555;
            }
            input, select { 
                width: 100%; 
                padding: 12px 16px; 
                border: 2px solid #e1e5e9; 
                border-radius: 8px; 
                font-size: 14px;
                box-sizing: border-box;
            }
            input:focus, select:focus { 
                outline: none; 
                border-color: #007bff; 
            }
            .btn { 
                width: 100%;
                padding: 12px; 
                border: none; 
                border-radius: 8px; 
                font-size: 16px; 
                font-weight: 500;
                cursor: pointer; 
                margin: 8px 0;
                transition: background-color 0.2s;
            }
            .btn-primary { 
                background: #28a745; 
                color: white; 
            }
            .btn-primary:hover { 
                background: #218838; 
            }
            .btn-outline { 
                background: transparent; 
                color: #007bff; 
                border: 2px solid #007bff;
            }
            .btn-outline:hover { 
                background: #007bff; 
                color: white; 
            }
            .error { 
                color: #dc3545; 
                background: #f8d7da; 
                border: 1px solid #f5c6cb; 
                padding: 10px; 
                border-radius: 4px; 
                margin: 15px 0; 
            }
            .success { 
                color: #155724; 
                background: #d4edda; 
                border: 1px solid #c3e6cb; 
                padding: 10px; 
                border-radius: 4px; 
                margin: 15px 0; 
            }
            .link { 
                color: #007bff; 
                text-decoration: none; 
                font-size: 14px;
            }
            .link:hover { 
                text-decoration: underline; 
            }
            .password-requirements {
                font-size: 12px;
                color: #666;
                text-align: left;
                margin-top: 5px;
            }
        </style>
    </head>
    <body>
        <div class="register-container">
            <div class="logo">\u{1F3E0}</div>
            <h2 class="title">Create Your Account</h2>
            <p>Join our property management platform for landlords and property managers</p>
            
            <div id="message"></div>
            
            <form id="registerForm">
                <div class="form-row">
                    <div class="form-group">
                        <label for="firstName">First Name *</label>
                        <input type="text" id="firstName" name="firstName" required>
                    </div>
                    <div class="form-group">
                        <label for="lastName">Last Name *</label>
                        <input type="text" id="lastName" name="lastName" required>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="email">Email Address *</label>
                    <input type="email" id="email" name="email" required>
                </div>
                
                <div class="form-group">
                    <label for="role">Account Type *</label>
                    <select id="role" name="role" required>
                        <option value="landlord">Landlord/Property Owner</option>
                        <option value="property_manager">Property Manager</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label for="password">Password *</label>
                    <input type="password" id="password" name="password" required>
                    <div class="password-requirements">
                        Minimum 8 characters, include uppercase, lowercase, number, and special character
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="confirmPassword">Confirm Password *</label>
                    <input type="password" id="confirmPassword" name="confirmPassword" required>
                </div>
                
                <button type="submit" class="btn btn-primary">Create Account</button>
            </form>
            
            <div style="margin-top: 20px;">
                <span>Already have an account? </span>
                <a href="/api/login" class="link">Sign in here</a>
            </div>
        </div>

        <script>
            function showMessage(text, type = 'error') {
                const messageDiv = document.getElementById('message');
                messageDiv.className = type;
                messageDiv.textContent = text;
                messageDiv.style.display = 'block';
            }
            
            function clearMessage() {
                document.getElementById('message').style.display = 'none';
            }
            
            function validatePassword(password) {
                const minLength = password.length >= 8;
                const hasUpper = /[A-Z]/.test(password);
                const hasLower = /[a-z]/.test(password);
                const hasNumber = /\\d/.test(password);
                const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
                
                return minLength && hasUpper && hasLower && hasNumber && hasSpecial;
            }

            // Initialize when DOM is ready
            document.addEventListener('DOMContentLoaded', function() {
                if (typeof supabase === 'undefined') {
                    showMessage('Supabase library failed to load');
                    return;
                }
                
                try {
                    const { createClient } = supabase;
                    window.supabaseClient = createClient('${supabaseConfig.url}', '${supabaseConfig.key}');
                } catch (e) {
                    showMessage('Failed to initialize authentication system');
                    return;
                }
                
                document.getElementById('registerForm').addEventListener('submit', async function(e) {
                    e.preventDefault();
                    clearMessage();
                    
                    const formData = new FormData(e.target);
                    const firstName = formData.get('firstName');
                    const lastName = formData.get('lastName');
                    const email = formData.get('email');
                    const role = formData.get('role');
                    const password = formData.get('password');
                    const confirmPassword = formData.get('confirmPassword');
                    
                    // Validation
                    if (!firstName || !lastName || !email || !password || !confirmPassword) {
                        showMessage('Please fill in all required fields');
                        return;
                    }
                    
                    if (password !== confirmPassword) {
                        showMessage('Passwords do not match');
                        return;
                    }
                    
                    if (!validatePassword(password)) {
                        showMessage('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
                        return;
                    }
                    
                    try {
                        showMessage('Creating your account...', 'success');
                        
                        const { data, error } = await window.supabaseClient.auth.signUp({
                            email: email,
                            password: password,
                            options: {
                                data: {
                                    first_name: firstName,
                                    last_name: lastName,
                                    role: role
                                }
                            }
                        });
                        
                        if (error) {
                            showMessage(error.message);
                            return;
                        }
                        
                        if (data.user) {
                            if (data.session) {
                                // User is immediately confirmed
                                showMessage('Account created successfully! Setting up your profile...', 'success');
                                
                                // Set session
                                const response = await fetch('/api/auth/set-session', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        access_token: data.session.access_token,
                                        refresh_token: data.session.refresh_token
                                    })
                                });
                                
                                if (response.ok) {
                                    // Create user record
                                    await fetch('/api/auth/sync-user', {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                            firstName: firstName,
                                            lastName: lastName,
                                            role: role
                                        })
                                    });
                                    
                                    showMessage('Account setup complete! Redirecting to dashboard...', 'success');
                                    setTimeout(() => {
                                        window.location.href = '/dashboard';
                                    }, 2000);
                                } else {
                                    showMessage('Account created but session setup failed. Please sign in.');
                                }
                            } else {
                                // Email confirmation required
                                showMessage('Account created! Please check your email for a verification link before signing in.', 'success');
                                setTimeout(() => {
                                    window.location.href = '/api/login';
                                }, 3000);
                            }
                        }
                    } catch (e) {
                        showMessage('Account creation failed. Please try again.');
                    }
                });
            });
        </script>
    </body>
    </html>
    `;
    res.send(registerHtml);
  });
  app2.post("/api/create-tables", async (req, res) => {
    try {
      console.log("Creating database tables...");
      await db.execute(import_drizzle_orm4.sql`
        CREATE TABLE IF NOT EXISTS users (
          id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
          email VARCHAR UNIQUE,
          first_name VARCHAR,
          last_name VARCHAR,
          profile_image_url VARCHAR,
          role VARCHAR NOT NULL DEFAULT 'landlord',
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `);
      await db.execute(import_drizzle_orm4.sql`
        CREATE TABLE IF NOT EXISTS sessions (
          sid VARCHAR PRIMARY KEY,
          sess JSONB NOT NULL,
          expire TIMESTAMP NOT NULL
        )
      `);
      await db.execute(import_drizzle_orm4.sql`
        CREATE INDEX IF NOT EXISTS IDX_session_expire ON sessions(expire)
      `);
      console.log("Tables created successfully");
      res.json({ message: "Tables created successfully" });
    } catch (error) {
      console.error("Error creating tables:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to create tables", error: errorMessage });
    }
  });
  app2.post("/api/create-tables-manual", async (req, res) => {
    try {
      console.log("Manual table creation requested");
      const testResult = await db.execute(import_drizzle_orm4.sql`SELECT 1 as test`);
      console.log("Database connection test:", testResult);
      res.json({ message: "Database connection successful", test: testResult });
    } catch (error) {
      console.error("Manual table creation error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to test database", error: errorMessage });
    }
  });
  app2.get("/api/properties", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.sub;
      const properties2 = await supabaseStorage.getPropertiesByOwnerId(userId) || [];
      console.log("Properties debug:", {
        userId,
        propertiesCount: properties2.length,
        firstProperty: properties2[0] ? { id: properties2[0].id, ownerId: properties2[0].ownerId, owner_id: properties2[0].owner_id } : "none"
      });
      res.json(properties2);
    } catch (error) {
      console.log("Error fetching properties:", error);
      res.status(500).json({ message: "Failed to fetch properties" });
    }
  });
  app2.get("/api/properties/:id", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.sub;
      const property = await supabaseStorage.getPropertyById(req.params.id);
      console.log("Property fetch debug:", {
        userId,
        propertyId: req.params.id,
        property: property ? {
          id: property.id,
          ownerId: property.ownerId,
          owner_id: property.owner_id
        } : "not found"
      });
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      const propertyOwnerId = property.ownerId || property.owner_id;
      if (propertyOwnerId && propertyOwnerId !== userId) {
        console.log("Ownership mismatch:", { propertyOwnerId, requestUserId: userId });
        return res.status(403).json({ message: "Access denied" });
      }
      if (!propertyOwnerId) {
        console.log("Warning: Property has no owner_id set:", property.id);
      }
      res.json(property);
    } catch (error) {
      console.log("Error fetching property:", error);
      res.status(500).json({ message: "Failed to fetch property" });
    }
  });
  app2.post("/api/properties", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.sub;
      const propertyData = insertPropertySchema.parse({ ...req.body, ownerId: userId });
      const property = await supabaseStorage.createProperty(propertyData);
      res.status(201).json(property);
    } catch (error) {
      console.log("Error creating property:", error);
      if (error instanceof import_zod.z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create property" });
      }
    }
  });
  app2.put("/api/properties/:id", isAuthenticated, async (req, res) => {
    try {
      const propertyData = insertPropertySchema.partial().parse(req.body);
      const property = await supabaseStorage.updateProperty(req.params.id, propertyData);
      res.json(property);
    } catch (error) {
      if (error instanceof import_zod.z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update property" });
      }
    }
  });
  app2.delete("/api/properties/:id", isAuthenticated, async (req, res) => {
    try {
      await supabaseStorage.deleteProperty(req.params.id);
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ message: "Failed to delete property" });
    }
  });
  app2.get("/api/properties/:propertyId/units", isAuthenticated, async (req, res) => {
    try {
      const units2 = await supabaseStorage.getUnitsByPropertyId(req.params.propertyId) || [];
      console.log("Units fetch debug:", {
        propertyId: req.params.propertyId,
        unitsCount: units2.length,
        units: units2
      });
      res.json(units2);
    } catch (error) {
      console.log("Error fetching units:", error);
      res.status(500).json({ message: "Failed to fetch units" });
    }
  });
  app2.post("/api/units", isAuthenticated, async (req, res) => {
    try {
      const unitData = insertUnitSchema.parse(req.body);
      console.log("Creating unit with data:", unitData);
      const unit = await supabaseStorage.createUnit(unitData);
      console.log("Created unit:", unit);
      res.status(201).json(unit);
    } catch (error) {
      console.error("Unit creation error:", error);
      if (error instanceof import_zod.z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({
          message: "Failed to create unit",
          error: error instanceof Error ? error.message : "Unknown error"
        });
      }
    }
  });
  app2.put("/api/units/:id", isAuthenticated, async (req, res) => {
    try {
      const unitData = insertUnitSchema.partial().parse(req.body);
      const unit = await supabaseStorage.updateUnit(req.params.id, unitData);
      res.json(unit);
    } catch (error) {
      if (error instanceof import_zod.z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update unit" });
      }
    }
  });
  app2.delete("/api/units/:id", isAuthenticated, async (req, res) => {
    try {
      await supabaseStorage.deleteUnit(req.params.id);
      res.json({ message: "Unit deleted successfully" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete unit" });
    }
  });
  app2.get("/api/tenants", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.sub;
      const tenants2 = await supabaseStorage.getTenantsByOwnerId(userId) || [];
      res.json(tenants2);
    } catch (error) {
      console.log("Error fetching tenants:", error);
      res.status(500).json({ message: "Failed to fetch tenants" });
    }
  });
  app2.post("/api/tenants", isAuthenticated, async (req, res) => {
    try {
      const landlordId = req.user.sub;
      const tenantData = insertTenantSchema.parse(req.body);
      const tenant = await supabaseStorage.createTenant(tenantData, landlordId);
      res.status(201).json(tenant);
    } catch (error) {
      console.log("Error creating tenant:", error);
      if (error instanceof import_zod.z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create tenant" });
      }
    }
  });
  app2.put("/api/tenants/:id", isAuthenticated, async (req, res) => {
    try {
      const tenantData = insertTenantSchema.partial().parse(req.body);
      const tenant = await supabaseStorage.updateTenant(req.params.id, tenantData);
      res.json(tenant);
    } catch (error) {
      if (error instanceof import_zod.z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update tenant" });
      }
    }
  });
  app2.put("/api/auth/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.sub;
      const profileUpdateSchema = import_zod.z.object({
        firstName: import_zod.z.string().min(1, "First name is required").optional(),
        lastName: import_zod.z.string().min(1, "Last name is required").optional(),
        email: import_zod.z.string().email("Invalid email address").optional()
      });
      const profileData = profileUpdateSchema.parse(req.body);
      const { data, error } = await supabase.auth.admin.updateUserById(
        userId,
        {
          email: profileData.email,
          user_metadata: {
            first_name: profileData.firstName,
            last_name: profileData.lastName
          }
        }
      );
      if (error) {
        console.error("Profile update error:", error);
        return res.status(400).json({ message: error.message });
      }
      await supabaseStorage.updateUser(userId, {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email
      });
      res.json({
        message: "Profile updated successfully",
        user: {
          id: data.user.id,
          email: data.user.email,
          firstName: data.user.user_metadata?.first_name,
          lastName: data.user.user_metadata?.last_name
        }
      });
    } catch (error) {
      console.error("Error updating profile:", error);
      if (error instanceof import_zod.z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to update profile" });
      }
    }
  });
  app2.post("/api/auth/change-password", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.sub;
      const passwordChangeSchema = import_zod.z.object({
        currentPassword: import_zod.z.string().min(1, "Current password is required"),
        newPassword: import_zod.z.string().min(6, "New password must be at least 6 characters"),
        confirmPassword: import_zod.z.string().min(1, "Please confirm your new password")
      }).refine((data2) => data2.newPassword === data2.confirmPassword, {
        message: "Passwords don't match",
        path: ["confirmPassword"]
      });
      const passwordData = passwordChangeSchema.parse(req.body);
      const { data, error } = await supabase.auth.admin.updateUserById(
        userId,
        { password: passwordData.newPassword }
      );
      if (error) {
        console.error("Password change error:", error);
        return res.status(400).json({ message: error.message });
      }
      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Error changing password:", error);
      if (error instanceof import_zod.z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to change password" });
      }
    }
  });
  app2.get("/api/payments", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.sub;
      const payments2 = await supabaseStorage.getPaymentsByOwnerId(userId) || [];
      res.json(payments2);
    } catch (error) {
      console.log("Error fetching payments:", error);
      res.status(500).json({ message: "Failed to fetch payments" });
    }
  });
  app2.post("/api/payments", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.sub;
      const paymentCreateSchema = import_zod.z.object({
        tenantId: import_zod.z.string().min(1, "Tenant is required"),
        amount: import_zod.z.number().positive("Amount must be positive"),
        description: import_zod.z.string().optional(),
        paymentMethod: import_zod.z.enum(["cash", "bank_transfer", "mobile_money", "check"]).default("cash"),
        status: import_zod.z.enum(["pending", "completed", "failed", "cancelled"]).default("completed"),
        paidDate: import_zod.z.string().optional()
      });
      const paymentData = paymentCreateSchema.parse(req.body);
      const tenant = await supabaseStorage.getTenantById(paymentData.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      const landlordTenants = await supabaseStorage.getTenantsByOwnerId(userId);
      if (!landlordTenants.some((t) => t.id === tenant.id)) {
        return res.status(403).json({ message: "Unauthorized: Tenant does not belong to you" });
      }
      const leases2 = await supabaseStorage.getLeasesByTenantId(paymentData.tenantId);
      const activeLease = leases2.find((lease) => lease.isActive);
      if (!activeLease) {
        return res.status(400).json({ message: "No active lease found for this tenant" });
      }
      const leaseUnit = await supabaseStorage.getUnitById(activeLease.unitId);
      const leaseProperty = leaseUnit ? await supabaseStorage.getPropertyById(leaseUnit.propertyId) : null;
      const leaseOwnerId = leaseProperty?.ownerId ?? leaseProperty?.owner_id;
      if (leaseOwnerId && leaseOwnerId !== userId) {
        return res.status(403).json({ message: "Unauthorized: Lease does not belong to you" });
      }
      const paidDate = paymentData.paidDate ? new Date(paymentData.paidDate) : /* @__PURE__ */ new Date();
      const payment = await supabaseStorage.createPayment({
        leaseId: activeLease.id,
        amount: paymentData.amount.toString(),
        dueDate: paidDate,
        // For recorded payments, due date equals paid date
        paymentMethod: paymentData.paymentMethod,
        status: paymentData.status,
        description: paymentData.description || `Rent payment for ${tenant.firstName} ${tenant.lastName}`,
        paidDate
      });
      res.status(201).json(payment);
    } catch (error) {
      console.error("Error creating payment:", error);
      if (error instanceof import_zod.z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create payment" });
      }
    }
  });
  app2.get("/api/dashboard/stats", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.sub;
      const [properties2, tenants2, payments2] = await Promise.all([
        supabaseStorage.getPropertiesByOwnerId(userId),
        supabaseStorage.getTenantsByOwnerId(userId),
        supabaseStorage.getPaymentsByOwnerId(userId)
      ]);
      const totalProperties = properties2?.length || 0;
      const totalTenants = tenants2?.length || 0;
      const completedPayments = payments2?.filter((p) => p.status === "completed") || [];
      const totalRevenue = completedPayments.reduce((sum, payment) => {
        return sum + parseFloat(payment.amount || "0");
      }, 0);
      const currentMonth = (/* @__PURE__ */ new Date()).getMonth();
      const currentYear = (/* @__PURE__ */ new Date()).getFullYear();
      const monthlyRevenue = completedPayments.filter((payment) => {
        const paymentDate = new Date(payment.paidDate || payment.createdAt);
        return paymentDate.getMonth() === currentMonth && paymentDate.getFullYear() === currentYear;
      }).reduce((sum, payment) => sum + parseFloat(payment.amount || "0"), 0);
      const pendingPayments = payments2?.filter((p) => p.status === "pending").length || 0;
      res.json({
        totalProperties,
        totalTenants,
        totalRevenue,
        monthlyRevenue,
        pendingPayments,
        recentPayments: completedPayments.slice(0, 5)
        // Last 5 payments
      });
    } catch (error) {
      console.error("Error fetching dashboard stats:", error);
      res.status(500).json({ message: "Failed to fetch dashboard statistics" });
    }
  });
  app2.get("/api/leases", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.sub;
      const leases2 = await supabaseStorage.getLeasesByOwnerId(userId);
      res.json(leases2);
    } catch (error) {
      console.error("Error fetching leases:", error);
      res.status(500).json({ message: "Failed to fetch leases" });
    }
  });
  app2.post("/api/leases", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.sub;
      const leaseCreateSchema = import_zod.z.object({
        tenantId: import_zod.z.string().min(1, "Tenant is required"),
        unitId: import_zod.z.string().min(1, "Unit is required"),
        startDate: import_zod.z.string().min(1, "Start date is required"),
        endDate: import_zod.z.string().min(1, "End date is required"),
        monthlyRent: import_zod.z.string().min(1, "Monthly rent is required"),
        securityDeposit: import_zod.z.string().optional(),
        isActive: import_zod.z.boolean().default(true)
      });
      const leaseData = leaseCreateSchema.parse(req.body);
      const unit = await supabaseStorage.getUnitById(leaseData.unitId);
      if (!unit) {
        return res.status(404).json({ message: "Unit not found" });
      }
      const property = await supabaseStorage.getPropertyById(unit.propertyId);
      if (!property) {
        return res.status(404).json({ message: "Property not found" });
      }
      const owner = property.ownerId || property.owner_id;
      if (owner !== userId) {
        return res.status(403).json({ message: "Unauthorized: Unit does not belong to you" });
      }
      const existingLeases = await supabaseStorage.getLeasesByOwnerId(userId);
      const activeLeaseForUnit = existingLeases.find(
        (lease2) => lease2.unitId === leaseData.unitId && lease2.isActive
      );
      if (activeLeaseForUnit) {
        return res.status(400).json({ message: "Unit is already occupied by an active lease" });
      }
      const tenant = await supabaseStorage.getTenantById(leaseData.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }
      const landlordTenants = await supabaseStorage.getTenantsByOwnerId(userId);
      const tenantBelongsToLandlord = landlordTenants.some((t) => t.id === leaseData.tenantId);
      if (!tenantBelongsToLandlord) {
        return res.status(403).json({ message: "Unauthorized: Tenant does not belong to you" });
      }
      const lease = await supabaseStorage.createLease({
        tenantId: leaseData.tenantId,
        unitId: leaseData.unitId,
        startDate: new Date(leaseData.startDate),
        endDate: new Date(leaseData.endDate),
        monthlyRent: leaseData.monthlyRent,
        securityDeposit: leaseData.securityDeposit || "0",
        isActive: leaseData.isActive
      });
      await supabaseStorage.updateUnit(leaseData.unitId, { isOccupied: true });
      res.status(201).json(lease);
    } catch (error) {
      console.error("Error creating lease:", error);
      if (error instanceof import_zod.z.ZodError) {
        res.status(400).json({ message: "Invalid input", errors: error.errors });
      } else {
        res.status(500).json({ message: "Failed to create lease" });
      }
    }
  });
  app2.get("/api/maintenance-requests", isAuthenticated, async (req, res) => {
    try {
      const userId = req.user.sub;
      res.json([]);
    } catch (error) {
      console.log("Error fetching maintenance requests:", error);
      res.status(500).json({ message: "Failed to fetch maintenance requests" });
    }
  });
}

// server/vite.ts
var import_express = __toESM(require("express"), 1);
var import_fs = __toESM(require("fs"), 1);
var import_path2 = __toESM(require("path"), 1);
var import_vite2 = require("vite");

// vite.config.ts
var import_vite = require("vite");
var import_plugin_react = __toESM(require("@vitejs/plugin-react"), 1);
var import_path = __toESM(require("path"), 1);
var import_meta = {};
var vite_config_default = (0, import_vite.defineConfig)({
  plugins: [
    (0, import_plugin_react.default)()
  ],
  resolve: {
    alias: {
      "@": import_path.default.resolve(import_meta.dirname, "client", "src"),
      "@shared": import_path.default.resolve(import_meta.dirname, "shared"),
      "@assets": import_path.default.resolve(import_meta.dirname, "attached_assets")
    }
  },
  root: import_path.default.resolve(import_meta.dirname, "client"),
  build: {
    outDir: import_path.default.resolve(import_meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
var import_nanoid = require("nanoid");
var import_meta2 = {};
var viteLogger = (0, import_vite2.createLogger)();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await (0, import_vite2.createServer)({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = import_path2.default.resolve(
        import_meta2.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await import_fs.default.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${(0, import_nanoid.nanoid)()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = import_path2.default.resolve(import_meta2.dirname, "public");
  if (!import_fs.default.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(import_express.default.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(import_path2.default.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var import_cookie_parser = __toESM(require("cookie-parser"), 1);
import_dotenv2.default.config();
var app = (0, import_express2.default)();
app.use(import_express2.default.json());
app.use(import_express2.default.urlencoded({ extended: false }));
app.use((0, import_cookie_parser.default)());
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  await registerRoutes(app);
  const server = (0, import_http.createServer)(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
