import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { insertPropertySchema, type InsertProperty } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { supabase } from "@/lib/supabase";
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
  const [pendingImage, setPendingImage] = useState<File | null>(null);
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

  useEffect(() => () => {
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  // Reset form when property changes or dialog opens
  useEffect(() => {
    if (!open) {
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
      setPendingImage(null);
      setImagePreview(null);
      return;
    }
    if (open) {
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
      form.reset({
        name: property?.name || "",
        address: property?.address || "",
        propertyType: property?.propertyType || "",
        description: property?.description || "",
        imageUrl: property?.imageUrl || "",
      });
      setImagePreview(property?.imageUrl || null);
      setPendingImage(null);
    }
  }, [property, open, form]);

  const handleImageUpload = async (file: File) => {
    try {
      const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
      if (!allowedTypes.has(file.type)) {
        throw new Error("Unsupported image type. Use JPEG, PNG, WebP, or GIF.");
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error("Image must be 5 MB or smaller.");
      }

      setPendingImage(file);
      setImagePreview((previous) => {
        if (previous?.startsWith("blob:")) URL.revokeObjectURL(previous);
        return URL.createObjectURL(file);
      });
      
      toast({
        title: "Image selected",
        description: "The image will be uploaded when you save the property.",
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
    }
  };

  const handleImageRemove = () => {
    if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
    setPendingImage(null);
    form.setValue('imageUrl', '');
    setImagePreview(null);
  };

  const mutation = useMutation({
    onMutate: () => setUploading(true),
    mutationFn: async (data: InsertProperty) => {
      const url = isEdit ? `/api/properties?id=${property.id}` : "/api/properties";
      const method = isEdit ? "PUT" : "POST";
      const { imageUrl, ...propertyData } = data;
      const payload = pendingImage
        ? propertyData
        : imageUrl?.startsWith("/api/property-images")
          ? propertyData
          : { ...propertyData, imageUrl: imageUrl || "" };
      const response = await apiRequest(method, url, payload);
      const savedProperty = await response.json();
      if (pendingImage) {
        const propertyId = savedProperty.id || property?.id;
        if (!propertyId) throw new Error("Property ID is required before uploading an image");
        let path: string | undefined;
        try {
          const prepareResponse = await apiRequest("POST", `/api/property-images/${encodeURIComponent(propertyId)}`, {
            action: "prepare",
            contentType: pendingImage.type,
            size: pendingImage.size,
          });
          const prepared = await prepareResponse.json();
          if (typeof prepared.path !== "string" || typeof prepared.token !== "string") {
            throw new Error("Private image upload preparation failed");
          }
          path = prepared.path;
          const { error: uploadError } = await supabase.storage
            .from("property-images")
            .uploadToSignedUrl(prepared.path, prepared.token, pendingImage);
          if (uploadError) throw new Error("Private image upload failed");
          const imageResponse = await apiRequest(
            "POST",
            `/api/property-images/${encodeURIComponent(propertyId)}`,
            { action: "complete", path },
          );
          const imageData = await imageResponse.json();
          savedProperty.imageUrl = imageData.imageUrl;
        } catch (error) {
          if (path) {
            await apiRequest("DELETE", `/api/property-images/${encodeURIComponent(propertyId)}`, { path }).catch(() => undefined);
          }
          console.error("Property saved but image upload failed", error);
          return { ...savedProperty, imageUploadFailed: true };
        }
      }
      return savedProperty;
    },
    onSuccess: (savedProperty) => {
      queryClient.invalidateQueries({ queryKey: ["/api/properties"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
      toast(savedProperty.imageUploadFailed
        ? { title: "Property saved", description: "The property was saved, but the image could not be uploaded. You can try again when editing it.", variant: "destructive" }
        : { title: "Success", description: isEdit ? "Property updated successfully" : "Property created! Now add units with rent amounts by clicking 'View Details'" });
      onOpenChange(false);
      setPendingImage(null);
      if (imagePreview?.startsWith("blob:")) URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
      // Only reset form for new properties, not edits
      if (!isEdit) {
        form.reset();
      }
    },
    onSettled: () => setUploading(false),
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });

        setTimeout(() => {
          window.location.href = "/login";
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
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
                              accept="image/jpeg,image/png,image/webp,image/gif"
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
                            value={field.value || ''}
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
