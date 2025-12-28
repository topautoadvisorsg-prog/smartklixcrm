import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Star, Crown, Sparkles } from "lucide-react";
import type { Estimate } from "@shared/schema";

interface EstimateLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  pricebookItemId?: number;
  tier?: "good" | "better" | "best";
  taxable?: boolean;
}

interface TierSummary {
  tier: "good" | "better" | "best";
  items: EstimateLineItem[];
  subtotal: number;
  taxAmount: number;
  total: number;
}

interface EstimatePresentationViewProps {
  estimate: Estimate;
  taxRate?: number;
  onSelect?: (tier: "good" | "better" | "best") => void;
}

const tierConfig = {
  good: {
    label: "Good",
    icon: Check,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950",
    borderColor: "border-blue-200 dark:border-blue-800",
    badgeVariant: "secondary" as const,
    description: "Essential coverage for your needs",
  },
  better: {
    label: "Better",
    icon: Star,
    color: "text-amber-600 dark:text-amber-400",
    bgColor: "bg-amber-50 dark:bg-amber-950",
    borderColor: "border-amber-200 dark:border-amber-800",
    badgeVariant: "default" as const,
    description: "Enhanced features with added value",
    recommended: true,
  },
  best: {
    label: "Best",
    icon: Crown,
    color: "text-emerald-600 dark:text-emerald-400",
    bgColor: "bg-emerald-50 dark:bg-emerald-950",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    badgeVariant: "default" as const,
    description: "Premium solution with full benefits",
  },
};

export default function EstimatePresentationView({
  estimate,
  taxRate = 0.0825,
  onSelect,
}: EstimatePresentationViewProps) {
  const [selectedTier, setSelectedTier] = useState<"good" | "better" | "best" | null>(null);

  const parseLineItems = (): EstimateLineItem[] => {
    if (!estimate.lineItems) return [];
    const items = estimate.lineItems as Array<{
      description?: string;
      quantity?: number;
      unitPrice?: number;
      total?: number;
      pricebookItemId?: number;
      tier?: "good" | "better" | "best";
      taxable?: boolean;
    }>;
    return items.map((item) => ({
      description: item.description || "",
      quantity: item.quantity || 1,
      unitPrice: item.unitPrice || 0,
      total: item.total || (item.quantity || 1) * (item.unitPrice || 0),
      pricebookItemId: item.pricebookItemId,
      tier: item.tier,
      taxable: item.taxable,
    }));
  };

  const lineItems = parseLineItems();

  const groupItemsByTier = (): Map<"good" | "better" | "best", TierSummary> => {
    const tiers: ("good" | "better" | "best")[] = ["good", "better", "best"];
    const tierMap = new Map<"good" | "better" | "best", TierSummary>();

    for (const tier of tiers) {
      const tierItems = lineItems.filter((item) => item.tier === tier);
      const subtotal = tierItems.reduce((sum, item) => sum + item.total, 0);
      const taxableAmount = tierItems
        .filter((item) => item.taxable !== false)
        .reduce((sum, item) => sum + item.total, 0);
      const taxAmount = taxableAmount * taxRate;
      const total = subtotal + taxAmount;

      tierMap.set(tier, {
        tier,
        items: tierItems,
        subtotal,
        taxAmount,
        total,
      });
    }

    return tierMap;
  };

  const tierSummaries = groupItemsByTier();
  const hasMultipleTiers = Array.from(tierSummaries.values()).filter(t => t.items.length > 0).length > 1;

  const handleSelect = (tier: "good" | "better" | "best") => {
    setSelectedTier(tier);
    onSelect?.(tier);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
    }).format(amount);
  };

  if (!hasMultipleTiers) {
    const allItems = lineItems;
    const subtotal = allItems.reduce((sum, item) => sum + item.total, 0);
    const taxableAmount = allItems
      .filter((item) => item.taxable !== false)
      .reduce((sum, item) => sum + item.total, 0);
    const taxAmount = taxableAmount * taxRate;
    const total = subtotal + taxAmount;

    return (
      <div className="space-y-4" data-testid="estimate-presentation-single">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5" />
              Your Estimate
            </CardTitle>
            <CardDescription>
              Estimate #{estimate.id.slice(0, 8)}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="divide-y">
              {allItems.map((item, index) => (
                <div
                  key={index}
                  className="py-2 flex justify-between items-start"
                  data-testid={`line-item-${index}`}
                >
                  <div className="flex-1">
                    <p className="font-medium">{item.description}</p>
                    <p className="text-sm text-muted-foreground">
                      {item.quantity} x {formatCurrency(item.unitPrice)}
                    </p>
                  </div>
                  <p className="font-medium">{formatCurrency(item.total)}</p>
                </div>
              ))}
            </div>

            <div className="border-t pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  Tax ({(taxRate * 100).toFixed(2)}%)
                </span>
                <span>{formatCurrency(taxAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold text-lg border-t pt-2">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="estimate-presentation-gbb">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">Choose Your Option</h2>
        <p className="text-muted-foreground">
          Select the package that best fits your needs
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(["good", "better", "best"] as const).map((tier) => {
          const summary = tierSummaries.get(tier)!;
          const config = tierConfig[tier];
          const IconComponent = config.icon;
          const isSelected = selectedTier === tier;
          const isEmpty = summary.items.length === 0;

          if (isEmpty) return null;

          return (
            <Card
              key={tier}
              className={`relative transition-all ${
                isSelected
                  ? `ring-2 ring-primary shadow-lg`
                  : "hover-elevate"
              } ${config.borderColor}`}
              data-testid={`tier-card-${tier}`}
            >
              {"recommended" in config && config.recommended && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">
                    Recommended
                  </Badge>
                </div>
              )}

              <CardHeader className={`${config.bgColor} rounded-t-lg`}>
                <div className="flex items-center justify-center gap-2">
                  <IconComponent className={`w-6 h-6 ${config.color}`} />
                  <CardTitle className={config.color}>{config.label}</CardTitle>
                </div>
                <CardDescription className="text-center">
                  {config.description}
                </CardDescription>
              </CardHeader>

              <CardContent className="pt-4 space-y-4">
                <div className="text-center">
                  <p className="text-3xl font-bold">
                    {formatCurrency(summary.total)}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Including tax
                  </p>
                </div>

                <div className="divide-y">
                  {summary.items.map((item, index) => (
                    <div
                      key={index}
                      className="py-2 flex items-start gap-2"
                      data-testid={`tier-${tier}-item-${index}`}
                    >
                      <Check className="w-4 h-4 text-green-500 mt-1 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {item.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity} x {formatCurrency(item.unitPrice)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatCurrency(summary.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>{formatCurrency(summary.taxAmount)}</span>
                  </div>
                </div>
              </CardContent>

              <CardFooter>
                <Button
                  className="w-full"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => handleSelect(tier)}
                  data-testid={`button-select-${tier}`}
                >
                  {isSelected ? "Selected" : "Select This Option"}
                </Button>
              </CardFooter>
            </Card>
          );
        })}
      </div>

      {selectedTier && (
        <div className="text-center text-sm text-muted-foreground">
          You selected the <strong>{tierConfig[selectedTier].label}</strong> option
        </div>
      )}
    </div>
  );
}
