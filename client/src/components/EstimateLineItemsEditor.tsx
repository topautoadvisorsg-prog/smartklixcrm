import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2, Search, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import type { PricebookItem } from "@shared/schema";

export interface EstimateLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  pricebookItemId?: string;
  tier?: string;
  taxable?: boolean;
}

interface EstimateLineItemsEditorProps {
  items: EstimateLineItem[];
  onChange: (items: EstimateLineItem[]) => void;
  taxRate?: number;
}

export default function EstimateLineItemsEditor({
  items,
  onChange,
  taxRate = 0.0825,
}: EstimateLineItemsEditorProps) {
  const [pricebookOpen, setPricebookOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const { data: pricebookItems = [] } = useQuery<PricebookItem[]>({
    queryKey: ["/api/pricebook"],
  });

  const activePricebookItems = pricebookItems.filter(item => item.active !== false);

  const filteredPricebook = activePricebookItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.sku && item.sku.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const addFromPricebook = (pricebookItem: PricebookItem) => {
    const newItem: EstimateLineItem = {
      id: crypto.randomUUID(),
      description: pricebookItem.name,
      quantity: 1,
      unitPrice: parseFloat(pricebookItem.unitPrice),
      total: parseFloat(pricebookItem.unitPrice),
      pricebookItemId: pricebookItem.id,
      tier: pricebookItem.tier || undefined,
      taxable: pricebookItem.taxable,
    };
    onChange([...items, newItem]);
    setPricebookOpen(false);
    setSearchTerm("");
  };

  const addCustomItem = () => {
    const newItem: EstimateLineItem = {
      id: crypto.randomUUID(),
      description: "",
      quantity: 1,
      unitPrice: 0,
      total: 0,
      taxable: true,
    };
    onChange([...items, newItem]);
  };

  const updateItem = (id: string, field: keyof EstimateLineItem, value: string | number) => {
    const updatedItems = items.map(item => {
      if (item.id !== id) return item;
      
      const updated = { ...item, [field]: value };
      
      if (field === "quantity" || field === "unitPrice") {
        updated.total = Number(updated.quantity) * Number(updated.unitPrice);
      }
      
      return updated;
    });
    onChange(updatedItems);
  };

  const removeItem = (id: string) => {
    onChange(items.filter(item => item.id !== id));
  };

  const subtotal = items.reduce((sum, item) => sum + item.total, 0);
  const taxableAmount = items
    .filter(item => item.taxable !== false)
    .reduce((sum, item) => sum + item.total, 0);
  const taxAmount = taxableAmount * taxRate;
  const total = subtotal + taxAmount;

  const getTierBadgeColor = (tier?: string) => {
    switch (tier) {
      case "good": return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "better": return "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200";
      case "best": return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200";
      default: return "";
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Line Items</Label>
        <div className="flex gap-2">
          <Popover open={pricebookOpen} onOpenChange={setPricebookOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-add-from-pricebook">
                <BookOpen className="w-4 h-4 mr-2" />
                From Pricebook
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-0" align="end">
              <Command>
                <CommandInput
                  placeholder="Search pricebook..."
                  value={searchTerm}
                  onValueChange={setSearchTerm}
                  data-testid="input-search-pricebook"
                />
                <CommandList>
                  <CommandEmpty>No items found</CommandEmpty>
                  <CommandGroup>
                    {filteredPricebook.slice(0, 10).map((item) => (
                      <CommandItem
                        key={item.id}
                        value={item.name}
                        onSelect={() => addFromPricebook(item)}
                        data-testid={`pricebook-item-${item.id}`}
                      >
                        <div className="flex flex-col flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{item.name}</span>
                            {item.tier && (
                              <Badge variant="secondary" className={`text-xs ${getTierBadgeColor(item.tier)}`}>
                                {item.tier}
                              </Badge>
                            )}
                          </div>
                          <span className="text-sm text-muted-foreground">
                            ${parseFloat(item.unitPrice).toFixed(2)} / {item.unit}
                            {item.sku && ` • ${item.sku}`}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <Button variant="outline" size="sm" onClick={addCustomItem} data-testid="button-add-custom-item">
            <Plus className="w-4 h-4 mr-2" />
            Custom Item
          </Button>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed rounded-lg">
          <p className="text-muted-foreground">No line items yet</p>
          <p className="text-sm text-muted-foreground">Add items from pricebook or create custom items</p>
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Description</TableHead>
              <TableHead className="w-[15%] text-right">Qty</TableHead>
              <TableHead className="w-[15%] text-right">Unit Price</TableHead>
              <TableHead className="w-[15%] text-right">Total</TableHead>
              <TableHead className="w-[15%]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id} data-testid={`line-item-${item.id}`}>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Input
                      value={item.description}
                      onChange={(e) => updateItem(item.id, "description", e.target.value)}
                      placeholder="Item description"
                      className="h-8"
                      data-testid={`input-description-${item.id}`}
                    />
                    {item.tier && (
                      <Badge variant="secondary" className={`text-xs shrink-0 ${getTierBadgeColor(item.tier)}`}>
                        {item.tier}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={item.quantity}
                    onChange={(e) => updateItem(item.id, "quantity", parseFloat(e.target.value) || 0)}
                    className="h-8 text-right"
                    data-testid={`input-quantity-${item.id}`}
                  />
                </TableCell>
                <TableCell>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={item.unitPrice}
                    onChange={(e) => updateItem(item.id, "unitPrice", parseFloat(e.target.value) || 0)}
                    className="h-8 text-right"
                    data-testid={`input-unit-price-${item.id}`}
                  />
                </TableCell>
                <TableCell className="text-right font-medium">
                  ${item.total.toFixed(2)}
                </TableCell>
                <TableCell className="text-right">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={() => removeItem(item.id)}
                    data-testid={`button-remove-${item.id}`}
                  >
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {items.length > 0 && (
        <div className="flex justify-end">
          <div className="w-64 space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span>${subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Tax ({(taxRate * 100).toFixed(2)}%)</span>
              <span>${taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between font-semibold text-lg border-t pt-1">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
