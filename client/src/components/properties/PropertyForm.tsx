import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { insertPropertySchema, type InsertProperty } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PropertyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: any;
}

export default function PropertyForm({ open, onOpenChange, property }: PropertyFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!property;

  const form = useForm<InsertProperty>({
    resolver: zodResolver(insertPropertySchema.omit({ ownerId: true })),
    defaultValues: {
      name: property?.name || "",
      address: property?.address || "",
      propertyType: property?.propertyType || "",
      totalUnits: property?.totalUnits || 1,
      description: property?.description || "",
      imageUrl: property?.imageUrl || "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertProperty) => {
      const url = isEdit ? `/api/properties?id=${property.id}` : "/api/properties";
      const method = isEdit ? "PUT" : "POST";
      return await apiRequest(method, url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      toast({
        title: "Success",
        description: isEdit 
          ? "Property updated successfully" 
          : "Property created! Now add units with rent amounts by clicking 'View Details'",
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = `${import.meta.env.VITE_API_BASE_URL || 'https://rent-management-backend.onrender.com'}/api/login`;
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: `Failed to ${isEdit ? "update" : "create"} property`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertProperty) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle data-testid="property-form-title">
            {isEdit ? "Edit Property" : "Add New Property"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Property Name</FormLabel>
                  <FormControl>
                    <Input placeholder="Sunrise Apartments" {...field} data-testid="input-property-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="address"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Address</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="123 Kimathi Street, Nairobi" 
                      {...field} 
                      data-testid="input-property-address"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="propertyType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Property Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-property-type">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="apartment">Apartment</SelectItem>
                        <SelectItem value="villa">Villa</SelectItem>
                        <SelectItem value="house">House</SelectItem>
                        <SelectItem value="townhouse">Townhouse</SelectItem>
                        <SelectItem value="commercial">Commercial</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="totalUnits"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Total Units</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="1"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                        data-testid="input-total-units"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (Optional)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Modern apartment complex with amenities..." 
                      {...field}
                      value={field.value || ""}
                      data-testid="input-property-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="imageUrl"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Image URL (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="https://example.com/image.jpg" 
                      {...field}
                      value={field.value || ""}
                      data-testid="input-property-image"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-property"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-save-property"
              >
                {mutation.isPending ? "Saving..." : isEdit ? "Update Property" : "Create Property"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
