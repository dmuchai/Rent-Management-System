import { supabase } from "./supabaseAuth";

export class SupabaseStorage {
  // Unit operations
  async getUnitsByPropertyId(propertyId: string): Promise<Unit[]> {
    // TODO: Implement Supabase query
    return [];
  }
  async getUnitById(id: string): Promise<Unit | undefined> {
    // TODO: Implement Supabase query
    return undefined;
  }
  async createUnit(unit: InsertUnit): Promise<Unit> {
    // TODO: Implement Supabase query
    return unit as Unit;
  }
  async updateUnit(id: string, unit: Partial<InsertUnit>): Promise<Unit> {
    // TODO: Implement Supabase query
    return unit as Unit;
  }
  async deleteUnit(id: string): Promise<void> {
    // TODO: Implement Supabase query
  }

  // Lease operations
  async getLeasesByOwnerId(ownerId: string): Promise<Lease[]> {
    // TODO: Implement Supabase query
    return [];
  }
  async getLeasesByTenantId(tenantId: string): Promise<Lease[]> {
    // TODO: Implement Supabase query
    return [];
  }
  async getLeaseById(id: string): Promise<Lease | undefined> {
    // TODO: Implement Supabase query
    return undefined;
  }
  async createLease(lease: InsertLease): Promise<Lease> {
    // TODO: Implement Supabase query
    return lease as Lease;
  }
  async updateLease(id: string, lease: Partial<InsertLease>): Promise<Lease> {
    // TODO: Implement Supabase query
    return lease as Lease;
  }
  async deleteLease(id: string): Promise<void> {
    // TODO: Implement Supabase query
  }

  // Maintenance request operations
  async getMaintenanceRequestsByOwnerId(ownerId: string): Promise<MaintenanceRequest[]> {
    // TODO: Implement Supabase query
    return [];
  }
  async createMaintenanceRequest(request: InsertMaintenanceRequest): Promise<MaintenanceRequest> {
    // TODO: Implement Supabase query
    return request as MaintenanceRequest;
  }

  // Document operations
  async getDocumentsByOwnerId(ownerId: string): Promise<Document[]> {
    // TODO: Implement Supabase query
    return [];
  }
  async createDocument(document: InsertDocument): Promise<Document> {
    // TODO: Implement Supabase query
    return document as Document;
  }
  // Tenants CRUD
  async getTenantsByOwnerId(ownerId: string): Promise<Tenant[]> {
    console.log('getTenantsByOwnerId called for owner:', ownerId);
    
    // Use user_id field to find tenants associated with this landlord
    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("user_id", ownerId)
      .order("created_at", { ascending: true });
    
    if (error) {
      console.log('Error fetching tenants:', error);
      throw error;
    }
    
    console.log('Found tenants:', data?.length || 0);
    return data as Tenant[];
  }

  async getTenantById(id: string): Promise<Tenant | undefined> {
    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as Tenant | undefined;
  }

  async createTenant(tenant: InsertTenant, landlordId?: string): Promise<Tenant> {
    // Map camelCase to snake_case for database insertion
    // Use user_id to temporarily store the landlord ID for association
    const dbTenant = {
      user_id: landlordId || tenant.userId, // Use landlord ID for association
      first_name: tenant.firstName,
      last_name: tenant.lastName,
      email: tenant.email,
      phone: tenant.phone,
      emergency_contact: tenant.emergencyContact,
    };
    
    const { data, error } = await supabase
      .from("tenants")
      .insert([dbTenant])
      .select()
      .single();
    if (error) throw error;
    return data as Tenant;
  }

