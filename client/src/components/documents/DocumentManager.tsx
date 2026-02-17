import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { isUnauthorizedError } from "@/lib/authUtils";
import { Button } from "@/components/ui/button";
import { ObjectUploader } from "@/components/ObjectUploader";
import type { UploadResult } from "@uppy/core";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<any | null>(null);

  const { data: documents = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/documents", { category: activeCategory }],
    retry: false,
  });

  const filteredDocuments = documents.filter((document: any) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const name = document?.name?.toLowerCase() || "";
    const type = document?.fileType?.toLowerCase() || "";
    return name.includes(query) || type.includes(query);
  });

  const totalDocuments = filteredDocuments.length;
  const recentDocuments = [...filteredDocuments]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  const formatFileSize = (fileSize?: number | null) => {
    if (fileSize == null) return "Unknown size";
    if (fileSize < 1024) return `${fileSize} B`;
    if (fileSize < 1024 * 1024) return `${(fileSize / 1024).toFixed(1)} KB`;
    return `${(fileSize / 1024 / 1024).toFixed(1)} MB`;
  };

  const getFileIcon = (fileType?: string | null) => {
    const normalizedType = (fileType || "").toLowerCase();
    if (normalizedType.includes("pdf")) return "fa-file-pdf";
    if (normalizedType.includes("image") || normalizedType.includes("png") || normalizedType.includes("jpg") || normalizedType.includes("jpeg") || normalizedType.includes("gif")) {
      return "fa-file-image";
    }
    if (normalizedType.includes("word") || normalizedType.includes("doc")) return "fa-file-word";
    if (normalizedType.includes("excel") || normalizedType.includes("sheet") || normalizedType.includes("csv") || normalizedType.includes("xls")) {
      return "fa-file-excel";
    }
    if (normalizedType.includes("powerpoint") || normalizedType.includes("presentation") || normalizedType.includes("ppt")) {
      return "fa-file-powerpoint";
    }
    if (normalizedType.includes("text") || normalizedType.includes("txt")) return "fa-file-lines";
    return "fa-file";
  };

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
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Documents</h2>
          <p className="text-sm text-muted-foreground">Store leases, statements, and maintenance records.</p>
        </div>
        <ObjectUploader
          maxNumberOfFiles={1}
          maxFileSize={10485760}
          onGetUploadParameters={handleGetUploadParameters}
          onComplete={handleUploadComplete}
          buttonClassName="bg-primary text-primary-foreground px-4 py-2 rounded-lg hover:bg-primary/90"
        >
          <i className="fas fa-upload mr-2"></i>Upload Document
        </ObjectUploader>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr,3fr]">
        <Card>
          <CardHeader>
            <CardTitle>Categories</CardTitle>
            <CardDescription>Select a document category.</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Search</CardTitle>
              <CardDescription>Find documents by name or type.</CardDescription>
            </CardHeader>
            <CardContent>
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search documents..."
                className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
              />
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Total Documents</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{totalDocuments}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Category</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm font-medium">
                  {categories.find((c) => c.id === activeCategory)?.name}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Recent Uploads</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-semibold">{recentDocuments.length}</p>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-[2fr,1fr]">
            <Card>
              <CardHeader>
                <CardTitle>{categories.find((c) => c.id === activeCategory)?.name}</CardTitle>
                <CardDescription>Manage and download your documents.</CardDescription>
              </CardHeader>
              <CardContent>
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
                ) : filteredDocuments.length === 0 && searchQuery.trim() ? (
                  <div className="text-center py-12">
                    <i className="fas fa-file-alt text-4xl text-muted-foreground mb-4"></i>
                    <p className="text-muted-foreground text-lg" data-testid="text-no-documents">
                      No documents match your search
                    </p>
                    <p className="text-muted-foreground">Try a different keyword or clear the search.</p>
                  </div>
                ) : filteredDocuments.length === 0 ? (
                  <div className="text-center py-12">
                    <i className="fas fa-file-alt text-4xl text-muted-foreground mb-4"></i>
                    <p className="text-muted-foreground text-lg" data-testid="text-no-documents">
                      No documents in this category
                    </p>
                    <p className="text-muted-foreground">Upload a document to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {filteredDocuments.map((document: any) => (
                      <button
                        key={document.id}
                        type="button"
                        onClick={() => setSelectedDocument(document)}
                        className={`w-full text-left flex flex-col gap-3 rounded-lg border border-border p-4 sm:flex-row sm:items-center sm:justify-between transition-colors ${
                          selectedDocument?.id === document.id ? "bg-muted/40" : "hover:bg-muted/20"
                        }`}
                        data-testid={`document-item-${document.id}`}
                      >
                        <div className="flex items-center space-x-4">
                          <div className="w-10 h-10 bg-destructive/10 rounded-lg flex items-center justify-center">
                            <i className={`fas ${getFileIcon(document.fileType)} text-destructive`}></i>
                          </div>
                          <div>
                            <p className="font-medium" data-testid={`document-name-${document.id}`}>
                              {document.name}
                            </p>
                            <p className="text-sm text-muted-foreground" data-testid={`document-meta-${document.id}`}>
                              Uploaded on {new Date(document.createdAt).toLocaleDateString()} • {formatFileSize(document.fileSize)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">{activeCategory}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Download ${document.name || document.id}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              handleDownload(document);
                            }}
                            data-testid={`button-download-${document.id}`}
                          >
                            <i className="fas fa-download"></i>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`View ${document.name || document.id}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedDocument(document);
                            }}
                            data-testid={`button-view-${document.id}`}
                          >
                            <i className="fas fa-eye"></i>
                          </Button>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Preview</CardTitle>
                <CardDescription>Document details and quick actions.</CardDescription>
              </CardHeader>
              <CardContent>
                {selectedDocument ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Name</p>
                      <p className="text-sm font-medium">{selectedDocument.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Uploaded</p>
                      <p className="text-sm font-medium">
                        {selectedDocument.createdAt ? new Date(selectedDocument.createdAt).toLocaleDateString() : "Unknown"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">File size</p>
                      <p className="text-sm font-medium">{formatFileSize(selectedDocument.fileSize)}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="sm" onClick={() => handleDownload(selectedDocument)}>
                        Open
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedDocument(null)}
                      >
                        Clear
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-sm text-muted-foreground">Select a document to preview.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
