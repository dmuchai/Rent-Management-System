import { useState, useMemo } from "react";
import { Property, Unit } from "@shared/schema";
import PropertyCard from "./PropertyCard";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Filter, SortAsc } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PropertyGridProps {
  properties: Property[];
  units: Unit[];
  loading?: boolean;
  onAddProperty: () => void;
}

export default function PropertyGrid({ properties, units, loading, onAddProperty }: PropertyGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("name");

  // Calculate occupancy for each property
  const propertiesWithStats = useMemo(() => {
    return properties.map(property => {
      const propertyUnits = units.filter(u => u.propertyId === property.id);
      const occupiedCount = propertyUnits.filter(u => u.isOccupied).length;
      const totalUnits = propertyUnits.length || property.totalUnits;
      const occupancyRate = totalUnits > 0 ? (occupiedCount / totalUnits) * 100 : 0;

      return {
        ...property,
        actualUnits: propertyUnits,
        occupiedCount,
        availableCount: totalUnits - occupiedCount,
        occupancyRate: Math.round(occupancyRate),
      };
    });
  }, [properties, units]);

  // Filter and search properties
  const filteredProperties = useMemo(() => {
    let filtered = propertiesWithStats;

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(property => 
        property.name.toLowerCase().includes(query) ||
        property.address.toLowerCase().includes(query) ||
        property.propertyType.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (filterType !== "all") {
      filtered = filtered.filter(property => property.propertyType === filterType);
    }

    // Create shallow copy before sorting to avoid mutating original array
    filtered = [...filtered];

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case "name":
          return a.name.localeCompare(b.name);
        case "units":
          return (b.actualUnits?.length || 0) - (a.actualUnits?.length || 0);
        case "occupancy":
          return b.occupancyRate - a.occupancyRate;
        case "available":
          return b.availableCount - a.availableCount;
        default:
          return 0;
      }
    });

    return filtered;
  }, [propertiesWithStats, searchQuery, filterType, sortBy]);

  // Get unique property types for filter
  const propertyTypes = useMemo(() => {
    const types = new Set(properties.map(p => p.propertyType));
    return Array.from(types);
  }, [properties]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (properties.length === 0) {
    return (
      <div className="text-center py-12">
        <i className="fas fa-building text-4xl text-muted-foreground mb-4"></i>
        <p className="text-muted-foreground text-lg" data-testid="text-noproperties">
          No properties added yet
        </p>
        <p className="text-muted-foreground mb-4">Add your first property to get started</p>
        <Button onClick={onAddProperty}>
          <i className="fas fa-plus mr-2"></i>Add Property
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Add Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-semibold">Properties</h2>
          <p className="text-sm text-muted-foreground">
            {filteredProperties.length} of {properties.length} properties
          </p>
        </div>
        <Button 
          onClick={onAddProperty}
          data-testid="button-addproperty"
        >
          <i className="fas fa-plus mr-2"></i>Add Property
        </Button>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search by name, address, or type..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-40">
              <Filter className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Filter type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {propertyTypes.map(type => (
                <SelectItem key={type} value={type}>{type}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40">
              <SortAsc className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Name</SelectItem>
              <SelectItem value="units">Most Units</SelectItem>
              <SelectItem value="occupancy">Occupancy</SelectItem>
              <SelectItem value="available">Available Units</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Results Info */}
      {(searchQuery || filterType !== "all") && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Showing {filteredProperties.length} result{filteredProperties.length !== 1 ? 's' : ''}
          </p>
          {(searchQuery || filterType !== "all") && (
            <Button 
              variant="link" 
              onClick={() => {
                setSearchQuery("");
                setFilterType("all");
              }}
              className="h-auto p-0"
            >
              Clear filters
            </Button>
          )}
        </div>
      )}

      {/* Property Grid */}
      {filteredProperties.length === 0 ? (
        <div className="text-center py-12">
          <i className="fas fa-search text-4xl text-muted-foreground mb-4 block"></i>
          <p className="text-muted-foreground text-lg">
            No properties match your search criteria
          </p>
          <Button 
            variant="link" 
            onClick={() => {
              setSearchQuery("");
              setFilterType("all");
            }}
            className="mt-2"
          >
            Clear filters
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProperties.map((property) => (
            <PropertyCard 
              key={property.id} 
              property={property}
              occupancyRate={property.occupancyRate}
              occupiedCount={property.occupiedCount}
              availableCount={property.availableCount}
            />
          ))}
        </div>
      )}
    </div>
  );
}
