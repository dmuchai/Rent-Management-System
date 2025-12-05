import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { insertTenantSchema, type InsertTenant } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { buildPath } from "@/lib/config";
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
import { Button } from "@/components/ui/button";

interface TenantFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant?: any;
}

export default function TenantForm({ open, onOpenChange, tenant }: TenantFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = !!tenant;

  const form = useForm<InsertTenant>({
    resolver: zodResolver(insertTenantSchema),
    defaultValues: {
      firstName: tenant?.firstName || "",
      lastName: tenant?.lastName || "",
      email: tenant?.email || "",
      phone: tenant?.phone || "",
      emergencyContact: tenant?.emergencyContact || "",
      userId: tenant?.userId || undefined,
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: InsertTenant) => {
      const url = isEdit ? `/api/tenants/${tenant.id}` : "/api/tenants";
      const method = isEdit ? "PUT" : "POST";
      return await apiRequest(method, url, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      toast({
        title: "Success",
        description: `Tenant ${isEdit ? "updated" : "created"} successfully`,
      });
      onOpenChange(false);
      form.reset();
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "Session expired. Redirecting to login...",
          variant: "destructive",
        });
        setTimeout(() => {
          // Use buildPath to support subdirectory deployments
          window.location.href = buildPath('api/login');
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: `Failed to ${isEdit ? "update" : "create"} tenant`,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: InsertTenant) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle data-testid="tenant-form-title">
            {isEdit ? "Edit Tenant" : "Add New Tenant"}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John" {...field} data-testid="input-tenant-firstname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Doe" {...field} data-testid="input-tenant-lastname" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email</FormLabel>
                  <FormControl>
                    <Input 
                      type="email" 
                      placeholder="john@example.com" 
                      {...field} 
                      data-testid="input-tenant-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="phone"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number</FormLabel>
                  <FormControl>
                    <Input 
                      type="tel" 
                      placeholder="+254 700 000 000" 
                      {...field} 
                      data-testid="input-tenant-phone"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emergencyContact"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emergency Contact (Optional)</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="+254 700 000 001" 
                      {...field} 
                      data-testid="input-tenant-emergency"
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
                data-testid="button-cancel-tenant"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={mutation.isPending}
                data-testid="button-save-tenant"
              >
                {mutation.isPending ? "Saving..." : isEdit ? "Update Tenant" : "Create Tenant"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
