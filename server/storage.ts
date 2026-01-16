import { supabase } from "./supabaseAuth";

export class SupabaseStorage {
  // Unit operations
  async getUnitsByPropertyId(propertyId: string): Promise<Unit[]> {
    const { data, error } = await supabase
      .from("units")
      .select("*")
      .eq("property_id", propertyId)
      .order("unit_number", { ascending: true });
    if (error) throw error;

    // Convert snake_case to camelCase for frontend
    const units = data?.map((unit: any) => ({
      id: unit.id,
      propertyId: unit.property_id,
      unitNumber: unit.unit_number,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      size: unit.size,
      rentAmount: unit.rent_amount,
      isOccupied: unit.is_occupied,
      createdAt: unit.created_at,
      updatedAt: unit.updated_at,
    })) || [];

    return units as Unit[];
  }
  async getUnitById(id: string): Promise<Unit | undefined> {
    const { data, error } = await supabase
      .from("units")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.log('getUnitById error:', error);
      return undefined;
    }

    if (!data) return undefined;

    // Convert snake_case to camelCase for frontend
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
      updatedAt: data.updated_at,
    };

    return unit as Unit;
  }
  async createUnit(unit: InsertUnit): Promise<Unit> {
    // Map camelCase to snake_case for Supabase
    const unitData = {
      property_id: unit.propertyId,
      unit_number: unit.unitNumber,
      bedrooms: unit.bedrooms,
      bathrooms: unit.bathrooms,
      size: unit.size,
      rent_amount: unit.rentAmount,
      is_occupied: unit.isOccupied || false,
    };

    console.log('Inserting unit data to Supabase:', unitData);
    const { data, error } = await supabase
      .from("units")
      .insert(unitData)
      .select()
      .single();

    if (error) {
      console.error('Supabase unit creation error:', error);
      throw error;
    }

    console.log('Supabase unit created:', data);

    // Convert snake_case to camelCase for frontend
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
      updatedAt: data.updated_at,
    };

    return mappedUnit as Unit;
  }
  async updateUnit(id: string, unit: Partial<InsertUnit>): Promise<Unit> {
    // Map camelCase to snake_case for Supabase
    const updateData: any = {};

    if (unit.propertyId !== undefined) updateData.property_id = unit.propertyId;
    if (unit.unitNumber !== undefined) updateData.unit_number = unit.unitNumber;
    if (unit.bedrooms !== undefined) updateData.bedrooms = unit.bedrooms;
    if (unit.bathrooms !== undefined) updateData.bathrooms = unit.bathrooms;
    if (unit.size !== undefined) updateData.size = unit.size;
    if (unit.rentAmount !== undefined) updateData.rent_amount = unit.rentAmount;
    if (unit.isOccupied !== undefined) updateData.is_occupied = unit.isOccupied;

    updateData.updated_at = new Date().toISOString();

    console.log('Updating unit data to Supabase:', updateData);
    const { data, error } = await supabase
      .from("units")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error('Supabase unit update error:', error);
      throw error;
    }

    console.log('Supabase unit updated:', data);

    // Convert snake_case to camelCase for frontend
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
      updatedAt: data.updated_at,
    };

    return updatedUnit as Unit;
  }
  async deleteUnit(id: string): Promise<void> {
    // TODO: Implement Supabase query
  }

  // Lease operations
  async getLeasesByOwnerId(ownerId: string): Promise<Lease[]> {
    try {
      console.log('Fetching leases for owner:', ownerId);

      // First, get all properties owned by this user
      const { data: properties, error: propertiesError } = await supabase
        .from("properties")
        .select("id")
        .eq("owner_id", ownerId);

      if (propertiesError) {
        console.error('Error fetching properties:', propertiesError);
        throw propertiesError;
      }

      if (!properties || properties.length === 0) {
        console.log('No properties found for owner:', ownerId);
        return [];
      }

      const propertyIds = properties.map(p => p.id);
      console.log('Found property IDs:', propertyIds);

      // Then get all units in those properties
      const { data: units, error: unitsError } = await supabase
        .from("units")
        .select("id")
        .in("property_id", propertyIds);

      if (unitsError) {
        console.error('Error fetching units:', unitsError);
        throw unitsError;
      }

      if (!units || units.length === 0) {
        console.log('No units found in properties');
        return [];
      }

      const unitIds = units.map(u => u.id);
      console.log('Found unit IDs:', unitIds);

      // Finally get all leases for those units
      const { data: leases, error: leasesError } = await supabase
        .from("leases")
        .select("*")
        .in("unit_id", unitIds)
        .order("created_at", { ascending: false });

      if (leasesError) {
        console.error('Error fetching leases:', leasesError);
        throw leasesError;
      }

      if (!leases || leases.length === 0) {
        console.log('No leases found for units');
        return [];
      }

      console.log('Fetched leases from Supabase:', leases.length);

      // Now fetch related data separately for each lease
      const leasesWithRelatedData = await Promise.all(
        leases.map(async (lease: any) => {
          // Get unit details
          const unit = await this.getUnitById(lease.unit_id);
          // Get tenant details
          const tenant = await this.getTenantById(lease.tenant_id);
          // Get property details for the unit
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
              propertyName: property?.name || 'Unknown Property'
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

      return leasesWithRelatedData as Lease[];
    } catch (error) {
      console.error('Error in getLeasesByOwnerId:', error);
      return [];
    }
  }
  async getLeasesByTenantId(tenantId: string): Promise<Lease[]> {
    try {
      console.log('Fetching leases for tenant:', tenantId);

      const { data: leases, error } = await supabase
        .from("leases")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });

      if (error) {
        console.error('Error fetching leases by tenant:', error);
        throw error;
      }

      if (!leases || leases.length === 0) {
        console.log('No leases found for tenant:', tenantId);
        return [];
      }

      console.log('Fetched leases for tenant:', leases.length);

      // Fetch related data separately for each lease
      const leasesWithRelatedData = await Promise.all(
        leases.map(async (lease: any) => {
          // Get unit details
          const unit = await this.getUnitById(lease.unit_id);
          // Get tenant details
          const tenant = await this.getTenantById(lease.tenant_id);
          // Get property details for the unit
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
              propertyName: property?.name || 'Unknown Property'
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

      return leasesWithRelatedData as Lease[];
    } catch (error) {
      console.error('Error in getLeasesByTenantId:', error);
      return [];
    }
  }
  async getLeaseById(id: string): Promise<Lease | undefined> {
    // TODO: Implement Supabase query
    return undefined;
  }
  async createLease(lease: InsertLease): Promise<Lease> {
    // Map camelCase to snake_case for Supabase
    const leaseData = {
      tenant_id: lease.tenantId,
      unit_id: lease.unitId,
      start_date: lease.startDate,
      end_date: lease.endDate,
      monthly_rent: lease.monthlyRent,
      security_deposit: lease.securityDeposit,
      lease_document_url: lease.leaseDocumentUrl,
      is_active: lease.isActive,
    };

    console.log('Inserting lease data to Supabase:', leaseData);
    const { data, error } = await supabase
      .from("leases")
      .insert(leaseData)
      .select()
      .single();

    if (error) {
      console.error('Supabase lease creation error:', error);
      throw error;
    }

    console.log('Supabase lease created:', data);

    // Convert snake_case to camelCase for frontend
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
      updatedAt: data.updated_at,
    };

    return createdLease as Lease;
  }
  async updateLease(id: string, lease: Partial<InsertLease>): Promise<Lease> {
    // TODO: Implement Supabase query
    return lease as Lease;
  }
  async deleteLease(id: string): Promise<void> {
    // TODO: Implement Supabase query
  }

  async getAllActiveLeases(): Promise<Lease[]> {
    const { data, error } = await supabase
      .from("leases")
      .select("*")
      .eq("is_active", true);
    if (error) throw error;

    // Convert snake_case to camelCase
    return (data || []).map(d => ({
      id: d.id,
      tenantId: d.tenant_id,
      unitId: d.unit_id,
      startDate: d.start_date,
      endDate: d.end_date,
      monthlyRent: d.monthly_rent,
      securityDeposit: d.security_deposit,
      leaseDocumentUrl: d.lease_document_url,
      isActive: d.is_active,
      createdAt: d.created_at,
      updatedAt: d.updated_at,
    })) as Lease[];
  }

  async hasRentPaymentForPeriod(leaseId: string, month: number, year: number): Promise<boolean> {
    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 0, 23, 59, 59, 999).toISOString();

    const { data, error } = await supabase
      .from("payments")
      .select("id")
      .eq("lease_id", leaseId)
      .eq("payment_type", "rent")
      .gte("due_date", startDate)
      .lte("due_date", endDate);

    if (error) throw error;
    return (data?.length || 0) > 0;
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

    // Map snake_case database fields to camelCase for frontend
    const mappedTenants = data?.map(tenant => ({
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

    return mappedTenants as Tenant[];
  }

  async getTenantById(id: string): Promise<Tenant | undefined> {
    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.log('getTenantById error:', error);
      return undefined;
    }

    if (!data) return undefined;

    // Convert snake_case to camelCase for consistency
    return {
      id: data.id,
      userId: data.user_id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      phone: data.phone,
      emergencyContact: data.emergency_contact,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    } as Tenant;
  }

  async getTenantByUserId(userId: string): Promise<Tenant | undefined> {
    const { data, error } = await supabase
      .from("tenants")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (error) {
      console.log('getTenantByUserId error:', error);
      return undefined;
    }

    if (!data) return undefined;

    return {
      id: data.id,
      userId: data.user_id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      phone: data.phone,
      emergencyContact: data.emergency_contact,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    } as Tenant;
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
    try {
      // First get all tenants for this owner using user_id field
      const { data: tenants, error: tenantsError } = await supabase
        .from("tenants")
        .select("id")
        .eq("user_id", ownerId);

      if (tenantsError) throw tenantsError;
      if (!tenants || tenants.length === 0) return [];

      const tenantIds = tenants.map(t => t.id);

      // Get all leases for these tenants
      const { data: leases, error: leasesError } = await supabase
        .from("leases")
        .select("id")
        .in("tenant_id", tenantIds);

      if (leasesError) throw leasesError;
      if (!leases || leases.length === 0) return [];

      const leaseIds = leases.map(l => l.id);

      // Now get all payments for these leases
      const { data: payments, error: paymentsError } = await supabase
        .from("payments")
        .select("*")
        .in("lease_id", leaseIds)
        .order("due_date", { ascending: false });

      if (paymentsError) throw paymentsError;

      // Map snake_case to camelCase for each payment
      const mappedPayments: Payment[] = (payments || []).map((payment: any) => ({
        id: payment.id,
        leaseId: payment.lease_id,
        amount: payment.amount,
        dueDate: payment.due_date,
        paidDate: payment.paid_date,
        paymentMethod: payment.payment_method,
        paymentType: payment.payment_type || 'rent',
        pesapalTransactionId: payment.pesapal_transaction_id,
        pesapalOrderTrackingId: payment.pesapal_order_tracking_id,
        status: payment.status,
        description: payment.description,
        receiptUrl: payment.receipt_url,
        createdAt: payment.created_at,
        updatedAt: payment.updated_at,
      }));

      return mappedPayments;
    } catch (error) {
      console.error("Error in getPaymentsByOwnerId:", error);
      return [];
    }
  }

  async getPaymentById(id: string): Promise<Payment | undefined> {
    const { data, error } = await supabase
      .from("payments")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;

    if (!data) return undefined;

    // Map snake_case to camelCase
    const payment: Payment = {
      id: data.id,
      leaseId: data.lease_id,
      amount: data.amount,
      dueDate: data.due_date,
      paidDate: data.paid_date,
      paymentMethod: data.payment_method,
      paymentType: data.payment_type || 'rent',
      pesapalTransactionId: data.pesapal_transaction_id,
      pesapalOrderTrackingId: data.pesapal_order_tracking_id,
      status: data.status,
      description: data.description,
      receiptUrl: data.receipt_url,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return payment;
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    // Map camelCase to snake_case for Supabase
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
      receipt_url: payment.receiptUrl,
    };

    console.log('Creating payment with data:', paymentData);
    const { data, error } = await supabase
      .from("payments")
      .insert([paymentData])
      .select()
      .single();

    if (error) {
      console.error('Payment creation error:', error);
      throw error;
    }

    console.log('Payment created:', data);

    // Convert snake_case to camelCase for frontend
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
      updatedAt: data.updated_at,
    };

    return createdPayment as Payment;
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
    // First get properties
    const { data: propertiesData, error: propertiesError } = await supabase
      .from("properties")
      .select("*")
      .eq("owner_id", ownerId)
      .order("name", { ascending: true });

    if (propertiesError) throw propertiesError;

    console.log('Raw property data from DB:', {
      ownerId,
      dataCount: propertiesData?.length || 0,
      firstPropertyRaw: propertiesData?.[0] ? Object.keys(propertiesData[0]) : 'none',
      firstPropertyData: propertiesData?.[0]
    });

    if (!propertiesData || propertiesData.length === 0) {
      return [];
    }

    // Get units for each property
    const propertiesWithUnits = await Promise.all(
      propertiesData.map(async (property) => {
        const units = await this.getUnitsByPropertyId(property.id);
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
          units: units, // Include units
        };
      })
    );

    return propertiesWithUnits as Property[];
  }

  // Get property by ID
  async getPropertyById(id: string): Promise<Property | undefined> {
    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("id", id)
      .single();

    if (error) {
      console.log('getPropertyById error:', error);
      return undefined;
    }

    if (!data) return undefined;

    // Convert snake_case to camelCase for consistency
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
      updatedAt: data.updated_at,
    };

    return property as Property;
  }

  // Create property
  async createProperty(property: InsertProperty): Promise<Property> {
    // Map camelCase fields to snake_case for Supabase
    const propertyData = {
      name: property.name,
      address: property.address,
      property_type: property.propertyType,
      total_units: 0, // Default to 0, will be updated when units are added
      description: property.description,
      owner_id: property.ownerId,
      // Note: imageUrl excluded as the column doesn't exist in the current database schema
    };

    const { data, error } = await supabase
      .from("properties")
      .insert([propertyData])
      .select()
      .single();
    if (error) {
      console.error("Error creating property:", error);
      throw error;
    }
    return data as Property;
  }

  // Update property
  async updateProperty(id: string, property: Partial<InsertProperty>): Promise<Property> {
    // Map camelCase fields to snake_case for Supabase
    const updateData: any = {
      updated_at: new Date().toISOString()
    };

    if (property.name) updateData.name = property.name;
    if (property.address) updateData.address = property.address;
    if (property.propertyType) updateData.property_type = property.propertyType;
    // totalUnits is auto-calculated, do not update directly
    if (property.description) updateData.description = property.description;
    if (property.ownerId) updateData.owner_id = property.ownerId;
    // Note: imageUrl excluded as the column doesn't exist in the current database schema

    const { data, error } = await supabase
      .from("properties")
      .update(updateData)
      .eq("id", id)
      .select()
      .single();
    if (error) {
      console.error("Error updating property:", error);
      throw error;
    }
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

  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("id", id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') {
        return undefined; // No rows returned
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
      updatedAt: data.updated_at,
    };

    return user as User;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // Map camelCase to snake_case for database
    const dbUserData: any = {
      updated_at: new Date().toISOString(),
    };
    if (userData.firstName !== undefined) {
      dbUserData.first_name = userData.firstName;
    }
    if (userData.lastName !== undefined) {
      dbUserData.last_name = userData.lastName;
    }
    if (userData.email !== undefined) {
      dbUserData.email = userData.email;
    }
    if (userData.profileImageUrl !== undefined) {
      dbUserData.profile_image_url = userData.profileImageUrl;
    }
    if (userData.role !== undefined) {
      dbUserData.role = userData.role;
    }

    const { data, error } = await supabase
      .from("users")
      .upsert(dbUserData, { onConflict: 'email' })
      .select()
      .single();

    if (error) throw error;

    // Map snake_case response back to camelCase
    const user = {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      profileImageUrl: data.profile_image_url,
      role: data.role,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return user as User;
  }

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
    // Map camelCase to snake_case for database
    const dbUserData: any = {
      updated_at: new Date().toISOString(),
    };

    if (userData.firstName !== undefined) {
      dbUserData.first_name = userData.firstName;
    }
    if (userData.lastName !== undefined) {
      dbUserData.last_name = userData.lastName;
    }
    if (userData.email !== undefined) {
      dbUserData.email = userData.email;
    }
    if (userData.profileImageUrl !== undefined) {
      dbUserData.profile_image_url = userData.profileImageUrl;
    }
    if (userData.role !== undefined) {
      dbUserData.role = userData.role;
    }

    const { data, error } = await supabase
      .from("users")
      .update(dbUserData)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;

    // Map snake_case response back to camelCase
    const user = {
      id: data.id,
      firstName: data.first_name,
      lastName: data.last_name,
      email: data.email,
      profileImageUrl: data.profile_image_url,
      role: data.role,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    };

    return user as User;
  }

  // Email Queue (implemented via direct DB for reliability)
  async enqueueEmail(email: InsertEmailQueue): Promise<EmailQueueItem> {
    const [newItem] = await db.insert(emailQueue).values(email).returning();
    return newItem;
  }

  async getPendingEmails(limit = 50): Promise<EmailQueueItem[]> {
    return await db
      .select()
      .from(emailQueue)
      .where(
        and(
          sql`${emailQueue.status} IN ('pending', 'failed')`,
          sql`${emailQueue.retryCount} < 5`
        )
      )
      .orderBy(asc(emailQueue.createdAt))
      .limit(limit);
  }

  async updateEmailStatus(id: string, update: Partial<EmailQueueItem>): Promise<EmailQueueItem> {
    const [updatedItem] = await db
      .update(emailQueue)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(emailQueue.id, id))
      .returning();
    return updatedItem;
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
  emailQueue,
  type EmailQueueItem,
  type InsertEmailQueue,
} from "../shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, sql, between } from "drizzle-orm";

