import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface MaintenanceRequest {
  id: string;
  title: string;
  description: string;
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "completed" | "cancelled";
  createdAt: string;
  updatedAt: string;
  completedDate?: string;
  unit: {
    unitNumber: string;
  };
  property: {
    name: string;
  };
}

interface MaintenanceRequestListProps {
  limit?: number;
  showViewAll?: boolean;
}

export default function MaintenanceRequestList({
  limit = 5,
  showViewAll = true,
}: MaintenanceRequestListProps) {
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [showAllRequests, setShowAllRequests] = useState(false);

  const { data: requests = [], isLoading, isError, error } = useQuery<MaintenanceRequest[]>({
    queryKey: ["/api/maintenance-requests"],
    retry: false,
  });

  const displayedRequests = showAllRequests ? requests : requests.slice(0, limit);

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "bg-red-100 text-red-700 border-red-300";
      case "high":
        return "bg-orange-100 text-orange-700 border-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-700 border-yellow-300";
      case "low":
        return "bg-blue-100 text-blue-700 border-blue-300";
      default:
        return "bg-gray-100 text-gray-700 border-gray-300";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-700";
      case "in_progress":
        return "bg-blue-100 text-blue-700";
      case "cancelled":
        return "bg-gray-100 text-gray-700";
      default:
        return "bg-yellow-100 text-yellow-700";
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case "urgent":
        return "fa-exclamation-triangle";
      case "high":
        return "fa-arrow-up";
      case "medium":
        return "fa-minus";
      case "low":
        return "fa-arrow-down";
      default:
        return "fa-minus";
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="fas fa-exclamation-triangle text-2xl text-red-600"></i>
        </div>
        <p className="text-muted-foreground text-lg font-medium">Failed to load maintenance requests</p>
        <p className="text-sm text-muted-foreground mt-2">
          Please try again later
        </p>
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <i className="fas fa-tools text-2xl text-muted-foreground"></i>
        </div>
        <p className="text-muted-foreground text-lg font-medium">No maintenance requests</p>
        <p className="text-sm text-muted-foreground mt-2">
          Submit a request when you need something fixed
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {displayedRequests.map((request) => (
          <Card
            key={request.id}
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => setSelectedRequest(request)}
          >
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center ${getPriorityColor(
                      request.priority
                    )}`}
                  >
                    <i className={`fas ${getPriorityIcon(request.priority)} text-sm`}></i>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm truncate">{request.title}</h4>
                      <Badge
                        variant="outline"
                        className={`${getPriorityColor(request.priority)} text-xs`}
                      >
                        {request.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                      {request.description}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <i className="far fa-calendar"></i>
                        {new Date(request.createdAt).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1">
                        <i className="far fa-building"></i>
                        {request.unit?.unitNumber ?? "—"}
                      </span>
                    </div>
                  </div>
                </div>
                <Badge className={getStatusColor(request.status)}>
                  {request.status.replace("_", " ")}
                </Badge>
              </div>
            </CardContent>
          </Card>
        ))}

        {showViewAll && requests.length > limit && (
          <Button
            variant="outline"
            className="w-full"
            onClick={() => setShowAllRequests(!showAllRequests)}
          >
            {showAllRequests ? (
              <>
                <i className="fas fa-chevron-up mr-2"></i>
                Show Less
              </>
            ) : (
              <>
                <i className="fas fa-chevron-down mr-2"></i>
                View All ({requests.length - limit} more)
              </>
            )}
          </Button>
        )}
      </div>

      {/* Request Details Modal */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent className="sm:max-w-[600px]">
          {selectedRequest && (
            <>
              <DialogHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <DialogTitle className="text-xl mb-2">
                      {selectedRequest.title}
                    </DialogTitle>
                    <DialogDescription>
                      Submitted on {new Date(selectedRequest.createdAt).toLocaleDateString()}
                    </DialogDescription>
                  </div>
                  <Badge className={getStatusColor(selectedRequest.status)}>
                    {selectedRequest.status.replace("_", " ")}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="space-y-4 mt-4">
                {/* Priority and Property Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Priority</Label>
                    <Badge
                      variant="outline"
                      className={`${getPriorityColor(selectedRequest.priority)} mt-1`}
                    >
                      <i className={`fas ${getPriorityIcon(selectedRequest.priority)} mr-2`}></i>
                      {selectedRequest.priority.toUpperCase()}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Location</Label>
                    <p className="text-sm font-medium mt-1">
                      {selectedRequest.property?.name ?? "N/A"} - Unit {selectedRequest.unit?.unitNumber ?? "N/A"}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div>
                  <Label className="text-sm text-muted-foreground">Description</Label>
                  <p className="text-sm mt-2 p-4 bg-muted rounded-lg whitespace-pre-wrap">
                    {selectedRequest.description}
                  </p>
                </div>

                {/* Timeline */}
                <div>
                  <Label className="text-sm text-muted-foreground mb-3 block">Timeline</Label>
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                      <div>
                        <p className="text-sm font-medium">Request Submitted</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(selectedRequest.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {(selectedRequest.status === "in_progress" || selectedRequest.status === "completed") && (
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2"></div>
                        <div>
                          <p className="text-sm font-medium">In Progress</p>
                          <p className="text-xs text-muted-foreground">
                            {/* Use updatedAt as fallback until backend provides inProgressAt field */}
                            {selectedRequest.status === "in_progress" 
                              ? new Date(selectedRequest.updatedAt).toLocaleString()
                              : "Status changed"}
                          </p>
                        </div>
                      </div>
                    )}
                    {selectedRequest.status === "completed" && selectedRequest.completedDate && (
                      <div className="flex items-start gap-3">
                        <div className="w-2 h-2 bg-green-500 rounded-full mt-2"></div>
                        <div>
                          <p className="text-sm font-medium">Completed</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(selectedRequest.completedDate).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <Button variant="outline" onClick={() => setSelectedRequest(null)}>
                  Close
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

// Label component for consistency
function Label({ className, children }: { className?: string; children: React.ReactNode }) {
  return <label className={className}>{children}</label>;
}
