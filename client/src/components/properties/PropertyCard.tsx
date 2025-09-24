import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Property } from "@shared/schema";
import PropertyDetailsModal from "@/components/units/PropertyDetailsModal";

interface PropertyCardProps {
  property: Property;
}

export default function PropertyCard({ property }: PropertyCardProps) {
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const defaultImage = "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&h=300";

  return (
    <div className="bg-card rounded-xl border border-border overflow-hidden" data-testid={`property-card-${property.id}`}>
      <img 
        src={property.imageUrl || defaultImage}
        alt={property.name}
        className="w-full h-48 object-cover"
        data-testid={`property-image-${property.id}`}
      />
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-2" data-testid={`property-name-${property.id}`}>
          {property.name}
        </h3>
        <p className="text-muted-foreground text-sm mb-4" data-testid={`property-address-${property.id}`}>
          {property.address}
        </p>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-muted-foreground">Units:</span>
            <span className="font-medium ml-1" data-testid={`property-units-${property.id}`}>
              {property.totalUnits}
            </span>
          </div>
          <div>
            <span className="text-muted-foreground">Type:</span>
            <span className="font-medium ml-1" data-testid={`property-type-${property.id}`}>
              {property.propertyType}
            </span>
          </div>
        </div>
        <div className="flex space-x-2 mt-4">
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
            data-testid={`button-edit-property-${property.id}`}
          >
            <i className="fas fa-edit"></i>
          </Button>
        </div>
      </div>
      
      {/* Property Details Modal */}
      <PropertyDetailsModal
        open={showDetailsModal}
        onOpenChange={setShowDetailsModal}
        propertyId={property.id}
      />
    </div>
  );
}