export interface IStorage {
  // User operations (for authentication)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  updateUser(id: string, user: Partial<UpsertUser>): Promise<User>;

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

  // Email Queue operations
  enqueueEmail(email: InsertEmailQueue): Promise<EmailQueueItem>;
  getPendingEmails(limit?: number): Promise<EmailQueueItem[]>;
  updateEmailStatus(id: string, update: Partial<EmailQueueItem>): Promise<EmailQueueItem>;

  // Invoicing operations
  getAllActiveLeases(): Promise<Lease[]>;
  hasRentPaymentForPeriod(leaseId: string, month: number, year: number): Promise<boolean>;
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

  async updateUser(id: string, userData: Partial<UpsertUser>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({
        ...userData,
        updatedAt: new Date(),
      })
      .where(eq(users.id, id))
      .returning();

    if (!user) {
      throw new Error("User not found");
    }

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
    const [newProperty] = await db.insert(properties).values({
      ...property,
      totalUnits: 0, // Default to 0
    }).returning();
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
        landlordId: tenants.landlordId,
        userId: tenants.userId,
        firstName: tenants.firstName,
        lastName: tenants.lastName,
        email: tenants.email,
        phone: tenants.phone,
        emergencyContact: tenants.emergencyContact,
        invitationToken: tenants.invitationToken,
        invitationSentAt: tenants.invitationSentAt,
        invitationAcceptedAt: tenants.invitationAcceptedAt,
        accountStatus: tenants.accountStatus,
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

  async getAllActiveLeases(): Promise<Lease[]> {
    return await db.select().from(leases).where(eq(leases.isActive, true));
  }

  async hasRentPaymentForPeriod(leaseId: string, month: number, year: number): Promise<boolean> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59, 999);

