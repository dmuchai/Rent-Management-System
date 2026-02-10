import { useState } from 'react';
import { Upload, FileText, CheckCircle2, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';

interface UploadResult {
  total: number;
  matched: number;
  unmatched: number;
  duplicates: number;
  errors: number;
  details: Array<{
    transaction: string;
    status: 'matched' | 'unmatched' | 'duplicate' | 'error';
    date: string;
    amount: number;
    invoiceId?: string;
    confidence?: number;
    method?: string;
    reasons?: string[];
    error?: string;
  }>;
}

interface StatementUploadProps {
  onUploadComplete?: () => void;
}

export function StatementUpload({ onUploadComplete }: StatementUploadProps) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      // Validate file type
      const validTypes = ['.csv', '.txt', '.xls', '.xlsx'];
      const fileExt = selectedFile.name.toLowerCase().slice(selectedFile.name.lastIndexOf('.'));
      
      if (!validTypes.includes(fileExt)) {
        toast({
          title: 'Invalid File Type',
          description: 'Please upload a CSV, TXT, or Excel file',
          variant: 'destructive'
        });
        return;
      }

      // Validate file size (max 5MB)
      if (selectedFile.size > 5 * 1024 * 1024) {
        toast({
          title: 'File Too Large',
          description: 'Maximum file size is 5MB',
          variant: 'destructive'
        });
        return;
      }

      setFile(selectedFile);
      setResult(null);
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setUploading(true);
    setError(null);

    try {
      // Read file as base64
      const fileContent = await readFileAsBase64(file);

      const response = await fetch('/api/reconciliation/upload-statement', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          file: {
            name: file.name,
            content: fileContent
          }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload statement');
      }

      setResult(data.results);
      
      toast({
        title: 'Statement Processed',
        description: data.summary,
      });

      onUploadComplete?.();

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to upload statement';
      setError(errorMsg);
      toast({
        title: 'Upload Failed',
        description: errorMsg,
        variant: 'destructive'
      });
    } finally {
      setUploading(false);
    }
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const getMatchRate = () => {
    if (!result) return 0;
    return result.total > 0 ? Math.round((result.matched / result.total) * 100) : 0;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Bank Statement
          </CardTitle>
          <CardDescription>
            Upload M-Pesa or bank statements (CSV format) to automatically match payments to invoices
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Supported Banks Info */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Supported: M-Pesa, Equity Bank, KCB, Co-op Bank, NCBA, and generic CSV formats
            </AlertDescription>
          </Alert>

          {/* File Upload */}
          <div className="space-y-2">
            <div className="flex items-center gap-4">
              <label className="flex-1">
                <input
                  type="file"
                  accept=".csv,.txt,.xls,.xlsx"
                  onChange={handleFileChange}
                  disabled={uploading}
                  className="block w-full text-sm text-slate-500
                    file:mr-4 file:py-2 file:px-4
                    file:rounded-md file:border-0
                    file:text-sm file:font-semibold
                    file:bg-primary file:text-primary-foreground
                    hover:file:bg-primary/90
                    file:cursor-pointer cursor-pointer
                    disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </label>
              
              <Button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="w-32"
              >
                {uploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Upload
                  </>
                )}
              </Button>
            </div>

            {file && !uploading && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <FileText className="h-4 w-4" />
                {file.name} ({(file.size / 1024).toFixed(1)} KB)
              </div>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Results Display */}
          {result && (
            <div className="space-y-4 pt-4 border-t">
              <h3 className="font-semibold">Upload Results</h3>

              {/* Summary Stats */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold">{result.total}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-2xl font-bold text-green-600">{result.matched}</div>
                  <div className="text-xs text-muted-foreground">Matched</div>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-lg">
                  <div className="text-2xl font-bold text-amber-600">{result.unmatched}</div>
                  <div className="text-xs text-muted-foreground">Unmatched</div>
                </div>
                <div className="text-center p-3 bg-slate-50 rounded-lg">
                  <div className="text-2xl font-bold text-slate-600">{result.duplicates}</div>
                  <div className="text-xs text-muted-foreground">Duplicates</div>
                </div>
              </div>

              {/* Match Rate Progress */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Match Rate</span>
                  <span className="font-semibold">{getMatchRate()}%</span>
                </div>
                <Progress value={getMatchRate()} className="h-2" />
              </div>

              {/* Transaction Details */}
              {result.details.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold">Transaction Details</h4>
                  <div className="max-h-64 overflow-y-auto space-y-2">
                    {result.details.map((detail, index) => (
                      <div
                        key={index}
                        className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg text-sm"
                      >
                        <div className="mt-0.5">
                          {detail.status === 'matched' && (
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                          )}
                          {detail.status === 'unmatched' && (
                            <XCircle className="h-4 w-4 text-amber-600" />
                          )}
                          {detail.status === 'duplicate' && (
                            <AlertCircle className="h-4 w-4 text-slate-600" />
                          )}
                          {detail.status === 'error' && (
                            <XCircle className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between">
                            <span className="font-mono text-xs">{detail.transaction}</span>
                            <span className="font-semibold">KES {detail.amount.toLocaleString()}</span>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {new Date(detail.date).toLocaleDateString()}
                            {detail.status === 'matched' && detail.method && (
                              <span className="ml-2">• {detail.method} ({detail.confidence}%)</span>
                            )}
                            {detail.status === 'unmatched' && detail.reasons && (
                              <span className="ml-2">• {detail.reasons.join(', ')}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">How to Get Your Statement</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <h4 className="font-semibold mb-1">M-Pesa Statement:</h4>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Open M-Pesa app or dial *234#</li>
              <li>Select "My Account" → "M-Pesa Statement"</li>
              <li>Choose date range and delivery method (email)</li>
              <li>Download CSV file from email</li>
            </ol>
          </div>
          
          <div>
            <h4 className="font-semibold mb-1">Bank Statement:</h4>
            <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
              <li>Login to your online banking</li>
              <li>Navigate to Statements section</li>
              <li>Select account and date range</li>
              <li>Download as CSV format</li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
