import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface LeaseTableProps {
  leases: any[];
  loading: boolean;
  onEditLease?: (lease: any) => void;
}

export default function LeaseTable({ leases, loading, onEditLease }: LeaseTableProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lease Agreements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-32">
            <div className="text-muted-foreground">Loading leases...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (leases.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Lease Agreements</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <i className="fas fa-file-contract text-4xl text-gray-400 mb-4"></i>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No lease agreements yet</h3>
            <p className="text-gray-500 mb-4">
              Create your first lease agreement to start managing tenant relationships.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getLeaseStatus = (lease: any) => {
    const now = new Date();
    const startDate = new Date(lease.startDate);
    const endDate = new Date(lease.endDate);

    if (!lease.isActive) {
      return { label: "Inactive", variant: "secondary" as const };
    }
    if (now < startDate) {
      return { label: "Upcoming", variant: "outline" as const };
    }
    if (now > endDate) {
      return { label: "Expired", variant: "destructive" as const };
    }
    return { label: "Active", variant: "default" as const };
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Lease Agreements ({leases.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead>Lease Term</TableHead>
              <TableHead>Monthly Rent</TableHead>
              <TableHead>Security Deposit</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leases.map((lease: any) => {
              const status = getLeaseStatus(lease);
              return (
                <TableRow key={lease.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        {lease.tenant?.firstName} {lease.tenant?.lastName}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {lease.tenant?.email}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      <div className="font-medium">
                        Unit {lease.unit?.unitNumber}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {lease.unit?.property?.name}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      <div>{formatDate(lease.startDate)} to</div>
                      <div>{formatDate(lease.endDate)}</div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">
                      KES {parseFloat(lease.monthlyRent).toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div>
                      KES {parseFloat(lease.securityDeposit || "0").toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={status.variant}>{status.label}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      {onEditLease && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => onEditLease(lease)}
                        >
                          <i className="fas fa-edit mr-1"></i>
                          Edit
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}