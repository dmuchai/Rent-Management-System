import { useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface LeaseFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lease?: any;
}

export default function LeaseForm({ open, onOpenChange, lease }: LeaseFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!lease;

  // Form state
  const [leaseForm, setLeaseForm] = useState({
    tenantId: lease?.tenantId || "",
    unitId: lease?.unitId || "",
    startDate: lease?.startDate ? new Date(lease.startDate).toISOString().split('T')[0] : "",
    endDate: lease?.endDate ? new Date(lease.endDate).toISOString().split('T')[0] : "",
    monthlyRent: lease?.monthlyRent || "",
    securityDeposit: lease?.securityDeposit || "",
    isActive: lease?.isActive ?? true,
  });

  // Fetch tenants and properties for dropdowns
  const { data: tenants = [], isLoading: tenantsLoading } = useQuery({
    queryKey: ["/api/tenants"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/tenants");
      return await response.json();
    },
    enabled: open,
  });

  const { data: properties = [], isLoading: propertiesLoading } = useQuery({
    queryKey: ["/api/properties"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/properties");
      return await response.json();
    },
    enabled: open,
  });

  // Get available units (not occupied by active leases)
  const availableUnits = properties.flatMap((property: any) =>
    (property.units || [])
      .filter((unit: any) => !unit.isOccupied || (isEdit && lease?.unitId === unit.id))
      .map((unit: any) => ({
        ...unit,
        propertyName: property.name,
        propertyAddress: property.address,
      }))
  );

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const url = isEdit ? `/api/leases/${lease.id}` : "/api/leases";
      const method = isEdit ? "PUT" : "POST";
      const response = await apiRequest(method, url, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/leases"] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] }); // Refresh to update unit occupancy
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: `Lease ${isEdit ? "updated" : "created"} successfully`,
      });
      onOpenChange(false);
      // Reset form
      setLeaseForm({
        tenantId: "",
        unitId: "",
        startDate: "",
        endDate: "",
        monthlyRent: "",
        securityDeposit: "",
        isActive: true,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEdit ? "update" : "create"} lease`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    // Form validation
    if (!leaseForm.tenantId) {
      toast({
        title: "Error",
        description: "Please select a tenant",
        variant: "destructive",
      });
      return;
    }
    if (!leaseForm.unitId) {
      toast({
        title: "Error", 
        description: "Please select a unit",
        variant: "destructive",
      });
      return;
    }
    if (!leaseForm.startDate) {
      toast({
        title: "Error",
        description: "Please select a start date",
        variant: "destructive",
      });
      return;
    }
    if (!leaseForm.endDate) {
      toast({
        title: "Error",
        description: "Please select an end date",
        variant: "destructive",
      });
      return;
    }
    if (!leaseForm.monthlyRent || parseFloat(leaseForm.monthlyRent) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid monthly rent amount",
        variant: "destructive",
      });
      return;
    }

    // Check that end date is after start date
    if (new Date(leaseForm.endDate) <= new Date(leaseForm.startDate)) {
      toast({
        title: "Error",
        description: "End date must be after start date",
        variant: "destructive",
      });
      return;
    }

    mutation.mutate(leaseForm);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Lease" : "Create New Lease"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Tenant Selection */}
          <div>
            <Label htmlFor="tenant">Tenant *</Label>
            <Select
              value={leaseForm.tenantId}
              onValueChange={(value) => setLeaseForm(prev => ({ ...prev, tenantId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a tenant" />
              </SelectTrigger>
              <SelectContent>
                {tenantsLoading ? (
                  <SelectItem value="loading" disabled>Loading tenants...</SelectItem>
                ) : tenants.length === 0 ? (
                  <SelectItem value="no-tenants" disabled>No tenants available - Add tenants first</SelectItem>
                ) : (
                  tenants.map((tenant: any) => (
                    <SelectItem key={tenant.id} value={tenant.id}>
                      {tenant.firstName} {tenant.lastName} - {tenant.email}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Unit Selection */}
          <div>
            <Label htmlFor="unit">Unit *</Label>
            <Select
              value={leaseForm.unitId}
              onValueChange={(value) => setLeaseForm(prev => ({ ...prev, unitId: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select a unit" />
              </SelectTrigger>
              <SelectContent>
                {propertiesLoading ? (
                  <SelectItem value="loading" disabled>Loading units...</SelectItem>
                ) : availableUnits.length === 0 ? (
                  <SelectItem value="no-units" disabled>No available units - Add properties and units first</SelectItem>
                ) : (
                  availableUnits.map((unit: any) => (
                    <SelectItem key={unit.id} value={unit.id}>
                      {unit.propertyName} - Unit {unit.unitNumber} (KES {unit.rentAmount}/month)
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Lease Dates */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startDate">Start Date *</Label>
              <Input
                id="startDate"
                type="date"
                value={leaseForm.startDate}
                onChange={(e) => setLeaseForm(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="endDate">End Date *</Label>
              <Input
                id="endDate"
                type="date"
                value={leaseForm.endDate}
                onChange={(e) => setLeaseForm(prev => ({ ...prev, endDate: e.target.value }))}
              />
            </div>
          </div>

          {/* Financial Terms */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="monthlyRent">Monthly Rent (KES) *</Label>
              <Input
                id="monthlyRent"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter monthly rent amount"
                value={leaseForm.monthlyRent}
                onChange={(e) => setLeaseForm(prev => ({ ...prev, monthlyRent: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="securityDeposit">Security Deposit (KES)</Label>
              <Input
                id="securityDeposit"
                type="number"
                step="0.01"
                min="0"
                placeholder="Enter security deposit (optional)"
                value={leaseForm.securityDeposit}
                onChange={(e) => setLeaseForm(prev => ({ ...prev, securityDeposit: e.target.value }))}
              />
            </div>
          </div>

          {/* Lease Status */}
          <div>
            <Label htmlFor="isActive">Lease Status</Label>
            <Select
              value={leaseForm.isActive ? "active" : "inactive"}
              onValueChange={(value) => setLeaseForm(prev => ({ ...prev, isActive: value === "active" }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Lease Agreement Information:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Tenant Selection:</strong> Choose the tenant who will occupy the unit</li>
              <li>• <strong>Unit Assignment:</strong> Select an available unit for this lease</li>
              <li>• <strong>Lease Term:</strong> Define the start and end dates of the lease agreement</li>
              <li>• <strong>Financial Terms:</strong> Set monthly rent and security deposit amounts</li>
              <li>• <strong>Payment Tracking:</strong> Once created, payments can be recorded against this lease</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit} 
              disabled={mutation.isPending}
            >
              {mutation.isPending ? "Saving..." : isEdit ? "Update Lease" : "Create Lease"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}