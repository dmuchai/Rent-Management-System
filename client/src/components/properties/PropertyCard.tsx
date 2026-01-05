import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Property } from "@shared/schema";
import PropertyDetailsModal from "@/components/units/PropertyDetailsModal";
import PropertyForm from "./PropertyForm";
import { Home, MapPin, TrendingUp, Edit, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PropertyCardProps {
  property: Property;
  occupancyRate?: number;
  occupiedCount?: number;
  availableCount?: number;
}

export default function PropertyCard({ property, occupancyRate = 0, occupiedCount = 0, availableCount = 0 }: PropertyCardProps) {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const defaultImage = "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300";

  const deletePropertyMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("DELETE", `/api/properties?id=${property.id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Property Deleted",
        description: "Property has been successfully removed",
      });
      setShowDeleteDialog(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete property",
        variant: "destructive",
      });
      setShowDeleteDialog(false);
    },
  });

  // Get occupancy badge color
  const getOccupancyBadge = () => {
    if (occupancyRate >= 90) {
      return <Badge className="bg-green-100 text-green-800 hover:bg-green-100">High: {occupancyRate}%</Badge>;
    } else if (occupancyRate >= 50) {
      return <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">Medium: {occupancyRate}%</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800 hover:bg-red-100">Low: {occupancyRate}%</Badge>;
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden" data-testid={`property-card-${property.id}`}>
      <img 
        src={property.imageUrl || defaultImage}
        alt={property.name}
        className="w-full h-48 object-cover"
        data-testid={`property-image-${property.id}`}
      />
      <div className="p-6">
        <div className="flex items-start justify-between mb-2">
          <h3 className="text-lg font-semibold" data-testid={`property-name-${property.id}`}>
            {property.name}
          </h3>
          {getOccupancyBadge()}
        </div>
        
        <div className="flex items-center gap-1 text-muted-foreground text-sm mb-4" data-testid={`property-address-${property.id}`}>
          <MapPin className="h-3 w-3" />
          {property.address}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <Home className="h-4 w-4 text-primary" />
              <span className="text-xs text-muted-foreground">Total Units</span>
            </div>
            <span className="font-bold text-xl" data-testid={`property-units-${property.id}`}>
              {property.totalUnits}
            </span>
          </div>
          
          <div className="bg-muted/50 p-3 rounded-lg">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="h-4 w-4 text-green-600" />
              <span className="text-xs text-muted-foreground">Type</span>
            </div>
            <span className="font-semibold text-sm" data-testid={`property-type-${property.id}`}>
              {property.propertyType}
            </span>
          </div>
        </div>

        {/* Occupancy Stats */}
        <div className="flex items-center justify-between text-sm mb-4 p-3 bg-blue-50 rounded-lg">
          <div>
            <p className="text-xs text-muted-foreground">Available</p>
            <p className="font-bold text-green-600">{availableCount}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">Occupied</p>
            <p className="font-bold text-blue-600">{occupiedCount}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Occupancy</p>
            <p className="font-bold">{occupancyRate}%</p>
          </div>
        </div>

        <div className="flex space-x-2">
          <Button 
            className="flex-1" 
            size="sm"
            onClick={() => setShowDetailsModal(true)}
            data-testid={`button-view-property-${property.id}`}
          >
            View Details
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowEditForm(true)}
            data-testid={`button-edit-property-${property.id}`}
            title="Edit property"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setShowDeleteDialog(true)}
            data-testid={`button-delete-property-${property.id}`}
            className="hover:bg-red-50 hover:text-red-600 hover:border-red-300"
            title="Delete property"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Property Details Modal */}
      <PropertyDetailsModal
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
        propertyId={property.id}
      />

      {/* Edit Property Form */}
      <PropertyForm
        open={showEditForm}
        onOpenChange={setShowEditForm}
        property={property}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Property</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{property.name}"? This action cannot be undone and will remove all associated units and data.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletePropertyMutation.mutate()}
              className="bg-red-600 hover:bg-red-700"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
