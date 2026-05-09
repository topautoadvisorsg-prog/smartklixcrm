import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download, Users, Briefcase, DollarSign, ClipboardCheck, Calendar } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ExportStats {
  contacts: number;
  jobs: number;
  financialRecords: number;
  fieldReports: number;
}

export default function ExportCenter() {
  const { toast } = useToast();
  const [stats, setStats] = useState<ExportStats>({
    contacts: 0,
    jobs: 0,
    financialRecords: 0,
    fieldReports: 0,
  });
  const [downloading, setDownloading] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<{ fromDate: string; toDate: string }>({
    fromDate: "",
    toDate: "",
  });

  // Fetch counts on mount
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [contactsRes, jobsRes, financialRes, fieldRes] = await Promise.all([
          fetch("/api/contacts"),
          fetch("/api/jobs"),
          fetch("/api/financial-records"),
          fetch("/api/field-reports"),
        ]);

        const [contacts, jobs, financialRecords, fieldReports] = await Promise.all([
          contactsRes.json(),
          jobsRes.json(),
          financialRes.json(),
          fieldRes.json(),
        ]);

        setStats({
          contacts: contacts.length,
          jobs: jobs.length,
          financialRecords: financialRecords.length,
          fieldReports: fieldReports.length,
        });
      } catch (error) {
        console.error("Error fetching stats:", error);
      }
    };

    fetchStats();
  }, []);

  const handleExport = async (endpoint: string, filename: string) => {
    setDownloading(endpoint);
    
    try {
      // Build query params
      const params = new URLSearchParams();
      if (dateRange.fromDate) params.append("fromDate", dateRange.fromDate);
      if (dateRange.toDate) params.append("toDate", dateRange.toDate);

      const queryString = params.toString();
      const url = `/api${endpoint}${queryString ? "?" + queryString : ""}`;
      
      // STEP 1: Fetch with error handling
      const res = await fetch(url);
      
      // STEP 2: Check for errors
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Export failed" }));
        
        // Handle specific error cases
        if (res.status === 400 && err.maxRows) {
          toast({
            title: "Export Too Large",
            description: err.message || `Maximum ${err.maxRows} rows allowed. Please narrow your date range.`,
            variant: "destructive"
          });
        } else if (err.message) {
          toast({
            title: "Export Failed",
            description: err.message,
            variant: "destructive"
          });
        } else if (err.error) {
          toast({
            title: "Export Failed",
            description: err.error,
            variant: "destructive"
          });
        } else {
          toast({
            title: "Export Failed",
            description: "Please try again.",
            variant: "destructive"
          });
        }
        setDownloading(null);
        return;
      }
      
      // STEP 3: Download blob
      const blob = await res.blob();
      
      // STEP 4: Create download link
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);
      
      // STEP 5: Show success
      toast({
        title: "Export Successful",
        description: "Your file has been downloaded.",
      });
    } catch (error) {
      console.error("Export error:", error);
      toast({
        title: "Network Error",
        description: "Please check your connection and try again.",
        variant: "destructive"
      });
    } finally {
      setDownloading(null);
    }
  };

  const exportCards = [
    {
      id: "contacts",
      title: "Contacts Export",
      description: "Export all contact information including name, email, phone, company, tags, and status",
      icon: Users,
      count: stats.contacts,
      endpoint: "/export/contacts",
      filename: "contacts_export.csv",
      color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    },
    {
      id: "jobs",
      title: "Jobs Export",
      description: "Export job records with client information, status, values, and scheduling data",
      icon: Briefcase,
      count: stats.jobs,
      endpoint: "/export/jobs",
      filename: "jobs_export.csv",
      color: "bg-purple-500/10 text-purple-600 border-purple-500/20",
    },
    {
      id: "financials",
      title: "Financial Records Export",
      description: "Export internal income/expense tracking data with categories and dates",
      icon: DollarSign,
      count: stats.financialRecords,
      endpoint: "/export/financials",
      filename: "financial_export.csv",
      color: "bg-green-500/10 text-green-600 border-green-500/20",
    },
    {
      id: "field-reports",
      title: "Field Reports Export",
      description: "Export field worker documentation including photos, notes, and progress updates",
      icon: ClipboardCheck,
      count: stats.fieldReports,
      endpoint: "/export/field-reports",
      filename: "field_reports_export.csv",
      color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    },
  ];

  return (
    <div className="space-y-6" data-testid="page-export-center">
      {/* Header */}
      <div className="bg-glass-surface border border-glass-border rounded-xl p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Download className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">
                EXPORT CENTER
              </h1>
              <p className="text-sm text-muted-foreground">
                Download your data in CSV format with optional date filtering
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Date Range Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5" />
            Date Range Filter (Optional)
          </CardTitle>
          <CardDescription>
            Apply date filters to limit exported data. Leave empty to export records from the last 90 days.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">From Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-border rounded-md bg-background"
                value={dateRange.fromDate}
                onChange={(e) => setDateRange({ ...dateRange, fromDate: e.target.value })}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">To Date</label>
              <input
                type="date"
                className="w-full px-3 py-2 border border-border rounded-md bg-background"
                value={dateRange.toDate}
                onChange={(e) => setDateRange({ ...dateRange, toDate: e.target.value })}
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => setDateRange({ fromDate: "", toDate: "" })}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {exportCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center border ${card.color}`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{card.title}</CardTitle>
                      <CardDescription className="mt-1">{card.description}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="muted" className="text-sm">
                    {card.count} records
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <Button
                  className="w-full gap-2"
                  onClick={() => handleExport(card.endpoint, card.filename)}
                  disabled={downloading === card.endpoint}
                >
                  {downloading === card.endpoint ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Downloading...
                    </>
                  ) : (
                    <>
                      <Download className="w-4 h-4" />
                      Download CSV
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Info */}
      <Card className="bg-muted/30">
        <CardContent className="pt-6">
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="font-medium">Export Notes:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>All exports are in flat CSV format for easy import into Excel, Google Sheets, or other tools</li>
              <li>Date filters apply to the created_at timestamp of each record</li>
              <li>Contacts export includes: name, email, phone, company, type, status, source, tags</li>
              <li>Jobs export includes: job ID, title, client name, status, value, dates</li>
              <li>Financial export includes: contact name, type (income/expense), category, amount, date</li>
              <li>Field reports export includes: job ID, contact name, type, notes, photos, status updates</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
