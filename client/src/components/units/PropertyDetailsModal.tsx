import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { MapPin, Home, Plus, Users, FileText } from "lucide-react";
import UnitForm from "./UnitForm";
import UnitTable from "./UnitTable";
import { Unit } from "@/../../shared/schema";

interface PropertyDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
}

export default function PropertyDetailsModal({ open, onOpenChange, propertyId }: PropertyDetailsModalProps) {
  const [showUnitForm, setShowUnitForm] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);

  // Fetch property details
  const { data: property, isLoading } = useQuery({
    queryKey: [`/api/properties/${propertyId}`],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/properties/${propertyId}`);
      return await response.json();
    },
    enabled: !!propertyId && open,
  });

  // Fetch units for this property
  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: [`/api/properties/${propertyId}/units`],
    queryFn: async (): Promise<Unit[]> => {
      const response = await apiRequest("GET", `/api/properties/${propertyId}/units`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch units: ${response.status} ${response.statusText}`);
      }
      
      return await response.json() as Unit[];
    },
    enabled: !!propertyId && open,
  });

  const handleEditUnit = (unit: Unit) => {
    setEditingUnit(unit);
    setShowUnitForm(true);
  };

  const handleAddUnit = () => {
    setEditingUnit(null);
    setShowUnitForm(true);
  };

  const handleCloseUnitForm = () => {
    setShowUnitForm(false);
    setEditingUnit(null);
  };

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading property details...</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!property) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl">
          <div className="text-center py-8">
            <div className="text-red-500">Failed to load property details</div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const availableUnits = units.filter((unit: Unit) => !unit.isOccupied).length;
  const occupiedUnits = units.filter((unit: Unit) => unit.isOccupied).length;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Home className="h-5 w-5" />
              {property.name}
            </DialogTitle>
            <DialogDescription>
              Manage units, leases, and property details for {property.name}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6">
            {/* Property Overview */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="h-4 w-4 text-gray-600" />
                  <span className="font-medium">Location</span>
                </div>
                <p className="text-sm text-gray-700">{property.address}</p>
              </div>

              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Home className="h-4 w-4 text-blue-600" />
                  <span className="font-medium">Total Units</span>
                </div>
                <p className="text-2xl font-bold text-blue-600">{units.length}</p>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Occupancy</span>
                </div>
                <div className="flex gap-2">
                  <Badge variant="default">{availableUnits} Available</Badge>
                  <Badge variant="destructive">{occupiedUnits} Occupied</Badge>
                </div>
              </div>
            </div>

            {/* Property Description */}
            {property.description && (
              <div>
                <h3 className="font-medium mb-2">Description</h3>
                <p className="text-gray-700 text-sm bg-gray-50 p-3 rounded-lg">
                  {property.description}
                </p>
              </div>
            )}

            {/* Tabs for different sections */}
            <Tabs defaultValue="units" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="units">Units Management</TabsTrigger>
                <TabsTrigger value="leases">Active Leases</TabsTrigger>
                <TabsTrigger value="financials">Financials</TabsTrigger>
              </TabsList>

              <TabsContent value="units" className="space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-lg font-medium">Units</h3>
                    <p className="text-sm text-gray-600">
                      Manage all units in this property
                    </p>
                  </div>
                  <Button onClick={handleAddUnit} className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add Unit
                  </Button>
                </div>

                <UnitTable 
                  propertyId={propertyId} 
                  onEditUnit={handleEditUnit} 
                />
              </TabsContent>

              <TabsContent value="leases" className="space-y-4">
                <div className="text-center py-8">
                  <FileText className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Lease Management</h3>
                  <p className="text-gray-500">
                    Lease management for this property will be available here.
                  </p>
                </div>
              </TabsContent>

              <TabsContent value="financials" className="space-y-4">
                <div className="text-center py-8">
                  <div className="mx-auto h-16 w-16 bg-gray-100 rounded-full flex items-center justify-center mb-4">
                    <span className="text-2xl">💰</span>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Financial Overview</h3>
                  <p className="text-gray-500">
                    Property financial data and reports will be available here.
                  </p>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unit Form Modal */}
      <UnitForm
        open={showUnitForm}
        onOpenChange={handleCloseUnitForm}
        propertyId={propertyId}
        unit={editingUnit}
      />
    </>
  );
}