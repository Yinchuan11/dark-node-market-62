import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { TrendingUp, Package, Euro, Users, Calendar, BarChart3 } from "lucide-react";

interface AnalyticsData {
  total_orders: number;
  products_sold: number;
  total_quantity_sold: number;
  total_revenue: number;
  avg_order_value: number;
  month: string;
}

interface ProductPerformance {
  title: string;
  total_sold: number;
  revenue: number;
  avg_price: number;
}

export function SellerAnalytics() {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData[]>([]);
  const [productPerformance, setProductPerformance] = useState<ProductPerformance[]>([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'3months' | '6months' | '1year'>('6months');

  useEffect(() => {
    fetchAnalyticsData();
    fetchProductPerformance();
  }, [timeRange]);

  const fetchAnalyticsData = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const monthsBack = timeRange === '3months' ? 3 : timeRange === '6months' ? 6 : 12;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);

      // Query orders and calculate analytics manually since view might not be available
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id,
          total_amount_eur,
          created_at,
          order_items (
            quantity,
            price_eur,
            products (
              seller_id,
              title
            )
          )
        `)
        .eq('order_items.products.seller_id', user.user.id)
        .eq('status', 'confirmed')
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Group by month and calculate metrics
      const monthlyData = new Map<string, AnalyticsData>();
      
      orders?.forEach((order: any) => {
        const month = new Date(order.created_at).toISOString().slice(0, 7); // YYYY-MM
        const sellerItems = order.order_items?.filter((item: any) => 
          item.products?.seller_id === user.user.id
        ) || [];
        
        if (sellerItems.length === 0) return;
        
        const orderRevenue = sellerItems.reduce((sum: number, item: any) => 
          sum + (Number(item.price_eur) * item.quantity), 0
        );
        const orderQuantity = sellerItems.reduce((sum: number, item: any) => 
          sum + item.quantity, 0
        );
        
        if (monthlyData.has(month)) {
          const existing = monthlyData.get(month)!;
          existing.total_orders += 1;
          existing.total_revenue += orderRevenue;
          existing.total_quantity_sold += orderQuantity;
          existing.avg_order_value = existing.total_revenue / existing.total_orders;
        } else {
          monthlyData.set(month, {
            total_orders: 1,
            products_sold: 0, // Will be calculated separately
            total_quantity_sold: orderQuantity,
            total_revenue: orderRevenue,
            avg_order_value: orderRevenue,
            month: month + '-01'
          });
        }
      });

      setAnalyticsData(Array.from(monthlyData.values()));
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  const fetchProductPerformance = async () => {
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return;

      const monthsBack = timeRange === '3months' ? 3 : timeRange === '6months' ? 6 : 12;
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - monthsBack);

      const { data, error } = await supabase
        .from('order_items')
        .select(`
          quantity,
          price_eur,
          products!inner (
            title,
            seller_id
          ),
          orders!inner (
            created_at,
            status
          )
        `)
        .eq('products.seller_id', user.user.id)
        .eq('orders.status', 'confirmed')
        .gte('orders.created_at', startDate.toISOString());

      if (error) throw error;

      // Group by product and calculate metrics
      const productMap = new Map<string, ProductPerformance>();
      
      data?.forEach((item: any) => {
        const title = item.products.title;
        const revenue = Number(item.price_eur) * item.quantity;
        
        if (productMap.has(title)) {
          const existing = productMap.get(title)!;
          existing.total_sold += item.quantity;
          existing.revenue += revenue;
          existing.avg_price = existing.revenue / existing.total_sold;
        } else {
          productMap.set(title, {
            title,
            total_sold: item.quantity,
            revenue,
            avg_price: Number(item.price_eur)
          });
        }
      });

      const sortedProducts = Array.from(productMap.values())
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      setProductPerformance(sortedProducts);
    } catch (error) {
      console.error('Error fetching product performance:', error);
    } finally {
      setLoading(false);
    }
  };

  const totals = analyticsData.reduce(
    (acc, curr) => ({
      orders: acc.orders + Number(curr.total_orders),
      revenue: acc.revenue + Number(curr.total_revenue),
      quantity: acc.quantity + Number(curr.total_quantity_sold),
      products: Math.max(acc.products, Number(curr.products_sold))
    }),
    { orders: 0, revenue: 0, quantity: 0, products: 0 }
  );

  const avgOrderValue = totals.orders > 0 ? totals.revenue / totals.orders : 0;

  if (loading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex gap-2">
        {(['3months', '6months', '1year'] as const).map((range) => (
          <Badge
            key={range}
            variant={timeRange === range ? 'default' : 'outline'}
            className="cursor-pointer"
            onClick={() => setTimeRange(range)}
          >
            {range === '3months' ? '3 Months' : range === '6months' ? '6 Months' : '1 Year'}
          </Badge>
        ))}
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <Euro className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{totals.revenue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              From {totals.orders} orders
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.orders}</div>
            <p className="text-xs text-muted-foreground">
              {totals.quantity} items sold
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Order Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">€{avgOrderValue.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              Per order
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Products Sold</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.products}</div>
            <p className="text-xs text-muted-foreground">
              Different products
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Breakdown */}
      {analyticsData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Monthly Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analyticsData.map((month) => {
                const monthName = new Date(month.month).toLocaleDateString('en-US', { 
                  month: 'long', 
                  year: 'numeric' 
                });
                
                return (
                  <div key={month.month} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{monthName}</p>
                      <p className="text-sm text-muted-foreground">
                        {Number(month.total_orders)} orders • {Number(month.total_quantity_sold)} items
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">€{Number(month.total_revenue).toFixed(2)}</p>
                      <p className="text-sm text-muted-foreground">
                        Avg: €{Number(month.avg_order_value).toFixed(2)}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Products */}
      {productPerformance.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Top Performing Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {productPerformance.map((product, index) => (
                <div key={product.title} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">#{index + 1}</Badge>
                    <div>
                      <p className="font-medium">{product.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {product.total_sold} sold • Avg: €{product.avg_price.toFixed(2)}
                      </p>
                    </div>
                  </div>
                  <p className="font-bold">€{product.revenue.toFixed(2)}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {analyticsData.length === 0 && (
        <Card>
          <CardContent className="p-6 text-center">
            <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              No sales data available for the selected time period.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}