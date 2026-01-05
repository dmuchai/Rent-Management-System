import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { FileText, Download, User, Home, Calendar, DollarSign } from "lucide-react";
import type { Lease, Tenant, Unit, Property } from "@/../../shared/schema";

type LeaseWithRelations = Lease & {
  tenant?: Tenant | null;
  unit?: Unit & { property?: Property | null } | null;
};

interface LeaseDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lease: LeaseWithRelations | null;
}

export default function LeaseDetailsModal({ open, onOpenChange, lease }: LeaseDetailsModalProps) {
  const [activeTab, setActiveTab] = useState("overview");

  // Fetch payments for this lease
  const { data: payments = [], isLoading: paymentsLoading } = useQuery({
    queryKey: ["/api/payments", lease?.id],
    queryFn: async () => {
      if (!lease?.id) return [];
      const response = await apiRequest("GET", `/api/payments?leaseId=${lease.id}`);
      const result = await response.json();
      return result.data || result || [];
    },
    enabled: !!lease?.id && open,
  });

  if (!lease) return null;

  const formatDate = (date: Date | string | null) => {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };

  const getLeaseStatus = () => {
    const now = new Date();
    const startDate = new Date(lease.startDate);
    const endDate = new Date(lease.endDate);

    if (!lease.isActive) {
      return { label: "Inactive", color: "bg-gray-100 text-gray-700", variant: "secondary" as const };
    }
    if (now < startDate) {
      return { label: "Upcoming", color: "bg-blue-100 text-blue-700", variant: "outline" as const };
    }
    if (now > endDate) {
      return { label: "Expired", color: "bg-red-100 text-red-700", variant: "destructive" as const };
    }
    return { label: "Active", color: "bg-green-100 text-green-700", variant: "default" as const };
  };

  const status = getLeaseStatus();
  const leaseDuration = Math.ceil((new Date(lease.endDate).getTime() - new Date(lease.startDate).getTime()) / (1000 * 60 * 60 * 24));
  const daysRemaining = Math.ceil((new Date(lease.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
  
  const totalPaid = payments
    .filter((p: any) => p.status === 'completed')
    .reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0);
  
  const totalPending = payments
    .filter((p: any) => p.status === 'pending')
    .reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <FileText className="h-6 w-6" />
            Lease Agreement Details
          </DialogTitle>
          <DialogDescription>
            View complete information about this lease agreement
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Status Banner */}
          <div className={`p-4 rounded-lg ${status.color}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-lg">Status: {status.label}</p>
                {lease.isActive && daysRemaining > 0 && (
                  <p className="text-sm mt-1">
                    {daysRemaining} days remaining until lease expires
                  </p>
                )}
                {lease.isActive && daysRemaining < 0 && (
                  <p className="text-sm mt-1">
                    Expired {Math.abs(daysRemaining)} days ago
                  </p>
                )}
              </div>
              <Badge variant={status.variant} className="text-lg px-4 py-2">
                {status.label}
              </Badge>
            </div>
          </div>

          {/* Quick Info Grid */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Rent</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">KES {parseFloat(lease.monthlyRent).toLocaleString()}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Security Deposit</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">KES {parseFloat(lease.securityDeposit || '0').toLocaleString()}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Paid</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-green-600">KES {totalPaid.toLocaleString()}</p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold text-orange-600">KES {totalPending.toLocaleString()}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="payments">Payments ({payments.length})</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4 mt-4">
              {/* Tenant Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <User className="h-5 w-5" />
                    Tenant Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Name</p>
                    <p className="font-medium">
                      {lease.tenant?.firstName} {lease.tenant?.lastName}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{lease.tenant?.email || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{lease.tenant?.phone || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Emergency Contact</p>
                    <p className="font-medium">{lease.tenant?.emergencyContact || '—'}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Property & Unit Information */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5" />
                    Property & Unit Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Property</p>
                    <p className="font-medium">{lease.unit?.property?.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Unit Number</p>
                    <p className="font-medium">Unit {lease.unit?.unitNumber || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bedrooms</p>
                    <p className="font-medium">{lease.unit?.bedrooms || '—'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Bathrooms</p>
                    <p className="font-medium">{lease.unit?.bathrooms || '—'}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Lease Terms */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5" />
                    Lease Terms
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid md:grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Start Date</p>
                    <p className="font-medium">{formatDate(lease.startDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">End Date</p>
                    <p className="font-medium">{formatDate(lease.endDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Lease Duration</p>
                    <p className="font-medium">{leaseDuration} days ({Math.round(leaseDuration / 30)} months)</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created On</p>
                    <p className="font-medium">{formatDate(lease.createdAt)}</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="payments" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Payment History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {paymentsLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : payments.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground">No payments recorded for this lease</p>
                    </div>
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
                        {payments.map((payment: any) => (
                          <TableRow key={payment.id}>
                            <TableCell>
                              {formatDate(payment.paidDate || payment.createdAt)}
                            </TableCell>
                            <TableCell className="font-medium">
                              KES {parseFloat(payment.amount).toLocaleString()}
                            </TableCell>
                            <TableCell>{payment.paymentMethod || '—'}</TableCell>
                            <TableCell>
                              <Badge variant={payment.status === 'completed' ? 'default' : 'secondary'}>
                                {payment.status}
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

            <TabsContent value="documents" className="mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Lease Documents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {lease.leaseDocumentUrl ? (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 border rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FileText className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">Lease Agreement</p>
                            <p className="text-sm text-muted-foreground">PDF Document</p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm" asChild>
                          <a href={lease.leaseDocumentUrl} target="_blank" rel="noopener noreferrer">
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </a>
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <FileText className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                      <p className="text-muted-foreground mb-4">No documents uploaded for this lease</p>
                      <p className="text-sm text-gray-500">
                        Upload lease agreement documents for easy access and record keeping
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}
