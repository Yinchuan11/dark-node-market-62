import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, Percent } from "lucide-react";

interface BulkDiscountManagerProps {
  productId: string;
  productTitle: string;
}

interface BulkDiscount {
  id: string;
  min_quantity: number;
  discount_percentage: number;
  created_at: string;
}

export function BulkDiscountManager({ productId, productTitle }: BulkDiscountManagerProps) {
  const { toast } = useToast();
  const [discounts, setDiscounts] = useState<BulkDiscount[]>([]);
  const [loading, setLoading] = useState(false);
  const [newDiscount, setNewDiscount] = useState({
    min_quantity: "",
    discount_percentage: ""
  });

  useEffect(() => {
    fetchDiscounts();
  }, [productId]);

  const fetchDiscounts = async () => {
    try {
      const { data, error } = await supabase
        .from('bulk_discounts')
        .select('*')
        .eq('product_id', productId)
        .order('min_quantity', { ascending: true });

      if (error) throw error;
      setDiscounts(data || []);
    } catch (error) {
      console.error('Error fetching discounts:', error);
    }
  };

  const addDiscount = async () => {
    const minQty = parseInt(newDiscount.min_quantity);
    const discountPct = parseFloat(newDiscount.discount_percentage);

    if (!minQty || minQty < 1) {
      toast({
        title: "Error",
        description: "Minimum quantity must be at least 1",
        variant: "destructive",
      });
      return;
    }

    if (!discountPct || discountPct <= 0 || discountPct > 100) {
      toast({
        title: "Error",
        description: "Discount percentage must be between 0.01 and 100",
        variant: "destructive",
      });
      return;
    }

    // Check for duplicate min_quantity
    if (discounts.some(d => d.min_quantity === minQty)) {
      toast({
        title: "Error",
        description: "A discount for this quantity already exists",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('bulk_discounts')
        .insert({
          product_id: productId,
          min_quantity: minQty,
          discount_percentage: discountPct
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Bulk discount added successfully",
      });

      setNewDiscount({ min_quantity: "", discount_percentage: "" });
      await fetchDiscounts();
    } catch (error) {
      console.error('Error adding discount:', error);
      toast({
        title: "Error",
        description: "Failed to add discount. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const removeDiscount = async (discountId: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('bulk_discounts')
        .delete()
        .eq('id', discountId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Bulk discount removed successfully",
      });

      await fetchDiscounts();
    } catch (error) {
      console.error('Error removing discount:', error);
      toast({
        title: "Error",
        description: "Failed to remove discount. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Percent className="h-5 w-5" />
          Bulk Discounts
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Set quantity-based discounts for {productTitle}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new discount */}
        <div className="grid grid-cols-3 gap-2">
          <div>
            <Label htmlFor="min_quantity">Min. Quantity</Label>
            <Input
              id="min_quantity"
              type="number"
              min="1"
              placeholder="10"
              value={newDiscount.min_quantity}
              onChange={(e) => setNewDiscount(prev => ({ ...prev, min_quantity: e.target.value }))}
            />
          </div>
          <div>
            <Label htmlFor="discount_percentage">Discount %</Label>
            <Input
              id="discount_percentage"
              type="number"
              min="0.01"
              max="100"
              step="0.01"
              placeholder="5.00"
              value={newDiscount.discount_percentage}
              onChange={(e) => setNewDiscount(prev => ({ ...prev, discount_percentage: e.target.value }))}
            />
          </div>
          <div className="flex items-end">
            <Button 
              onClick={addDiscount} 
              disabled={loading || !newDiscount.min_quantity || !newDiscount.discount_percentage}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </div>
        </div>

        {/* Existing discounts */}
        {discounts.length > 0 ? (
          <div className="space-y-2">
            <Label>Current Bulk Discounts</Label>
            {discounts.map((discount) => (
              <div
                key={discount.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <Badge variant="outline">
                    {discount.min_quantity}+ items
                  </Badge>
                  <Badge variant="secondary">
                    {discount.discount_percentage}% off
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeDiscount(discount.id)}
                  disabled={loading}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-4 text-muted-foreground">
            No bulk discounts configured yet
          </div>
        )}

        {discounts.length > 0 && (
          <div className="p-3 bg-muted rounded-lg">
            <p className="text-xs text-muted-foreground">
              <strong>Example:</strong> If a customer orders {discounts[0]?.min_quantity}+ items, 
              they get {discounts[0]?.discount_percentage}% off the total price.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
