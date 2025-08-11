import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Upload, Edit, Package, User } from 'lucide-react';
import { FileUpload } from '@/components/ui/file-upload';
import EditProductModal from '@/components/EditProductModal';


interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  image_url: string;
  is_active: boolean;
  created_at: string;
  stock: number;
}

interface Order {
  id: string;
  user_id: string;
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
  buyer_username: string;
  items: {
    order_item_id: string;
    quantity: number;
    price_eur: number;
    product_title: string | null;
  }[] | null;
}

const SellerDashboard = () => {
  const { user, profile, loading } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    price: '',
    category: '',
    imageUrl: '',
    stock: ''
  });

  const [categories, setCategories] = useState<any[]>([]);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editModalOpen, setEditModalOpen] = useState(false);

  useEffect(() => {
    fetchCategories();
    if (profile?.role === 'seller' || profile?.role === 'admin') {
      fetchProducts();
      fetchOrders();
    }
  }, [profile]);

  const fetchCategories = async () => {
    const { data, error } = await supabase
      .from('categories')
      .select('*')
      .order('name');
    
    if (error) {
      console.error('Error fetching categories:', error);
      return;
    }

    setCategories(data || []);
  };

  const fetchProducts = async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('seller_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
      return;
    }

    setProducts(data || []);
  };

