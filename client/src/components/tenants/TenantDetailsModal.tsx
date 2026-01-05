import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, User, Home, Calendar, DollarSign, Mail, Phone, AlertCircle, CheckCircle2, MailCheck, Clock } from "lucide-react";
import type { Tenant, Lease, Payment, Property } from "@/../../shared/schema";

interface TenantDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tenant: Tenant | null;
}

export default function TenantDetailsModal({ open, onOpenChange, tenant }: TenantDetailsModalProps) {
  // Fetch tenant's leases
  const { data: leases = [], isLoading: leasesLoading } = useQuery<Lease[]>({
    queryKey: ["/api/leases", tenant?.id],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/leases");
      const allLeases = await response.json();
      return allLeases.filter((lease: Lease) => lease.tenantId === tenant?.id);
    },
    enabled: open && !!tenant,
  });

  // Fetch tenant's payments (via leases)
  const { data: payments = [], isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments", tenant?.id, leases],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/payments");
      const allPayments = await response.json();
      const tenantLeaseIds = leases.map(l => l.id);
      return allPayments.filter((payment: Payment) => tenantLeaseIds.includes(payment.leaseId));
    },
    enabled: open && !!tenant && leases.length > 0,
  });

  // Fetch all properties and units to show property/unit names
  const { data: properties = [] } = useQuery<Property[]>({
    queryKey: ["/api/properties"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/properties");
      return await response.json();
    },
    enabled: open && !!tenant,
  });

  // Calculate payment statistics
  const totalPaid = payments
    .filter(p => p.status === 'completed')
    .reduce((sum, p) => {
      const amount = parseFloat(p.amount as any);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

  const totalPending = payments
    .filter(p => p.status === 'pending')
    .reduce((sum, p) => {
      const amount = parseFloat(p.amount as any);
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);

  // Get current active lease
  const activeLease = leases.find(l => l.isActive);

  // Get status badge
  const getStatusBadge = () => {
    if (!tenant) return null;
    const status = tenant.accountStatus || 'pending_invitation';
    
    switch (status) {
      case 'active':
        return (
          <Badge variant="default" className="bg-green-100 text-green-800 hover:bg-green-100">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Active
          </Badge>
        );
      case 'invited':
        return (
          <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-100">
            <MailCheck className="h-3 w-3 mr-1" />
            Invited
          </Badge>
        );
      case 'pending_invitation':
        return (
          <Badge variant="outline" className="text-muted-foreground">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getPropertyName = (lease: Lease) => {
    // Get property via unit relationship
    const property = properties.find((p: Property) => {
      // Check if any unit in this property matches the lease's unitId
      return (p as any).units?.some((u: any) => u.id === lease.unitId);
    });
    return property?.name || 'Unknown Property';
  };

  const getUnitNumber = (lease: Lease) => {
    return (lease as any).unit?.unitNumber || (lease as any).unitId || '—';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {!tenant ? null : (
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div>
              <DialogTitle className="text-2xl">
                {tenant.firstName} {tenant.lastName}
              </DialogTitle>
              <p className="text-sm text-muted-foreground mt-1">{tenant.email}</p>
            </div>
            {getStatusBadge()}
          </div>
        </DialogHeader>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="leases">Lease History</TabsTrigger>
            <TabsTrigger value="payments">Payment History</TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-4">
            {/* Quick Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">KES {totalPaid.toLocaleString()}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">KES {totalPending.toLocaleString()}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Leases</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{leases.length}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{payments.length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start gap-3">
                  <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">{tenant.email}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Phone</p>
                    <p className="text-sm text-muted-foreground">{tenant.phone || '—'}</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">Emergency Contact</p>
                    <p className="text-sm text-muted-foreground">{tenant.emergencyContact || '—'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Current Lease */}
            {activeLease && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5" />
                    Current Lease
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm font-medium">Property</p>
                      <p className="text-sm text-muted-foreground">{getPropertyName(activeLease)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Unit</p>
                      <p className="text-sm text-muted-foreground">{getUnitNumber(activeLease)}</p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Lease Period</p>
                      <p className="text-sm text-muted-foreground">
                        {formatDate(activeLease.startDate)} - {formatDate(activeLease.endDate)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm font-medium">Monthly Rent</p>
                      <p className="text-sm text-muted-foreground">
                        KES {(() => {
                          const rent = parseFloat(activeLease.monthlyRent as any);
                          return (isNaN(rent) ? 0 : rent).toLocaleString();
                        })()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Account Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm font-medium">Account Status</p>
                    <div className="mt-1">{getStatusBadge()}</div>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Joined Date</p>
                    <p className="text-sm text-muted-foreground">{formatDate(tenant.createdAt)}</p>
                  </div>
                  {tenant.invitationSentAt && (
                    <div>
                      <p className="text-sm font-medium">Invitation Sent</p>
                      <p className="text-sm text-muted-foreground">{formatDate(tenant.invitationSentAt)}</p>
                    </div>
                  )}
                  {tenant.invitationAcceptedAt && (
                    <div>
                      <p className="text-sm font-medium">Invitation Accepted</p>
                      <p className="text-sm text-muted-foreground">{formatDate(tenant.invitationAcceptedAt)}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Lease History Tab */}
          <TabsContent value="leases" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Lease History ({leases.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {leasesLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : leases.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No lease records found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Property</TableHead>
                        <TableHead>Unit</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>End Date</TableHead>
                        <TableHead>Monthly Rent</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {leases.map((lease) => (
                        <TableRow key={lease.id}>
                          <TableCell>{getPropertyName(lease)}</TableCell>
                          <TableCell>{getUnitNumber(lease)}</TableCell>
                          <TableCell>{formatDate(lease.startDate)}</TableCell>
                          <TableCell>{formatDate(lease.endDate)}</TableCell>
                          <TableCell className="font-medium">
                            KES {(() => {
                              const rent = parseFloat(lease.monthlyRent as any);
                              return (isNaN(rent) ? 0 : rent).toLocaleString();
                            })()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={lease.isActive ? 'default' : 'secondary'}>
                              {lease.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payment History Tab */}
          <TabsContent value="payments" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Payment History ({payments.length})</CardTitle>
              </CardHeader>
              <CardContent>
                {paymentsLoading ? (
                  <div className="flex justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : payments.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">No payment records found</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Amount</TableHead>
                        <TableHead>Method</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((payment) => {
                        const safeAmount = (() => {
                          const parsed = parseFloat(payment.amount as any);
                          return isNaN(parsed) ? 0 : parsed;
                        })();
                        
                        return (
                          <TableRow key={payment.id}>
                            <TableCell>
                              {formatDate((payment as any).paidDate || payment.createdAt)}
                            </TableCell>
                            <TableCell className="font-medium">
                              KES {safeAmount.toLocaleString()}
                            </TableCell>
                            <TableCell>{(payment as any).paymentMethod || '—'}</TableCell>
                            <TableCell>
                              <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                                {payment.status}
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

            {/* Payment Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold text-green-600">KES {totalPaid.toLocaleString()}</p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Pending Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold text-orange-600">KES {totalPending.toLocaleString()}</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">Completed Payments</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-xl font-bold">{payments.filter(p => p.status === 'completed').length}</p>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
      )}
    </Dialog>
  );
}
