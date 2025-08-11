import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, Package, Truck, CheckCircle, ExternalLink, ArrowLeft } from 'lucide-react';
import ReviewModal from '@/components/ReviewModal';
import SellerProfileModal from '@/components/SellerProfileModal';

interface Order {
  id: string;
  total_amount_eur: number;
  order_status: string;
  created_at: string;
  tracking_number: string | null;
  tracking_url: string | null;
  shipping_first_name: string | null;
  shipping_last_name: string | null;
  shipping_street: string | null;
  shipping_house_number: string | null;
  shipping_postal_code: string | null;
  shipping_city: string | null;
  shipping_country: string | null;
}

interface OrderWithSellers extends Order {
  sellers: Array<{
    seller_id: string;
    seller_username: string;
    has_review: boolean;
  }>;
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
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderWithSellers[]>([]);
  const [itemsByOrder, setItemsByOrder] = useState<Record<string, OrderItem[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedSellerId, setSelectedSellerId] = useState('');
  const [selectedSellerUsername, setSelectedSellerUsername] = useState('');
  const [sellerProfileOpen, setSellerProfileOpen] = useState(false);

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

        // Get sellers for each order and check for existing reviews
        const ordersWithSellers = await Promise.all(
          ordersList.map(async (order: any) => {
            const { data: orderItems } = await supabase
              .from('order_items')
              .select(`
                product_id,
                products!inner(seller_id, profiles!inner(username))
              `)
              .eq('order_id', order.id);

            const sellers = orderItems?.map((item: any) => ({
              seller_id: item.products.seller_id,
              seller_username: item.products.profiles.username,
              has_review: false
            })) || [];

            // Check for existing reviews
            if (sellers.length > 0) {
              const { data: reviews } = await supabase
                .from('reviews')
                .select('seller_id')
                .eq('order_id', order.id)
                .eq('reviewer_id', user.id);

              const reviewedSellerIds = new Set(reviews?.map(r => r.seller_id) || []);
              sellers.forEach(seller => {
                seller.has_review = reviewedSellerIds.has(seller.seller_id);
              });
            }

            return {
              ...order,
              sellers: sellers.filter((seller, index, self) => 
                index === self.findIndex(s => s.seller_id === seller.seller_id)
              )
            };
          })
        );

        setOrders(ordersWithSellers as any);

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

  const handleReviewSeller = (orderId: string, sellerId: string, sellerUsername: string) => {
    setSelectedOrderId(orderId);
    setSelectedSellerId(sellerId);
    setSelectedSellerUsername(sellerUsername);
    setReviewModalOpen(true);
  };

