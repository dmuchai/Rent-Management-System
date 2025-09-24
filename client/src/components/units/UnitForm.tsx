import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface UnitFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  unit?: any;
}

export default function UnitForm({ open, onOpenChange, propertyId, unit }: UnitFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!unit;

  // Form state
  const [unitForm, setUnitForm] = useState({
    propertyId: propertyId,
    unitNumber: unit?.unitNumber || "",
    bedrooms: unit?.bedrooms || "",
    bathrooms: unit?.bathrooms || "",
    size: unit?.size || "",
    rentAmount: unit?.rentAmount || "",
    isOccupied: unit?.isOccupied || false,
  });

  const mutation = useMutation({
    mutationFn: async (data: any) => {
      const url = isEdit ? `/api/units/${unit.id}` : "/api/units";
      const method = isEdit ? "PUT" : "POST";
      const response = await apiRequest(method, url, data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/properties/${propertyId}/units`] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      toast({
        title: "Success",
        description: `Unit ${isEdit ? "updated" : "created"} successfully`,
      });
      onOpenChange(false);
      // Reset form
      setUnitForm({
        propertyId: propertyId,
        unitNumber: "",
        bedrooms: "",
        bathrooms: "",
        size: "",
        rentAmount: "",
        isOccupied: false,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || `Failed to ${isEdit ? "update" : "create"} unit`,
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    // Form validation
    if (!unitForm.unitNumber) {
      toast({
        title: "Error",
        description: "Please enter a unit number",
        variant: "destructive",
      });
      return;
    }
    if (!unitForm.rentAmount || parseFloat(unitForm.rentAmount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid rent amount",
        variant: "destructive",
      });
      return;
    }

    // Prepare data for submission
    const submitData = {
      ...unitForm,
      bedrooms: unitForm.bedrooms ? parseInt(unitForm.bedrooms) : null,
      bathrooms: unitForm.bathrooms ? parseInt(unitForm.bathrooms) : null,
      size: unitForm.size || null,
    };

    mutation.mutate(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Unit" : "Add New Unit"}</DialogTitle>
          <DialogDescription>
            {isEdit 
              ? "Update the unit information below" 
              : "Add a new unit to this property with rental details"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Unit Number */}
          <div>
            <Label htmlFor="unitNumber">Unit Number *</Label>
            <Input
              id="unitNumber"
              placeholder="e.g. A1, 101, Unit 1"
              value={unitForm.unitNumber}
              onChange={(e) => setUnitForm(prev => ({ ...prev, unitNumber: e.target.value }))}
            />
          </div>

          {/* Bedrooms and Bathrooms */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="bedrooms">Bedrooms</Label>
              <Input
                id="bedrooms"
                type="number"
                min="0"
                placeholder="0"
                value={unitForm.bedrooms}
                onChange={(e) => setUnitForm(prev => ({ ...prev, bedrooms: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="bathrooms">Bathrooms</Label>
              <Input
                id="bathrooms"
                type="number"
                min="0"
                step="0.5"
                placeholder="0"
                value={unitForm.bathrooms}
                onChange={(e) => setUnitForm(prev => ({ ...prev, bathrooms: e.target.value }))}
              />
            </div>
          </div>

          {/* Size and Rent Amount */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="size">Size (sq ft)</Label>
              <Input
                id="size"
                type="number"
                min="0"
                placeholder="e.g. 1200"
                value={unitForm.size}
                onChange={(e) => setUnitForm(prev => ({ ...prev, size: e.target.value }))}
              />
            </div>
            <div>
              <Label htmlFor="rentAmount">Monthly Rent (KES) *</Label>
              <Input
                id="rentAmount"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 25000"
                value={unitForm.rentAmount}
                onChange={(e) => setUnitForm(prev => ({ ...prev, rentAmount: e.target.value }))}
              />
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 p-4 rounded-lg">
            <h4 className="font-medium text-blue-900 mb-2">Unit Information:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• <strong>Unit Number:</strong> Unique identifier for this unit (required)</li>
              <li>• <strong>Bedrooms/Bathrooms:</strong> Help tenants find suitable units</li>
              <li>• <strong>Size:</strong> Square footage (optional but recommended)</li>
              <li>• <strong>Rent Amount:</strong> Monthly rent for this specific unit</li>
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
              {mutation.isPending ? "Saving..." : isEdit ? "Update Unit" : "Add Unit"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}