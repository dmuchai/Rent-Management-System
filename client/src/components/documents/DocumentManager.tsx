import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";

const categories = [
  { id: "lease", name: "Lease Agreements" },
  { id: "property", name: "Property Documents" },
  { id: "maintenance", name: "Maintenance Records" },
  { id: "financial", name: "Financial Records" },
];

export default function DocumentManager() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeCategory, setActiveCategory] = useState("lease");

  const { data: documents = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/documents", { category: activeCategory }],
    retry: false,
  });

  const uploadMutation = useMutation({
    mutationFn: async (documentData: any) => {
      return await apiRequest("POST", "/api/documents", documentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/documents"] });
      toast({
        title: "Success",
        description: "Document uploaded successfully",
      });
    },
    onError: (error) => {
      if (isUnauthorizedError(error)) {
        toast({
          title: "Unauthorized",
          description: "You are logged out. Logging in again...",
          variant: "destructive",
        });
        setTimeout(() => {
          window.location.href = `${import.meta.env.VITE_API_BASE_URL || ''}/api/login`;
        }, 500);
        return;
      }
      toast({
        title: "Error",
        description: "Failed to upload document",
        variant: "destructive",
      });
    },
  });

  const handleGetUploadParameters = async () => {
    try {
      const response = await apiRequest("POST", "/api/objects/upload", {});
      const data = await response.json();
      return {
        method: "PUT" as const,
        url: data.uploadURL,
      };
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to get upload URL",
        variant: "destructive",
      });
      throw error;
    }
  };

  const handleUploadComplete = (result: UploadResult<Record<string, unknown>, Record<string, unknown>>) => {
    if (result.successful && result.successful.length > 0) {
      const file = result.successful[0];
      const uploadURL = (file as any).uploadURL;
      
      uploadMutation.mutate({
        name: file.name,
        fileUrl: uploadURL,
        fileSize: file.size,
        fileType: file.type,
        category: activeCategory,
      });
    }
  };

  const handleDownload = (document: any) => {
    // Open document in new tab
    window.open(document.fileUrl, "_blank");
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Document Management</h2>
        <ObjectUploader
          maxNumberOfFiles={1}
          maxFileSize={10485760} // 10MB
          onGetUploadParameters={handleGetUploadParameters}
          onComplete={handleUploadComplete}
          buttonClassName="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90"
        >
          <i className="fas fa-upload mr-2"></i>Upload Document
        </ObjectUploader>
      </div>

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Document Categories */}
        <div className="lg:col-span-1">
          <div className="bg-card rounded-xl border border-border p-6">
            <h3 className="font-semibold mb-4">Categories</h3>
            <div className="space-y-2">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => setActiveCategory(category.id)}
                  className={`w-full text-left p-2 rounded-lg transition-colors ${
                    activeCategory === category.id
                      ? "bg-primary text-primary-foreground"
                      : "hover:bg-accent"
                  }`}
                  data-testid={`category-${category.id}`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Documents List */}
        <div className="lg:col-span-3">
          <div className="bg-card rounded-xl border border-border">
            <div className="p-6 border-b border-border">
              <h3 className="text-lg font-semibold">
                {categories.find(c => c.id === activeCategory)?.name}
              </h3>
            </div>
            <div className="p-6">
              {isLoading ? (
                <div className="animate-pulse space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center justify-between p-4 border border-border rounded-lg">
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-muted rounded-lg"></div>
                        <div className="space-y-2">
                          <div className="h-4 bg-muted rounded w-48"></div>
                          <div className="h-3 bg-muted rounded w-32"></div>
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        <div className="w-8 h-8 bg-muted rounded"></div>
                        <div className="w-8 h-8 bg-muted rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : documents.length === 0 ? (
                <div className="text-center py-12">
                  <i className="fas fa-file-alt text-4xl text-muted-foreground mb-4"></i>
                  <p className="text-muted-foreground text-lg" data-testid="text-no-documents">
                    No documents in this category
                  </p>
                  <p className="text-muted-foreground">Upload your first document to get started</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {documents.map((document: any) => (
                    <div 
                      key={document.id} 
                      className="flex items-center justify-between p-4 border border-border rounded-lg"
                      data-testid={`document-item-${document.id}`}
                    >
                      <div className="flex items-center space-x-4">
                        <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
                          <i className="fas fa-file-pdf text-destructive"></i>
                        </div>
                        <div>
                          <p className="font-medium" data-testid={`document-name-${document.id}`}>
                            {document.name}
                          </p>
                          <p className="text-sm text-muted-foreground" data-testid={`document-meta-${document.id}`}>
                            Uploaded on {new Date(document.createdAt).toLocaleDateString()} • {
                              document.fileSize ? `${(document.fileSize / 1024 / 1024).toFixed(1)} MB` : 'Unknown size'
                            }
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(document)}
                          data-testid={`button-download-${document.id}`}
                        >
                          <i className="fas fa-download"></i>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(document)}
                          data-testid={`button-view-${document.id}`}
                        >
                          <i className="fas fa-eye"></i>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
