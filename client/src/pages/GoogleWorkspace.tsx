import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { FileText, Table, Folder, Search, ExternalLink, AlertCircle, Briefcase } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ArtifactType = "doc" | "sheet" | "drive";

interface WorkspaceArtifact {
  id: string;
  googleFileId: string;
  name: string;
  type: ArtifactType;
  url: string;
  jobId: string | null;
  contactId: string | null;
  lastModifiedBy: string | null;
  lastModifiedTime: string | null;
  status: "active" | "orphaned";
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

const FILTER_OPTIONS = [
  { value: "all", label: "All Files", icon: null },
  { value: "doc", label: "Google Docs", icon: FileText },
  { value: "sheet", label: "Google Sheets", icon: Table },
  { value: "drive", label: "Google Drive", icon: Folder },
] as const;

function getIcon(type: ArtifactType) {
  switch (type) {
    case "doc":
      return (
        <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center border border-blue-500/30">
          <FileText className="w-5 h-5 text-blue-500" />
        </div>
      );
    case "sheet":
      return (
        <div className="w-10 h-10 bg-emerald-500/20 rounded-lg flex items-center justify-center border border-emerald-500/30">
          <Table className="w-5 h-5 text-emerald-500" />
        </div>
      );
    case "drive":
      return (
        <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center border border-border">
          <Folder className="w-5 h-5 text-muted-foreground" />
        </div>
      );
  }
}

function formatTimeAgo(dateString: string | null): string {
  if (!dateString) return "Unknown";
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return diffDays === 1 ? "Yesterday" : `${diffDays} days ago`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default function GoogleWorkspace() {
  const [activeFilter, setActiveFilter] = useState<"all" | ArtifactType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: artifacts = [], isLoading } = useQuery<WorkspaceArtifact[]>({
    queryKey: ["/api/workspace/files", activeFilter !== "all" ? activeFilter : undefined],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activeFilter !== "all") {
        params.set("type", activeFilter);
      }
      const res = await fetch(`/api/workspace/files?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch workspace files");
      return res.json();
    },
  });

  const filteredArtifacts = artifacts.filter((art) => {
    const matchesSearch = art.name.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  return (
    <div className="flex flex-col h-full bg-background text-foreground overflow-hidden p-6 lg:p-8">
      {/* 1. CONTEXT HEADER */}
      <div className="bg-card border border-border rounded-xl p-5 mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-sm relative overflow-hidden shrink-0">
        <div className="absolute top-0 left-0 w-1 h-full bg-primary"></div>
        <div className="relative z-10 pl-4">
          <div className="flex items-center gap-3 mb-1">
            <Briefcase className="w-5 h-5 text-primary" />
            <h1 className="text-lg font-bold text-foreground tracking-tight">
              Cloud File Mirror
            </h1>
          </div>
          <p className="text-xs text-muted-foreground font-medium">
            Google Workspace Artifact Visibility Hub - Read-Only View
          </p>
        </div>
        <div className="flex items-center gap-2 bg-muted/50 border border-border px-3 py-1.5 rounded-lg">
          <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
          <span className="text-[10px] font-mono text-muted-foreground">
            Sync: Google Drive API
          </span>
        </div>
      </div>

      {/* 2. CONTROLS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 shrink-0">
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((filter) => {
            const Icon = filter.icon;
            return (
              <Button
                key={filter.value}
                variant={activeFilter === filter.value ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setActiveFilter(filter.value as typeof activeFilter)}
                className={cn(
                  "text-xs font-semibold gap-2",
                  activeFilter === filter.value
                    ? "bg-secondary text-secondary-foreground border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {Icon && (
                  <Icon
                    className={cn(
                      "w-3.5 h-3.5",
                      filter.value === "doc" && "text-blue-500",
                      filter.value === "sheet" && "text-emerald-500",
                      filter.value === "drive" && "text-muted-foreground"
                    )}
                  />
                )}
                {filter.label}
              </Button>
            );
          })}
        </div>
        <div className="relative w-full sm:w-64">
          <Input
            type="text"
            placeholder="Search linked artifacts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 text-xs"
          />
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        </div>
      </div>

      {/* 3. ARTIFACT GRID */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <div className="animate-spin w-8 h-8 border-2 border-primary border-t-transparent rounded-full" />
          </div>
        ) : filteredArtifacts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredArtifacts.map((art) => (
              <div
                key={art.id}
                className={cn(
                  "group relative bg-card border rounded-xl p-5 transition-all hover:bg-accent/50",
                  art.status === "orphaned"
                    ? "border-amber-500/30"
                    : "border-border hover:border-border/80"
                )}
              >
                <div className="flex items-start gap-4">
                  {getIcon(art.type)}
                  <div className="flex-1 min-w-0">
                    <h3
                      className={cn(
                        "text-sm font-bold truncate leading-tight",
                        art.status === "orphaned"
                          ? "text-muted-foreground"
                          : "text-foreground group-hover:text-foreground"
                      )}
                    >
                      {art.name}
                    </h3>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {art.lastModifiedBy
                        ? `Last modified by ${art.lastModifiedBy}`
                        : "Last modified"}{" "}
                      | {formatTimeAgo(art.lastModifiedTime)}
                    </p>

                    {art.status === "orphaned" && (
                      <div className="mt-3 inline-flex items-center px-2 py-1 bg-muted border border-border rounded text-[9px] text-muted-foreground font-medium">
                        <AlertCircle className="w-3 h-3 mr-1.5 text-destructive" />
                        Status: Orphaned (File not found)
                      </div>
                    )}
                  </div>
                </div>

                {/* Link Action */}
                <a
                  href={art.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "absolute bottom-4 right-4 p-2 rounded-lg transition-colors",
                    art.status === "orphaned"
                      ? "text-muted-foreground/30 cursor-not-allowed pointer-events-none"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  )}
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            ))}
          </div>
        ) : (
          /* Empty State */
          <div className="h-full flex flex-col items-center justify-center opacity-60">
            <div className="w-20 h-20 bg-muted border border-border rounded-2xl flex items-center justify-center mb-4">
              <Folder className="w-8 h-8 text-muted-foreground" />
            </div>
            <p className="text-sm font-bold text-muted-foreground">
              No linked files found for this filter.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Files are linked automatically from Jobs or via Neo-8 workflows.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
