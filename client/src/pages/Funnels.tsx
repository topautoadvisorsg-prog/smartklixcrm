import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { 
  Search, 
  Plus, 
  FolderPlus, 
  MoreVertical, 
  ExternalLink, 
  Eye, 
  Settings2, 
  Trash2, 
  Grid3X3, 
  List, 
  Layers 
} from "lucide-react";

interface Funnel {
  id: string;
  name: string;
  folder: string | null;
  lastUpdated: string;
  steps: number;
  status: "active" | "draft" | "paused";
}

const mockFunnels: Funnel[] = [
  { id: "1", name: "Lead Qualification", folder: "Sales", lastUpdated: "Dec 15, 2025", steps: 4, status: "active" },
  { id: "2", name: "Service Booking", folder: "Sales", lastUpdated: "Dec 14, 2025", steps: 3, status: "active" },
  { id: "3", name: "Follow-Up Sequence", folder: null, lastUpdated: "Dec 10, 2025", steps: 5, status: "draft" },
  { id: "4", name: "Customer Onboarding", folder: "Onboarding", lastUpdated: "Dec 5, 2025", steps: 6, status: "active" },
  { id: "5", name: "Upsell Campaign", folder: null, lastUpdated: "Nov 28, 2025", steps: 3, status: "paused" },
];

export default function Funnels() {
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const filteredFunnels = mockFunnels.filter((funnel) =>
    funnel.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const statusColors: Record<string, "default" | "secondary" | "outline"> = {
    active: "default",
    draft: "secondary",
    paused: "outline",
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">Funnels</h1>
          <p className="text-muted-foreground">Build funnels to generate leads, appointments, and receive payments</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" data-testid="button-create-folder">
            <FolderPlus className="w-4 h-4 mr-2" />
            Create Folder
          </Button>
          <Button data-testid="button-new-funnel">
            <Plus className="w-4 h-4 mr-2" />
            New Funnel
          </Button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search for funnels..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            data-testid="input-search-funnels"
          />
        </div>
        <div className="flex gap-1 border rounded-md p-1">
          <Button
            variant={viewMode === "list" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("list")}
            data-testid="button-view-list"
          >
            <List className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "grid" ? "secondary" : "ghost"}
            size="icon"
            onClick={() => setViewMode("grid")}
            data-testid="button-view-grid"
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {viewMode === "list" ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead>Steps</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFunnels.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                    No funnels found. Create one to get started.
                  </TableCell>
                </TableRow>
              ) : (
                filteredFunnels.map((funnel) => (
                  <TableRow key={funnel.id} data-testid={`funnel-row-${funnel.id}`}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium">{funnel.name}</p>
                          {funnel.folder && (
                            <p className="text-xs text-muted-foreground">{funnel.folder}</p>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{funnel.lastUpdated}</TableCell>
                    <TableCell>
                      <span className="text-secondary">{funnel.steps} Steps</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusColors[funnel.status]} className="capitalize">
                        {funnel.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" data-testid={`funnel-menu-${funnel.id}`}>
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>
                            <Eye className="w-4 h-4 mr-2" />
                            Preview
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Settings2 className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            Open in HighLevel
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredFunnels.map((funnel) => (
            <Card key={funnel.id} data-testid={`funnel-card-${funnel.id}`}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-muted-foreground" />
                    <div>
                      <CardTitle className="text-base">{funnel.name}</CardTitle>
                      {funnel.folder && (
                        <CardDescription>{funnel.folder}</CardDescription>
                      )}
                    </div>
                  </div>
                  <Badge variant={statusColors[funnel.status]} className="capitalize">
                    {funnel.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Last updated</span>
                  <span>{funnel.lastUpdated}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Steps</span>
                  <span className="text-secondary">{funnel.steps}</span>
                </div>
                <div className="flex gap-2 pt-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Eye className="w-4 h-4 mr-1" />
                    Preview
                  </Button>
                  <Button size="sm" className="flex-1">
                    <Settings2 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
