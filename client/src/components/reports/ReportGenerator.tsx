import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface ReportData {
  payments: Array<{
    paidDate: string | null;
    createdAt: string;
    description: string | null;
    amount: string;
    status: string;
    paymentMethod: string | null;
  }>;
  stats: {
    totalExpected: number;
    totalCollected: number;
    totalOverdue: number;
    collectionRate: number;
  };
}

interface ExportEntry {
  id: string;
  fileName: string;
  rangeLabel: string;
  reportType: string;
  createdAt: string;
}

export default function ReportGenerator() {
  const [reportType, setReportType] = useState("monthly");
  const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split('T')[0]);
  const [exportHistory, setExportHistory] = useState<ExportEntry[]>([]);

  const setPresetRange = (preset: "month" | "last-month" | "ytd") => {
    const now = new Date();
    if (preset === "month") {
      setStartDate(new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0]);
      setEndDate(new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0]);
      return;
    }

    if (preset === "last-month") {
      setStartDate(new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split("T")[0]);
      setEndDate(new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split("T")[0]);
      return;
    }

    setStartDate(new Date(now.getFullYear(), 0, 1).toISOString().split("T")[0]);
    setEndDate(now.toISOString().split("T")[0]);
  };

  const { data: reportData, isLoading } = useQuery<ReportData>({
    queryKey: ["/api/reports/payments", { startDate, endDate }],
    retry: false,
  });

  const handleExportReport = () => {
    if (!reportData) return;

    const fileName = `rent-report-${startDate}-to-${endDate}.csv`;

    // Create CSV content
    const headers = ["Date", "Description", "Amount", "Status", "Method"];
    const csvContent = [
      headers.join(","),
      ...reportData.payments.map((payment: any) => [
        new Date(payment.paidDate || payment.createdAt).toLocaleDateString(),
        payment.description?.replace(/,/g, ";") || "Payment",
        parseFloat(payment.amount),
        payment.status,
        payment.paymentMethod || "N/A"
      ].join(","))
    ].join("\n");

    // Download CSV
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    window.URL.revokeObjectURL(url);

    setExportHistory((prev) => [
      {
        id: `${Date.now()}`,
        fileName,
        rangeLabel: `${startDate} to ${endDate}`,
        reportType,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ].slice(0, 10));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-semibold">Reports</h2>
          <p className="text-sm text-muted-foreground">Generate summaries and export financial data.</p>
        </div>
        <Button
          onClick={handleExportReport}
          disabled={!reportData || isLoading}
          data-testid="button-export-report"
        >
          <i className="fas fa-download mr-2"></i>Export Report
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Total Expected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">KES {reportData?.stats.totalExpected?.toLocaleString() || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Collected</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-chart-2">KES {reportData?.stats.totalCollected?.toLocaleString() || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Outstanding</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-destructive">KES {reportData?.stats.totalOverdue?.toLocaleString() || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Collection Rate</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold text-chart-2">{reportData?.stats.collectionRate?.toFixed(1) || 0}%</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setPresetRange("month")}>
              This month
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPresetRange("last-month")}>
              Last month
            </Button>
            <Button size="sm" variant="outline" onClick={() => setPresetRange("ytd")}>
              Year to date
            </Button>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <div>
              <Label htmlFor="reportType">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger data-testid="select-report-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly Collection</SelectItem>
                  <SelectItem value="annual">Annual Summary</SelectItem>
                  <SelectItem value="property">Property Performance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="startDate">From Date</Label>
              <Input
                id="startDate"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                data-testid="input-start-date"
              />
            </div>
            <div>
              <Label htmlFor="endDate">To Date</Label>
              <Input
                id="endDate"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                data-testid="input-end-date"
              />
            </div>
            <div className="flex items-end">
              <Button className="w-full" data-testid="button-generate-report">
                Generate
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Report Summary */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Income Summary */}
        <Card>
          <CardHeader>
            <CardTitle>Income Summary - {new Date(startDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="h-4 bg-muted rounded w-24"></div>
                    <div className="h-4 bg-muted rounded w-16"></div>
                  </div>
                ))}
              </div>
            ) : reportData ? (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Expected</span>
                  <span className="font-semibold" data-testid="text-total-expected">
                    KES {reportData.stats.totalExpected?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Total Collected</span>
                  <span className="font-semibold text-chart-2" data-testid="text-total-collected">
                    KES {reportData.stats.totalCollected?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Outstanding</span>
                  <span className="font-semibold text-destructive" data-testid="text-outstanding">
                    KES {reportData.stats.totalOverdue?.toLocaleString() || 0}
                  </span>
                </div>
                <div className="border-t border-border pt-4">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Collection Rate</span>
                    <span className="font-semibold text-chart-2" data-testid="text-collection-rate">
                      {reportData.stats.collectionRate?.toFixed(1) || 0}%
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground" data-testid="text-no-report-data">
                No data available for the selected period
              </p>
            )}
          </CardContent>
        </Card>

        {/* Property Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Payment History</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="animate-pulse space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex justify-between items-center">
                    <div className="h-4 bg-muted rounded w-32"></div>
                    <div className="h-4 bg-muted rounded w-16"></div>
                  </div>
                ))}
              </div>
            ) : reportData && reportData.payments.length > 0 ? (
              <div className="space-y-4">
                {reportData.payments.slice(0, 5).map((payment: any) => (
                  <div key={payment.id} className="flex justify-between items-center" data-testid={`report-payment-${payment.id}`}>
                    <div>
                      <p className="font-medium">{payment.description || 'Payment'}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(payment.paidDate || payment.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">KES {parseFloat(payment.amount).toLocaleString()}</p>
                      <p className={`text-sm ${
                        payment.status === 'completed' ? 'text-chart-2' : 
                        payment.status === 'pending' ? 'text-chart-4' : 'text-destructive'
                      }`}>
                        {payment.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground text-center py-8" data-testid="text-no-payments-report">
                No payments in the selected period
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Export History</CardTitle>
            {exportHistory.length > 0 && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setExportHistory([])}
              >
                Clear
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {exportHistory.length === 0 ? (
            <p className="text-muted-foreground">No exports yet.</p>
          ) : (
            <div className="space-y-3">
              {exportHistory.map((entry) => (
                <div key={entry.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="text-sm font-medium">{entry.fileName}</p>
                    <p className="text-xs text-muted-foreground">
                      {entry.reportType} • {entry.rangeLabel}
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
