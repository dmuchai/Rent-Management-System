import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { insertPropertySchema, type InsertProperty } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { supabase } from "@/lib/supabase";
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
import { Upload, X } from "lucide-react";

interface PropertyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  property?: any;
}

export default function PropertyForm({ open, onOpenChange, property }: PropertyFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!property;
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(property?.imageUrl || null);

  const form = useForm<InsertProperty>({
    resolver: zodResolver(insertPropertySchema.omit({ ownerId: true })),
    defaultValues: {
      name: property?.name || "",
      address: property?.address || "",
      propertyType: property?.propertyType || "",
      description: property?.description || "",
      imageUrl: property?.imageUrl || "",
    },
  });

  // Reset form when property changes or dialog opens
  useEffect(() => {
    if (open) {
      form.reset({
        name: property?.name || "",
        address: property?.address || "",
        propertyType: property?.propertyType || "",
        description: property?.description || "",
        imageUrl: property?.imageUrl || "",
      });
      setImagePreview(property?.imageUrl || null);
    }
  }, [property, open, form]);

  const handleImageUpload = async (file: File) => {
    try {
      setUploading(true);
      
      // Generate unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `property-images/${fileName}`;
      
      // Upload to Supabase Storage
      const { data, error } = await supabase.storage
        .from('property-images')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (error) throw error;
      
      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('property-images')
        .getPublicUrl(filePath);
      
      form.setValue('imageUrl', publicUrl);
      setImagePreview(publicUrl);
      
      toast({
        title: "Success",
        description: "Image uploaded successfully",
      });
    } catch (error: any) {
      console.error('Error uploading image:', error);
      
      // Check if it's a bucket not found error
      const isBucketError = error?.message?.includes('Bucket not found') || 
                           error?.statusCode === 404 || 
                           error?.status === 400;
      
      toast({
        title: "Error",
        description: isBucketError 
          ? "Storage bucket not configured. Please create 'property-images' bucket in Supabase Storage or enter image URL manually."
          : "Failed to upload image",
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleImageRemove = () => {
    form.setValue('imageUrl', '');
    setImagePreview(null);
  };

  const mutation = useMutation({
    mutationFn: async (data: InsertProperty) => {
      const url = isEdit ? `/api/properties?id=${property.id}` : "/api/properties";
      const method = isEdit ? "PUT" : "POST";
      const response = await apiRequest(method, url, data);
      console.log('API response:', response);
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast({
        title: "Success",
        description: isEdit 
          ? "Property updated successfully" 
          : "Property created! Now add units with rent amounts by clicking 'View Details'",
      });
      onOpenChange(false);
      // Only reset form for new properties, not edits
      if (!isEdit) {
        form.reset();
      }
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
    console.log('Form submission data:', data);
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
                    <Select onValueChange={field.onChange} value={field.value}>
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
                  <FormLabel>Property Image (Optional)</FormLabel>
                  <FormControl>
                    <div className="space-y-4">
                      {imagePreview ? (
                        <div className="space-y-2">
                          <div className="relative">
                            <img
                              src={imagePreview}
                              alt="Property preview"
                              className="w-full h-48 object-cover rounded-lg"
                            />
                            <Button
                              type="button"
                              variant="destructive"
                              size="icon"
                              className="absolute top-2 right-2"
                              onClick={handleImageRemove}
                              disabled={uploading}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                          <p className="text-sm text-green-600">
                            ✓ Image ready. Click "{isEdit ? 'Update' : 'Create'} Property" to save.
                          </p>
                        </div>
                      ) : (
                        <>
                          <div className="border-2 border-dashed rounded-lg p-8 text-center">
                            <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                            <p className="text-sm text-muted-foreground mb-4">
                              Click to upload an image
                            </p>
                            <Input
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) handleImageUpload(file);
                              }}
                              disabled={uploading}
                              className="cursor-pointer"
                            />
                            {uploading && (
                              <p className="text-sm text-muted-foreground mt-2">
                                Uploading...
                              </p>
                            )}
                          </div>
                          <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                              <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                              <span className="bg-background px-2 text-muted-foreground">
                                Or paste URL
                              </span>
                            </div>
                          </div>
                          <Input
                            type="url"
                            placeholder="https://example.com/image.jpg"
                            {...field}
                            onChange={(e) => {
                              field.onChange(e);
                              setImagePreview(e.target.value || null);
                            }}
                            disabled={uploading}
                          />
                        </>
                      )}
                    </div>
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