const fetchOrders = async () => {
  if (!user) return;

  const { data, error } = await supabase
    .rpc('get_seller_orders', { seller_uuid: user.id });

  if (error) {
    console.error('Error fetching seller orders:', error);
    return;
  }

  setOrders((data as any) || []);
};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    // Validate image is required
    if (!formData.imageUrl) {
      toast({
        title: "Image required",
        description: "Please upload an image for your product.",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);

    const { error } = await supabase
      .from('products')
      .insert({
        title: formData.title,
        description: formData.description,
        price: parseFloat(formData.price),
        category: formData.category,
        image_url: formData.imageUrl || null,
        seller_id: user.id,
        is_active: true,
        stock: parseInt(formData.stock)
      });

    if (error) {
      toast({
        title: "Error adding product",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "Product added",
        description: "Your product has been successfully added."
      });
      setFormData({
        title: '',
        description: '',
        price: '',
        category: '',
        imageUrl: '',
        stock: ''
      });
      fetchProducts();
    }

    setIsLoading(false);
  };

  const toggleProductStatus = async (productId: string, isActive: boolean) => {
    const { error } = await supabase
      .from('products')
      .update({ is_active: !isActive })
      .eq('id', productId);

    if (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive"
      });
    } else {
      fetchProducts();
      toast({
        title: "Status changed",
        description: "Product status has been updated."
      });
    }
  };

  const deleteProduct = async (productId: string, productTitle: string) => {
    if (!confirm(`Are you sure you want to delete the product "${productTitle}"?`)) {
      return;
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', productId);

    if (error) {
      toast({
        title: "Error deleting",
        description: error.message,
        variant: "destructive"
      });
    } else {
      fetchProducts();
      toast({
        title: "Product deleted",
        description: "The product has been successfully deleted."
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!user || (profile?.role !== 'seller' && profile?.role !== 'admin')) {
    return <Navigate to="/marketplace" replace />;
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <h1 className="text-3xl font-bold font-cinzel">Seller Dashboard</h1>
          </div>
          <Button 
            variant="outline" 
            onClick={() => navigate('/marketplace')}
          >
            Back to Marketplace
          </Button>
        </div>

        <Tabs defaultValue="products" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="products" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Products
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              Orders
            </TabsTrigger>
          </TabsList>

          <TabsContent value="products" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Add Product Form */}
              <Card>
                <CardHeader>
                  <CardTitle>Add New Product</CardTitle>
                  <CardDescription>
                    Add a new product to your shop
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <Label htmlFor="title">Product Name</Label>
                      <Input
                        id="title"
                        value={formData.title}
                        onChange={(e) => setFormData({...formData, title: e.target.value})}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="price">Price (EUR)</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: e.target.value})}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="category">Category</Label>
                      <Select 
                        value={formData.category} 
                        onValueChange={(value) => setFormData({...formData, category: value})}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Choose category" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((category) => (
                            <SelectItem key={category.id} value={category.name}>
                              {category.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="stock">Stock</Label>
                      <Input
                        id="stock"
                        type="number"
                        min="0"
                        value={formData.stock}
                        onChange={(e) => setFormData({...formData, stock: e.target.value})}
                        required
                      />
                    </div>

                    <div>
                      <Label htmlFor="imageUrl">Product Image</Label>
                      <FileUpload
                        value={formData.imageUrl}
                        onChange={(url) => setFormData({...formData, imageUrl: url})}
                      />
                    </div>

                    <div>
                      <Label htmlFor="description">Description</Label>
                      <Textarea
                        id="description"
                        value={formData.description}
                        onChange={(e) => setFormData({...formData, description: e.target.value})}
                        rows={4}
                      />
                    </div>

                    <Button type="submit" className="w-full" disabled={isLoading}>
                      <Upload className="h-4 w-4 mr-2" />
                      {isLoading ? "Adding..." : "Add Product"}
                    </Button>
                  </form>
                </CardContent>
              </Card>

              {/* Products List */}
              <Card>
                <CardHeader>
                  <CardTitle>My Products ({products.length})</CardTitle>
                  <CardDescription>
                    Manage your available products
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4 max-h-96 overflow-y-auto">
                    {products.map((product) => (
                      <div key={product.id} className="border rounded-lg p-4">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <h3 className="font-semibold">{product.title}</h3>
                            <p className="text-sm text-muted-foreground">{product.category}</p>
                            <p className="text-lg font-bold text-primary">€{product.price}</p>
                            <p className="text-sm text-muted-foreground">Stock: {product.stock} units</p>
                            {product.stock === 0 && (
                              <p className="text-sm text-red-500 font-medium">Out of stock</p>
                            )}
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingProduct(product);
                                setEditModalOpen(true);
                              }}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              Edit
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteProduct(product.id, product.title)}
                            >
                              Delete
                            </Button>
                            <Button
                              variant={product.is_active ? "destructive" : "default"}
                              size="sm"
                              onClick={() => toggleProductStatus(product.id, product.is_active)}
                            >
                              {product.is_active ? "Deactivate" : "Activate"}
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                    {products.length === 0 && (
                      <p className="text-muted-foreground text-center py-8">
                        No products added yet.
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="orders" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Customer Orders ({orders.length})</CardTitle>
                <CardDescription>
                  View and manage orders containing your products
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 max-h-96 overflow-y-auto">
                  {orders.map((order) => (
                    <div key={order.id} className="border rounded-lg p-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h3 className="font-semibold">Order #{order.id.slice(0, 8)}</h3>
                          <p className="text-sm text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString()}
                          </p>
                          <p className="text-lg font-bold text-primary">€{order.total_amount_eur.toFixed(2)}</p>
                          <p className="text-sm">Status: <span className="font-medium">{order.status}</span></p>
                          <p className="text-sm">Customer: <span className="font-medium">@{order.buyer_username}</span></p>
                          
                          <div className="mt-2">
                            <h4 className="font-medium text-sm">Items:</h4>
                            {order.items?.map((item) => (
                              <p key={item.order_item_id} className="text-xs text-muted-foreground">
                                {item.quantity}x {item.product_title || 'Product unavailable'} (€{item.price_eur.toFixed(2)})
                              </p>
                            ))}
                          </div>
                        </div>
                        
                        <div>
                          <h4 className="font-medium text-sm mb-2">Shipping Address:</h4>
                          <div className="text-sm text-muted-foreground space-y-1">
                            <p>{order.shipping_first_name} {order.shipping_last_name}</p>
                            <p>{order.shipping_street} {order.shipping_house_number}</p>
                            <p>{order.shipping_postal_code} {order.shipping_city}</p>
                            <p>{order.shipping_country}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                  {orders.length === 0 && (
                    <p className="text-muted-foreground text-center py-8">
                      No orders yet.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit Product Modal */}
        <EditProductModal
          product={editingProduct}
          open={editModalOpen}
          onOpenChange={setEditModalOpen}
          onProductUpdated={fetchProducts}
        />
      </div>
    </div>
  );
};

export default SellerDashboard;