  const handleViewSellerProfile = (sellerId: string, sellerUsername: string) => {
    setSelectedSellerId(sellerId);
    setSelectedSellerUsername(sellerUsername);
    setSellerProfileOpen(true);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'processing':
        return <Package className="h-4 w-4 text-blue-500" />;
      case 'shipped':
        return <Truck className="h-4 w-4 text-orange-500" />;
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-blue-100 text-blue-800';
      case 'processing':
        return 'bg-yellow-100 text-yellow-800';
      case 'shipped':
        return 'bg-orange-100 text-orange-800';
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

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
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold font-cinzel">My Orders</h1>
          <Button 
            variant="outline" 
            onClick={() => navigate('/marketplace')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Marketplace
          </Button>
        </div>

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
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h3 className="font-semibold">Order #{order.id.slice(0,8)}</h3>
                        <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleString()}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-primary">€{Number(order.total_amount_eur).toFixed(2)}</p>
                        <div className="flex items-center gap-2 justify-end mt-1">
                          {getStatusIcon(order.order_status)}
                          <Badge className={getStatusColor(order.order_status)}>
                            {order.order_status}
                          </Badge>
                        </div>
                      </div>
                    </div>

                    {/* Tracking Information */}
                    {order.tracking_number && (
                      <div className="mb-3 p-3 bg-muted rounded">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-medium">Tracking: {order.tracking_number}</p>
                            <p className="text-xs text-muted-foreground">Track your package</p>
                          </div>
                          {order.tracking_url && (
                            <Button variant="outline" size="sm" asChild>
                              <a 
                                href={order.tracking_url} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="flex items-center gap-1"
                              >
                                <ExternalLink className="h-3 w-3" />
                                Track
                              </a>
                            </Button>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-medium text-sm">Items</h4>
                        <ul className="text-sm text-muted-foreground list-disc pl-5">
                          {(itemsByOrder[order.id] || []).map((it) => (
                            <li key={it.id}>
                              {it.quantity}x Product {it.product_id.slice(0,8)} (€{it.price_eur.toFixed(2)})
                            </li>
                          ))}
                        </ul>

                        {/* Sellers and Reviews */}
                        {order.sellers.length > 0 && (
                          <div className="mt-3">
                            <h4 className="font-medium text-sm mb-2">Sellers</h4>
                            <div className="space-y-2">
                              {order.sellers.map((seller) => (
                                <div key={seller.seller_id} className="flex items-center justify-between p-2 bg-muted rounded">
                                  <button
                                    onClick={() => handleViewSellerProfile(seller.seller_id, seller.seller_username)}
                                    className="text-sm font-medium text-primary hover:underline"
                                  >
                                    @{seller.seller_username}
                                  </button>
                                  {order.order_status === 'delivered' && (
                                    <Button
                                      variant={seller.has_review ? "outline" : "default"}
                                      size="sm"
                                      onClick={() => handleReviewSeller(order.id, seller.seller_id, seller.seller_username)}
                                      disabled={seller.has_review}
                                      className="flex items-center gap-1"
                                    >
                                      <Star className="h-3 w-3" />
                                      {seller.has_review ? 'Reviewed' : 'Review'}
                                    </Button>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div>
                        <h4 className="font-medium text-sm">Shipping Address</h4>
                        <p className="text-sm text-muted-foreground">
                          {order.shipping_first_name} {order.shipping_last_name}, {order.shipping_street} {order.shipping_house_number}, {order.shipping_postal_code} {order.shipping_city}, {order.shipping_country}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Review Modal */}
        <ReviewModal
          open={reviewModalOpen}
          onOpenChange={setReviewModalOpen}
          orderId={selectedOrderId}
          sellerId={selectedSellerId}
          sellerUsername={selectedSellerUsername}
          onReviewSubmitted={() => {
            const fetchData = async () => {
              setIsLoading(true);
              try {
                const { data: ordersData, error: ordersError } = await supabase
                  .from('orders')
                  .select('*')
                  .eq('user_id', user!.id)
                  .order('created_at', { ascending: false });

                if (ordersError) throw ordersError;
                const ordersList = ordersData || [];

                const ordersWithSellers = await Promise.all(
                  ordersList.map(async (order: any) => {
                    const { data: orderItems } = await supabase
                      .from('order_items')
                      .select(`
                        product_id,
                        products!inner(seller_id, profiles!inner(username))
                      `)
                      .eq('order_id', order.id);

                    const sellers = orderItems?.map((item: any) => ({
                      seller_id: item.products.seller_id,
                      seller_username: item.products.profiles.username,
                      has_review: false
                    })) || [];

                    if (sellers.length > 0) {
                      const { data: reviews } = await supabase
                        .from('reviews')
                        .select('seller_id')
                        .eq('order_id', order.id)
                        .eq('reviewer_id', user!.id);

                      const reviewedSellerIds = new Set(reviews?.map(r => r.seller_id) || []);
                      sellers.forEach(seller => {
                        seller.has_review = reviewedSellerIds.has(seller.seller_id);
                      });
                    }

                    return {
                      ...order,
                      sellers: sellers.filter((seller, index, self) => 
                        index === self.findIndex(s => s.seller_id === seller.seller_id)
                      )
                    };
                  })
                );

                setOrders(ordersWithSellers as any);
              } catch (e) {
                console.error('Error loading orders:', e);
              } finally {
                setIsLoading(false);
              }
            };
            fetchData();
            setReviewModalOpen(false);
          }}
        />

        {/* Seller Profile Modal */}
        <SellerProfileModal
          open={sellerProfileOpen}
          onOpenChange={setSellerProfileOpen}
          sellerId={selectedSellerId}
          sellerUsername={selectedSellerUsername}
        />
      </div>
    </div>
  );
};

export default Orders;