    const existingPayments = await db
      .select()
      .from(payments)
      .where(
        and(
          eq(payments.leaseId, leaseId),
          eq(payments.paymentType, "rent"),
          between(payments.dueDate, startDate, endDate)
        )
      );

    return existingPayments.length > 0;
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
        paymentType: payments.paymentType,
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
        paymentType: payments.paymentType,
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

  // Email Queue implementation
  async enqueueEmail(email: InsertEmailQueue): Promise<EmailQueueItem> {
    const [newItem] = await db.insert(emailQueue).values(email).returning();
    return newItem;
  }

  async getPendingEmails(limit = 50): Promise<EmailQueueItem[]> {
    return await db
      .select()
      .from(emailQueue)
      .where(
        and(
          sql`${emailQueue.status} IN ('pending', 'failed')`,
          sql`${emailQueue.retryCount} < 5`
        )
      )
      .orderBy(asc(emailQueue.createdAt))
      .limit(limit);
  }

  async updateEmailStatus(id: string, update: Partial<EmailQueueItem>): Promise<EmailQueueItem> {
    const [updatedItem] = await db
      .update(emailQueue)
      .set({ ...update, updatedAt: new Date() })
      .where(eq(emailQueue.id, id))
      .returning();
    return updatedItem;
  }
}

export const storage = new DatabaseStorage();
