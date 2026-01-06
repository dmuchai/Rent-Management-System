import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { insertTenantSchema, type InsertTenant } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface TenantResponse {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  emergencyContact: string | null;
  userId: string;
  invitationSentAt: string | null;
  invitationAcceptedAt: string | null;
  accountStatus: 'pending_invitation' | 'invited' | 'active';
  createdAt: string;
  updatedAt: string;
}
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
  mode?: 'view' | 'edit' | 'create';
}

export default function TenantForm({ open, onOpenChange, tenant, mode = 'create' }: TenantFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isEdit = mode === 'edit';
  const isView = mode === 'view';

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

  const mutation = useMutation<TenantResponse, Error, InsertTenant>({
    mutationFn: async (data: InsertTenant) => {
      const url = isEdit ? `/api/tenants/${tenant.id}` : "/api/tenants";
      const method = isEdit ? "PUT" : "POST";
      const response = await apiRequest(method, url, data);
      return await response.json() as TenantResponse;
    },
    onSuccess: (data: TenantResponse) => {
      queryClient.invalidateQueries({ queryKey: ["/api/tenants"] });
      
      if (isEdit) {
        toast({
          title: "Success",
          description: "Tenant updated successfully",
        });
      } else {
        // Check if invitation was actually sent (backend sets invitation_sent_at only after successful email)
        const invitationSent = data.invitationSentAt !== null;
        
        if (invitationSent && data.email) {
          toast({
            title: "Tenant Created! 📧",
            description: `Invitation email sent to ${data.email}`,
            duration: 5000,
          });
        } else if (data.email) {
          toast({
            title: "Tenant Created ⚠️",
            description: `Tenant created but invitation email failed. You can resend it from the tenant list.`,
            variant: "destructive",
            duration: 7000,
          });
        } else {
          toast({
            title: "Success",
            description: "Tenant created successfully",
          });
        }
      }
      
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
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="tenant-form-title">
            {isView ? "Tenant Details" : isEdit ? "Edit Tenant" : "Add New Tenant"}
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
                      <Input placeholder="John" {...field} data-testid="input-tenant-firstname" readOnly={isView} disabled={isView} className={isView ? "bg-muted" : ""} />
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
                      <Input placeholder="Doe" {...field} data-testid="input-tenant-lastname" readOnly={isView} disabled={isView} className={isView ? "bg-muted" : ""} />
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
                      readOnly={isView}
                      disabled={isView}
                      className={isView ? "bg-muted" : ""}
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
                      readOnly={isView}
                      disabled={isView}
                      className={isView ? "bg-muted" : ""}
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
                      value={field.value || ""}
                      data-testid="input-tenant-emergency"
                      readOnly={isView}
                      disabled={isView}
                      className={isView ? "bg-muted" : ""}
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
                {isView ? "Close" : "Cancel"}
              </Button>
              {!isView && (
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  data-testid="button-save-tenant"
                >
                  {mutation.isPending ? "Saving..." : isEdit ? "Update Tenant" : "Create Tenant"}
                </Button>
              )}
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
