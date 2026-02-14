import { useState, useMemo, useEffect } from "react";
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
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);
  const [unitStatusFilter, setUnitStatusFilter] = useState<"all" | "occupied" | "available">("all");

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

  useEffect(() => {
    if (filteredProperties.length === 0) {
      setSelectedPropertyId(null);
      return;
    }

    if (!selectedPropertyId) {
      setSelectedPropertyId(filteredProperties[0].id);
      return;
    }

    const stillExists = filteredProperties.some((property) => property.id === selectedPropertyId);
    if (!stillExists) {
      setSelectedPropertyId(filteredProperties[0].id);
    }
  }, [filteredProperties, selectedPropertyId]);

  const selectedProperty = filteredProperties.find((property) => property.id === selectedPropertyId) || filteredProperties[0];
  const selectedUnits = selectedProperty?.actualUnits || [];
  const filteredUnits = selectedUnits.filter((unit: any) => {
    if (unitStatusFilter === "occupied") return unit.isOccupied;
    if (unitStatusFilter === "available") return !unit.isOccupied;
    return true;
  });

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

      {/* Properties & Units Layout */}
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
        <div className="grid gap-6 lg:grid-cols-[1.15fr,0.85fr]">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h3 className="text-sm font-semibold">Property List</h3>
                <p className="text-xs text-muted-foreground">Select a property to view details and units.</p>
              </div>
              <div className="divide-y divide-border">
                {filteredProperties.map((property) => {
                  const isSelected = property.id === selectedPropertyId;
                  return (
                    <button
                      key={property.id}
                      onClick={() => setSelectedPropertyId(property.id)}
                      className={`w-full text-left px-4 py-3 transition-colors ${
                        isSelected ? "bg-primary/10" : "hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold">{property.name}</p>
                          <p className="text-xs text-muted-foreground">{property.address}</p>
                        </div>
                        <span className="text-xs font-medium text-muted-foreground">
                          {property.occupancyRate}% occupied
                        </span>
                      </div>
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span>{property.actualUnits?.length || property.totalUnits} units</span>
                        <span>•</span>
                        <span>{property.availableCount} available</span>
                        <span>•</span>
                        <span>{property.propertyType}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            {selectedProperty ? (
              <>
                <PropertyCard
                  property={selectedProperty}
                  occupancyRate={selectedProperty.occupancyRate}
                  occupiedCount={selectedProperty.occupiedCount}
                  availableCount={selectedProperty.availableCount}
                />
                <div className="rounded-xl border border-border bg-card">
                  <div className="border-b border-border px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-semibold">Units Snapshot</h3>
                        <p className="text-xs text-muted-foreground">Latest units for this property.</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setUnitStatusFilter("all")}
                          className={`text-xs px-2 py-1 rounded-md border ${
                            unitStatusFilter === "all"
                              ? "border-primary text-primary"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          All
                        </button>
                        <button
                          type="button"
                          onClick={() => setUnitStatusFilter("occupied")}
                          className={`text-xs px-2 py-1 rounded-md border ${
                            unitStatusFilter === "occupied"
                              ? "border-primary text-primary"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          Occupied
                        </button>
                        <button
                          type="button"
                          onClick={() => setUnitStatusFilter("available")}
                          className={`text-xs px-2 py-1 rounded-md border ${
                            unitStatusFilter === "available"
                              ? "border-primary text-primary"
                              : "border-border text-muted-foreground"
                          }`}
                        >
                          Available
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="px-4 py-4">
                    {selectedUnits.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-sm text-muted-foreground">No units added yet.</p>
                        <p className="text-xs text-muted-foreground">Use View Details to add units.</p>
                      </div>
                    ) : filteredUnits.length === 0 ? (
                      <div className="text-center py-6">
                        <p className="text-sm text-muted-foreground">No units match this filter.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {filteredUnits.slice(0, 6).map((unit: any) => (
                          <div key={unit.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                            <div>
                              <p className="text-sm font-medium">Unit {unit.unitNumber}</p>
                              <p className="text-xs text-muted-foreground">
                                {unit.bedrooms ? `${unit.bedrooms} bed` : ""}
                                {unit.bathrooms ? ` • ${unit.bathrooms} bath` : ""}
                                {unit.rentAmount ? ` • KES ${parseFloat(unit.rentAmount).toLocaleString()}` : ""}
                              </p>
                            </div>
                            <span className={`text-xs font-medium ${unit.isOccupied ? "text-emerald-600" : "text-muted-foreground"}`}>
                              {unit.isOccupied ? "Occupied" : "Available"}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-border bg-card p-6 text-center">
                <p className="text-sm text-muted-foreground">Select a property to view details.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