  async updateTenant(id: string, tenant: Partial<InsertTenant>): Promise<Tenant> {
    const { data, error } = await supabase
      .from("tenants")
      .update({ ...tenant, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Tenant;
  }

  async deleteTenant(id: string): Promise<void> {
    const { error } = await supabase
      .from("tenants")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }

  // Payments CRUD
  async getPaymentsByOwnerId(ownerId: string): Promise<Payment[]> {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("owner_id", ownerId)
      .order("due_date", { ascending: true });
    if (error) throw error;
    return data as Payment[];
  }

  async getPaymentById(id: string): Promise<Payment | undefined> {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as Payment | undefined;
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const { data, error } = await supabase
      .from("payments")
      .insert([payment])
      .select()
      .single();
    if (error) throw error;
    return data as Payment;
  }

  async updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment> {
    const { data, error } = await supabase
      .from("payments")
      .update({ ...payment, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Payment;
  }

  async deletePayment(id: string): Promise<void> {
    const { error } = await supabase
      .from("payments")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }
  // Get properties by owner
  async getPropertiesByOwnerId(ownerId: string): Promise<Property[]> {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("owner_id", ownerId)
      .order("name", { ascending: true });
    if (error) throw error;
    return data as Property[];
  }

  // Get property by ID
  async getPropertyById(id: string): Promise<Property | undefined> {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data as Property | undefined;
  }

  // Create property
  async createProperty(property: InsertProperty): Promise<Property> {
    const { data, error } = await supabase
      .from("properties")
      .insert([property])
      .select()
      .single();
    if (error) throw error;
    return data as Property;
  }

  // Update property
  async updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property> {
    const { data, error } = await supabase
      .from("properties")
      .update({ ...property, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data as Property;
  }

  // Delete property
  async deleteProperty(id: string): Promise<void> {
    const { error } = await supabase
      .from("properties")
      .delete()
      .eq("id", id);
    if (error) throw error;
  }
}
import {
  users,
  properties,
  units,
  tenants,
  leases,
  payments,
  maintenanceRequests,
  documents,
  type User,
  type UpsertUser,
  type Property,
  type InsertProperty,
  type Unit,
  type InsertUnit,
  type Tenant,
  type InsertTenant,
  type Lease,
  type InsertLease,
  type Payment,
  type InsertPayment,
  type MaintenanceRequest,
  type InsertMaintenanceRequest,
  type Document,
  type InsertDocument,
} from "../shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, between } from "drizzle-orm";

export interface IStorage {
  // User operations (for authentication)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Property operations
  getPropertiesByOwnerId(ownerId: string): Promise<Property[]>;
  getPropertyById(id: string): Promise<Property | undefined>;
  createProperty(property: InsertProperty): Promise<Property>;
  updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property>;
  deleteProperty(id: string): Promise<void>;

  // Unit operations
  getUnitsByPropertyId(propertyId: string): Promise<Unit[]>;
  getUnitById(id: string): Promise<Unit | undefined>;
  createUnit(unit: InsertUnit): Promise<Unit>;
  updateUnit(id: string, unit: Partial<InsertUnit>): Promise<Unit>;
  deleteUnit(id: string): Promise<void>;

  // Tenant operations
  getTenantsByOwnerId(ownerId: string): Promise<Tenant[]>;
  getTenantById(id: string): Promise<Tenant | undefined>;
  getTenantByUserId(userId: string): Promise<Tenant | undefined>;
  createTenant(tenant: InsertTenant): Promise<Tenant>;
  updateTenant(id: string, tenant: Partial<InsertTenant>): Promise<Tenant>;
  deleteTenant(id: string): Promise<void>;

  // Lease operations
  getLeasesByOwnerId(ownerId: string): Promise<Lease[]>;
  getLeasesByTenantId(tenantId: string): Promise<Lease[]>;
  getLeaseById(id: string): Promise<Lease | undefined>;
  getActiveLeaseByUnitId(unitId: string): Promise<Lease | undefined>;
  createLease(lease: InsertLease): Promise<Lease>;
  updateLease(id: string, lease: Partial<InsertLease>): Promise<Lease>;
  deleteLease(id: string): Promise<void>;

  // Payment operations
  getPaymentsByOwnerId(ownerId: string): Promise<Payment[]>;
  getPaymentsByLeaseId(leaseId: string): Promise<Payment[]>;
  getPaymentById(id: string): Promise<Payment | undefined>;
  getPaymentByPesapalId(pesapalId: string): Promise<Payment | undefined>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment>;
  getOverduePayments(ownerId: string): Promise<Payment[]>;
  getPaymentStats(ownerId: string, startDate: Date, endDate: Date): Promise<{
    totalExpected: number;
    totalCollected: number;
    totalOverdue: number;
    collectionRate: number;
  }>;

  // Maintenance request operations
  getMaintenanceRequestsByOwnerId(ownerId: string): Promise<MaintenanceRequest[]>;
  getMaintenanceRequestsByTenantId(tenantId: string): Promise<MaintenanceRequest[]>;
  getMaintenanceRequestById(id: string): Promise<MaintenanceRequest | undefined>;
  createMaintenanceRequest(request: InsertMaintenanceRequest): Promise<MaintenanceRequest>;
  updateMaintenanceRequest(id: string, request: Partial<InsertMaintenanceRequest>): Promise<MaintenanceRequest>;

  // Document operations
  getDocumentsByOwnerId(ownerId: string): Promise<Document[]>;
  getDocumentsByCategory(category: string, relatedId?: string): Promise<Document[]>;
  getDocumentById(id: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  updateDocument(id: string, document: Partial<InsertDocument>): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.email,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Property operations
  async getPropertiesByOwnerId(ownerId: string): Promise<Property[]> {
    return await db.select().from(properties).where(eq(properties.ownerId, ownerId)).orderBy(asc(properties.name));
  }

  async getPropertyById(id: string): Promise<Property | undefined> {
    const [property] = await db.select().from(properties).where(eq(properties.id, id));
    return property;
  }

  async createProperty(property: InsertProperty): Promise<Property> {
    const [newProperty] = await db.insert(properties).values(property).returning();
    return newProperty;
  }

  async updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property> {
    const [updatedProperty] = await db
      .update(properties)
      .set({ ...property, updatedAt: new Date() })
      .where(eq(properties.id, id))
      .returning();
    return updatedProperty;
  }

  async deleteProperty(id: string): Promise<void> {
    await db.delete(properties).where(eq(properties.id, id));
  }

  // Unit operations
  async getUnitsByPropertyId(propertyId: string): Promise<Unit[]> {
    return await db.select().from(units).where(eq(units.propertyId, propertyId)).orderBy(asc(units.unitNumber));
  }

  async getUnitById(id: string): Promise<Unit | undefined> {
    const [unit] = await db.select().from(units).where(eq(units.id, id));
    return unit;
  }

  async createUnit(unit: InsertUnit): Promise<Unit> {
    const [newUnit] = await db.insert(units).values(unit).returning();
    return newUnit;
  }

  async updateUnit(id: string, unit: Partial<InsertUnit>): Promise<Unit> {
    const [updatedUnit] = await db
      .update(units)
      .set({ ...unit, updatedAt: new Date() })
      .where(eq(units.id, id))
      .returning();
    return updatedUnit;
  }

  async deleteUnit(id: string): Promise<void> {
    await db.delete(units).where(eq(units.id, id));
  }

  // Tenant operations
  async getTenantsByOwnerId(ownerId: string): Promise<Tenant[]> {
    return await db
      .select({
        id: tenants.id,
        userId: tenants.userId,
        firstName: tenants.firstName,
        lastName: tenants.lastName,
        email: tenants.email,
        phone: tenants.phone,
        emergencyContact: tenants.emergencyContact,
        createdAt: tenants.createdAt,
        updatedAt: tenants.updatedAt,
      })
      .from(tenants)
      .innerJoin(leases, eq(tenants.id, leases.tenantId))
      .innerJoin(units, eq(leases.unitId, units.id))
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .where(eq(properties.ownerId, ownerId))
      .orderBy(asc(tenants.lastName));
  }

  async getTenantById(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getTenantByUserId(userId: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.userId, userId));
    return tenant;
  }

  async createTenant(tenant: InsertTenant): Promise<Tenant> {
    const [newTenant] = await db.insert(tenants).values(tenant).returning();
    return newTenant;
  }

  async updateTenant(id: string, tenant: Partial<InsertTenant>): Promise<Tenant> {
    const [updatedTenant] = await db
      .update(tenants)
      .set({ ...tenant, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    return updatedTenant;
  }

  async deleteTenant(id: string): Promise<void> {
    await db.delete(tenants).where(eq(tenants.id, id));
  }

  // Lease operations
  async getLeasesByOwnerId(ownerId: string): Promise<Lease[]> {
    return await db
      .select({
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
        updatedAt: leases.updatedAt,
      })
      .from(leases)
      .innerJoin(units, eq(leases.unitId, units.id))
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .where(eq(properties.ownerId, ownerId))
      .orderBy(desc(leases.createdAt));
  }

  async getLeasesByTenantId(tenantId: string): Promise<Lease[]> {
    return await db.select().from(leases).where(eq(leases.tenantId, tenantId)).orderBy(desc(leases.createdAt));
  }

  async getLeaseById(id: string): Promise<Lease | undefined> {
    const [lease] = await db.select().from(leases).where(eq(leases.id, id));
    return lease;
  }

  async getActiveLeaseByUnitId(unitId: string): Promise<Lease | undefined> {
    const [lease] = await db
      .select()
      .from(leases)
      .where(and(eq(leases.unitId, unitId), eq(leases.isActive, true)));
    return lease;
  }

  async createLease(lease: InsertLease): Promise<Lease> {
    const [newLease] = await db.insert(leases).values(lease).returning();
    return newLease;
  }

  async updateLease(id: string, lease: Partial<InsertLease>): Promise<Lease> {
    const [updatedLease] = await db
      .update(leases)
      .set({ ...lease, updatedAt: new Date() })
      .where(eq(leases.id, id))
      .returning();
    return updatedLease;
  }

  async deleteLease(id: string): Promise<void> {
    await db.delete(leases).where(eq(leases.id, id));
  }

  // Payment operations
  async getPaymentsByOwnerId(ownerId: string): Promise<Payment[]> {
    return await db
      .select({
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
        updatedAt: payments.updatedAt,
      })
      .from(payments)
      .innerJoin(leases, eq(payments.leaseId, leases.id))
      .innerJoin(units, eq(leases.unitId, units.id))
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .where(eq(properties.ownerId, ownerId))
      .orderBy(desc(payments.dueDate));
  }

  async getPaymentsByLeaseId(leaseId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.leaseId, leaseId)).orderBy(desc(payments.dueDate));
  }

  async getPaymentById(id: string): Promise<Payment | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    return payment;
  }

  async getPaymentByPesapalId(pesapalId: string): Promise<Payment | undefined> {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.pesapalOrderTrackingId, pesapalId));
    return payment;
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db.insert(payments).values(payment).returning();
    return newPayment;
  }

  async updatePayment(id: string, payment: Partial<InsertPayment>): Promise<Payment> {
    const [updatedPayment] = await db
      .update(payments)
      .set({ ...payment, updatedAt: new Date() })
      .where(eq(payments.id, id))
      .returning();
    return updatedPayment;
  }

  async getOverduePayments(ownerId: string): Promise<Payment[]> {
    const today = new Date();
    return await db
      .select({
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
        updatedAt: payments.updatedAt,
      })
      .from(payments)
      .innerJoin(leases, eq(payments.leaseId, leases.id))
      .innerJoin(units, eq(leases.unitId, units.id))
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .where(
        and(
          eq(properties.ownerId, ownerId),
          eq(payments.status, "pending"),
          sql`${payments.dueDate} < ${today}`
        )
      );
  }

  async getPaymentStats(ownerId: string, startDate: Date, endDate: Date): Promise<{
    totalExpected: number;
    totalCollected: number;
    totalOverdue: number;
    collectionRate: number;
  }> {
    const results = await db
      .select({
        totalExpected: sql<number>`SUM(${payments.amount})`,
        totalCollected: sql<number>`SUM(CASE WHEN ${payments.status} = 'completed' THEN ${payments.amount} ELSE 0 END)`,
        totalOverdue: sql<number>`SUM(CASE WHEN ${payments.status} = 'pending' AND ${payments.dueDate} < NOW() THEN ${payments.amount} ELSE 0 END)`,
      })
      .from(payments)
      .innerJoin(leases, eq(payments.leaseId, leases.id))
      .innerJoin(units, eq(leases.unitId, units.id))
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .where(
        and(
          eq(properties.ownerId, ownerId),
          between(payments.dueDate, startDate, endDate)
        )
      );

    const stats = results[0];
    const totalExpected = Number(stats.totalExpected) || 0;
    const totalCollected = Number(stats.totalCollected) || 0;
    const totalOverdue = Number(stats.totalOverdue) || 0;
    const collectionRate = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0;

    return {
      totalExpected,
      totalCollected,
      totalOverdue,
      collectionRate,
    };
  }

  // Maintenance request operations
  async getMaintenanceRequestsByOwnerId(ownerId: string): Promise<MaintenanceRequest[]> {
    return await db
      .select({
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
        updatedAt: maintenanceRequests.updatedAt,
      })
      .from(maintenanceRequests)
      .innerJoin(units, eq(maintenanceRequests.unitId, units.id))
      .innerJoin(properties, eq(units.propertyId, properties.id))
      .where(eq(properties.ownerId, ownerId))
      .orderBy(desc(maintenanceRequests.createdAt));
  }

  async getMaintenanceRequestsByTenantId(tenantId: string): Promise<MaintenanceRequest[]> {
    return await db
      .select()
      .from(maintenanceRequests)
      .where(eq(maintenanceRequests.tenantId, tenantId))
      .orderBy(desc(maintenanceRequests.createdAt));
  }

  async getMaintenanceRequestById(id: string): Promise<MaintenanceRequest | undefined> {
    const [request] = await db.select().from(maintenanceRequests).where(eq(maintenanceRequests.id, id));
    return request;
  }

  async createMaintenanceRequest(request: InsertMaintenanceRequest): Promise<MaintenanceRequest> {
    const [newRequest] = await db.insert(maintenanceRequests).values(request).returning();
    return newRequest;
  }

  async updateMaintenanceRequest(id: string, request: Partial<InsertMaintenanceRequest>): Promise<MaintenanceRequest> {
    const [updatedRequest] = await db
      .update(maintenanceRequests)
      .set({ ...request, updatedAt: new Date() })
      .where(eq(maintenanceRequests.id, id))
      .returning();
    return updatedRequest;
  }

  // Document operations
  async getDocumentsByOwnerId(ownerId: string): Promise<Document[]> {
    return await db
      .select()
      .from(documents)
      .where(eq(documents.uploadedBy, ownerId))
      .orderBy(desc(documents.createdAt));
  }

  async getDocumentsByCategory(category: string, relatedId?: string): Promise<Document[]> {
    const conditions = [eq(documents.category, category)];
    
    if (relatedId) {
      conditions.push(eq(documents.relatedId, relatedId));
    }
    
    return await db
      .select()
      .from(documents)
      .where(and(...conditions))
      .orderBy(desc(documents.createdAt));
  }

  async getDocumentById(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(documents).where(eq(documents.id, id));
    return document;
  }

  async createDocument(document: InsertDocument): Promise<Document> {
    const [newDocument] = await db.insert(documents).values(document).returning();
    return newDocument;
  }

  async updateDocument(id: string, document: Partial<InsertDocument>): Promise<Document> {
    const [updatedDocument] = await db
      .update(documents)
      .set({ ...document, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();
    return updatedDocument;
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }
}

export const storage = new DatabaseStorage();
