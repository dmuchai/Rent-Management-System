import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Edit, Trash2, Home } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Unit } from "@/../../shared/schema";

interface UnitTableProps {
  propertyId: string;
  onEditUnit: (unit: Unit) => void;
}

export default function UnitTable({ propertyId, onEditUnit }: UnitTableProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch units for this property
  const { data: units = [], isLoading } = useQuery<Unit[]>({
    queryKey: [`/api/units`, propertyId],
    queryFn: async (): Promise<Unit[]> => {
      const response = await apiRequest("GET", `/api/units?propertyId=${propertyId}`);

      if (!response.ok) {
        throw new Error(`Failed to fetch units: ${response.status} ${response.statusText}`);
      }

      return await response.json() as Unit[];
    },
  });

  // Delete unit mutation
  const deleteMutation = useMutation({
    mutationFn: async (unitId: string) => {
      const response = await apiRequest("DELETE", `/api/units/${unitId}`);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to delete unit: ${response.status} ${response.statusText}${errorText ? ` - ${errorText}` : ''}`);
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/units`, propertyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      toast({
        title: "Success",
        description: "Unit deleted successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to delete unit",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-gray-500">Loading units...</div>
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div className="text-center py-8">
        <Home className="mx-auto h-16 w-16 text-gray-300 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No Units Found</h3>
        <p className="text-gray-500 mb-4">
          This property doesn't have any units yet. Add some units to start managing leases.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Unit Number</TableHead>
              <TableHead>Bedrooms</TableHead>
              <TableHead>Monthly Rent</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {units.map((unit: Unit) => (
              <TableRow key={unit.id}>
                <TableCell className="font-medium">{unit.unitNumber}</TableCell>
                <TableCell>{unit.bedrooms || "-"}</TableCell>
                <TableCell>KES {Number(unit.rentAmount).toLocaleString()}</TableCell>
                <TableCell>
                  <Badge variant={unit.isOccupied ? "destructive" : "default"}>
                    {unit.isOccupied ? "Occupied" : "Available"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onEditUnit(unit)}
                    >
                      <Edit className="h-4 w-4" />
                    </Button>

                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Unit</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete unit "{unit.unitNumber}"?
                            This action cannot be undone and will remove all associated data.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => deleteMutation.mutate(unit.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Delete Unit
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="text-sm text-gray-500">
        Showing {units.length} unit{units.length !== 1 ? "s" : ""}
      </div>
    </div>
  );
}