import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Plus, Edit, Trash2, Search, BookOpen, Filter, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { PricebookItem } from "@shared/schema";

const categories = [
  { value: "service", label: "Service" },
  { value: "part", label: "Part" },
  { value: "labor", label: "Labor" },
  { value: "material", label: "Material" },
];

const tiers = [
  { value: "good", label: "Good" },
  { value: "better", label: "Better" },
  { value: "best", label: "Best" },
];

const units = [
  { value: "each", label: "Each" },
  { value: "hour", label: "Hour" },
  { value: "sqft", label: "Sq Ft" },
  { value: "linear_ft", label: "Linear Ft" },
  { value: "flat", label: "Flat Rate" },
];

export default function Pricebook() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | undefined>();
  const [selectedTier, setSelectedTier] = useState<string | undefined>();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<PricebookItem | null>(null);
  const [formData, setFormData] = useState({
    sku: "",
    name: "",
    description: "",
    category: "service",
    unitPrice: "",
    unitCost: "",
    unit: "each",
    tier: "",
    taxable: true,
    active: true,
  });

  const { data: items = [], isLoading, isError } = useQuery<PricebookItem[]>({
    queryKey: ["/api/pricebook", selectedCategory, selectedTier],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedCategory) params.set("category", selectedCategory);
      if (selectedTier) params.set("tier", selectedTier);
      const res = await fetch(`/api/pricebook?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Pricebook unavailable");
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
    retry: false,
  });

  const createMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      return apiRequest("POST", "/api/pricebook", {
        ...data,
        unitPrice: data.unitPrice || "0",
        unitCost: data.unitCost || "0",
        tier: data.tier || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricebook"] });
      toast({ title: "Item created successfully" });
      handleCloseDialog();
    },
    onError: (error) => {
      toast({ title: "Failed to create item", description: String(error), variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: typeof formData }) => {
      return apiRequest("PATCH", `/api/pricebook/${id}`, {
        ...data,
        unitPrice: data.unitPrice || "0",
        unitCost: data.unitCost || "0",
        tier: data.tier || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricebook"] });
      toast({ title: "Item updated successfully" });
      handleCloseDialog();
    },
    onError: (error) => {
      toast({ title: "Failed to update item", description: String(error), variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/pricebook/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/pricebook"] });
      toast({ title: "Item deleted" });
    },
  });

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingItem(null);
    setFormData({
      sku: "",
      name: "",
      description: "",
      category: "service",
      unitPrice: "",
      unitCost: "",
      unit: "each",
      tier: "",
      taxable: true,
      active: true,
    });
  };

  const handleEdit = (item: PricebookItem) => {
    setEditingItem(item);
    setFormData({
      sku: item.sku || "",
      name: item.name,
      description: item.description || "",
      category: item.category,
      unitPrice: item.unitPrice,
      unitCost: item.unitCost,
      unit: item.unit,
      tier: item.tier || "",
      taxable: item.taxable,
      active: item.active !== false,
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    if (!formData.name) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const safeItems = Array.isArray(items) ? items : [];
  const filteredItems = safeItems.filter((item) =>
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.description && item.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getCategoryBadgeColor = (category: string) => {
    switch (category) {
      case "service": return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "part": return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "labor": return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "material": return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      default: return "";
    }
  };

  const getTierBadgeColor = (tier: string | null) => {
    switch (tier) {
      case "good": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "better": return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200";
      case "best": return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200";
      default: return "";
    }
  };

  if (isError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold flex items-center gap-2">
              <BookOpen className="w-6 h-6" />
              Pricebook
            </h1>
            <p className="text-muted-foreground">Manage your service, parts, and labor pricing</p>
          </div>
        </div>
        <Card className="bg-glass-surface border-glass-border">
          <CardContent className="p-8 text-center">
            <DollarSign className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">Pricing Module Not Configured Yet</h2>
            <p className="text-muted-foreground text-sm max-w-md mx-auto">
              The pricing database is being set up. This feature will be available once the pricing infrastructure is configured.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <BookOpen className="w-6 h-6" />
            Pricebook
          </h1>
          <p className="text-muted-foreground">Manage your service, parts, and labor pricing</p>
        </div>
        <Button onClick={() => setDialogOpen(true)} data-testid="button-add-pricebook-item">
          <Plus className="w-4 h-4 mr-2" />
          Add Item
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_200px] gap-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, SKU, or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            data-testid="input-search-pricebook"
          />
        </div>
        <Select value={selectedCategory || "all"} onValueChange={(v) => setSelectedCategory(v === "all" ? undefined : v)}>
          <SelectTrigger data-testid="select-category-filter">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={selectedTier || "all"} onValueChange={(v) => setSelectedTier(v === "all" ? undefined : v)}>
          <SelectTrigger data-testid="select-tier-filter">
            <SelectValue placeholder="All Tiers" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Tiers</SelectItem>
            {tiers.map((tier) => (
              <SelectItem key={tier.value} value={tier.value}>{tier.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Pricebook Items ({filteredItems.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No pricebook items found</p>
              <p className="text-sm">Add your first item to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>SKU</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Tier</TableHead>
                  <TableHead className="text-right">Unit Price</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead className="text-center">Taxable</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredItems.map((item) => (
                  <TableRow key={item.id} data-testid={`pricebook-row-${item.id}`}>
                    <TableCell className="font-mono text-sm">{item.sku || "-"}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">{item.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={getCategoryBadgeColor(item.category)}>
                        {item.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {item.tier ? (
                        <Badge variant="secondary" className={getTierBadgeColor(item.tier)}>
                          {item.tier}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      ${Number(item.unitPrice).toFixed(2)}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      ${Number(item.unitCost).toFixed(2)}
                    </TableCell>
                    <TableCell className="capitalize">{item.unit}</TableCell>
                    <TableCell className="text-center">
                      {item.taxable ? "Yes" : "No"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleEdit(item)}
                          data-testid={`button-edit-${item.id}`}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(item.id)}
                          data-testid={`button-delete-${item.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) handleCloseDialog(); else setDialogOpen(true); }}>
        <DialogContent className="max-w-lg" data-testid="dialog-pricebook-item">
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Pricebook Item" : "Add Pricebook Item"}</DialogTitle>
            <DialogDescription>
              {editingItem ? "Update the item details" : "Create a new item for your pricebook"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="sku">SKU</Label>
                <Input
                  id="sku"
                  value={formData.sku}
                  onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                  placeholder="Optional"
                  data-testid="input-sku"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Item name"
                  data-testid="input-name"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Item description..."
                rows={2}
                data-testid="input-description"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                  <SelectTrigger data-testid="select-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((cat) => (
                      <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tier">Tier (GBB)</Label>
                <Select value={formData.tier || "none"} onValueChange={(v) => setFormData({ ...formData, tier: v === "none" ? "" : v })}>
                  <SelectTrigger data-testid="select-tier">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {tiers.map((tier) => (
                      <SelectItem key={tier.value} value={tier.value}>{tier.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="unitPrice">Unit Price ($)</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unitPrice}
                  onChange={(e) => setFormData({ ...formData, unitPrice: e.target.value })}
                  placeholder="0.00"
                  data-testid="input-unit-price"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unitCost">Unit Cost ($)</Label>
                <Input
                  id="unitCost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.unitCost}
                  onChange={(e) => setFormData({ ...formData, unitCost: e.target.value })}
                  placeholder="0.00"
                  data-testid="input-unit-cost"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Unit</Label>
                <Select value={formData.unit} onValueChange={(v) => setFormData({ ...formData, unit: v })}>
                  <SelectTrigger data-testid="select-unit">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((unit) => (
                      <SelectItem key={unit.value} value={unit.value}>{unit.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  id="taxable"
                  checked={formData.taxable}
                  onCheckedChange={(checked) => setFormData({ ...formData, taxable: checked })}
                  data-testid="switch-taxable"
                />
                <Label htmlFor="taxable">Taxable</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  id="active"
                  checked={formData.active}
                  onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
                  data-testid="switch-active"
                />
                <Label htmlFor="active">Active</Label>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog} data-testid="button-cancel">
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={createMutation.isPending || updateMutation.isPending}
              data-testid="button-save"
            >
              {editingItem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
