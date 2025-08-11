import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface Order {
  id: string;
  total_amount_eur: number;
  status: string;
  created_at: string;
  shipping_first_name: string | null;
  shipping_last_name: string | null;
  shipping_street: string | null;
  shipping_house_number: string | null;
  shipping_postal_code: string | null;
  shipping_city: string | null;
  shipping_country: string | null;
}

interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  quantity: number;
  price_eur: number;
}

const Orders: React.FC = () => {
  const { user, loading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItem[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: ordersData, error: ordersError } = await supabase
          .from('orders')
          .select('*')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false });

        if (ordersError) throw ordersError;
        const ordersList = ordersData || [];
        setOrders(ordersList as any);

        const orderIds = ordersList.map((o: any) => o.id);
        if (orderIds.length > 0) {
          const { data: itemsData, error: itemsError } = await supabase
            .from('order_items')
            .select('*')
            .in('order_id', orderIds);
          if (itemsError) throw itemsError;
          const grouped: Record<string, OrderItem[]> = {};
          (itemsData || []).forEach((it: any) => {
            if (!grouped[it.order_id]) grouped[it.order_id] = [];
            grouped[it.order_id].push({
              id: it.id,
              order_id: it.order_id,
              product_id: it.product_id,
              quantity: it.quantity,
              price_eur: Number(it.price_eur),
            });
          });
          setItemsByOrder(grouped);
        } else {
          setItemsByOrder({});
        }
      } catch (e) {
        console.error('Error loading orders:', e);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold font-cinzel">My Orders</h1>

        <Card>
          <CardHeader>
            <CardTitle>Order History ({orders.length})</CardTitle>
            <CardDescription>View your past purchases and their status</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <p className="text-muted-foreground">Loading orders...</p>
            ) : orders.length === 0 ? (
              <p className="text-muted-foreground">You have not placed any orders yet.</p>
            ) : (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                {orders.map((order) => (
                  <div key={order.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-semibold">Order #{order.id.slice(0,8)}</h3>
                        <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">€{Number(order.total_amount_eur).toFixed(2)}</p>
                        <p className="text-sm">Status: <span className="font-medium">{order.status}</span></p>
                      </div>
                    </div>

                    <div className="mt-3">
                      <h4 className="font-medium text-sm">Items</h4>
                      <ul className="text-sm text-muted-foreground list-disc pl-5">
                        {(itemsByOrder[order.id] || []).map((it) => (
                          <li key={it.id}>
                            {it.quantity}x Product {it.product_id.slice(0,8)} (€{it.price_eur.toFixed(2)})
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-3">
                      <h4 className="font-medium text-sm">Shipping Address</h4>
                      <p className="text-sm text-muted-foreground">
                        {order.shipping_first_name} {order.shipping_last_name}, {order.shipping_street} {order.shipping_house_number}, {order.shipping_postal_code} {order.shipping_city}, {order.shipping_country}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Orders;
