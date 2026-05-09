import { useMutation } from "@tanstack/react-query";
import { Plus, CreditCard, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { StoredPaymentMethod } from "@shared/schema";

interface PaymentMethodsSectionProps {
  contactId: string;
  paymentMethods: StoredPaymentMethod[];
}

export default function PaymentMethodsSection({ contactId, paymentMethods }: PaymentMethodsSectionProps) {
  const { toast } = useToast();

  const deletePaymentMethodMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/payment-methods/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete payment method");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payment-methods", { contactId }] });
      toast({ title: "Payment method removed" });
    },
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-lg flex items-center gap-2">
          <CreditCard className="w-5 h-5" />
          Payment Methods ({paymentMethods.length})
        </CardTitle>
        <Button 
          size="sm" 
          variant="outline" 
          data-testid="button-add-payment-method"
        >
          <Plus className="w-3 h-3 mr-1" />
          Add Card
        </Button>
      </CardHeader>
      <CardContent>
        {paymentMethods.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            <CreditCard className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No payment methods saved</p>
          </div>
        ) : (
          <div className="space-y-2">
            {paymentMethods.map(pm => (
              <div 
                key={pm.id} 
                className="flex items-center justify-between p-3 border rounded-md"
                data-testid={`payment-method-card-${pm.id}`}
              >
                <div className="flex items-center gap-3">
                  <CreditCard className="w-5 h-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">
                      {pm.brand ? `${pm.brand.charAt(0).toUpperCase() + pm.brand.slice(1)}` : 'Card'} 
                      {pm.last4 && ` •••• ${pm.last4}`}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {pm.expiryMonth && pm.expiryYear && `Expires ${pm.expiryMonth}/${pm.expiryYear}`}
                      {pm.isDefault && <Badge variant="secondary" className="ml-2 text-xs">Default</Badge>}
                    </p>
                  </div>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-7 w-7"
                  onClick={() => deletePaymentMethodMutation.mutate(pm.id)}
                  data-testid={`button-delete-payment-method-${pm.id}`}
                >
                  <Trash2 className="w-3 h-3 text-muted-foreground" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
