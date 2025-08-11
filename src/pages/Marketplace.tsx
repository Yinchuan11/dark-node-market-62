import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Navigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Search, LogOut, Bitcoin, Wallet, Settings, Users } from 'lucide-react';
import ProductModal from '@/components/ProductModal';
import ShoppingCart from '@/components/ShoppingCart';
import { useCart } from '@/hooks/useCart';
import NewsPanel from '@/components/NewsPanel';

interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  category: string;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  seller_id: string;
  stock: number;
}

const Marketplace = () => {
  const { user, profile, loading, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [categories, setCategories] = useState<any[]>([]);
  const [categoryCounts, setCategoryCounts] = useState<{[key: string]: number}>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [btcPrices, setBtcPrices] = useState<{[key: string]: number}>({});
  const [ltcPrices, setLtcPrices] = useState<{[key: string]: number}>({});
  const [currentBtcPrice, setCurrentBtcPrice] = useState<number | null>(null);
  const [currentLtcPrice, setCurrentLtcPrice] = useState<number | null>(null);
  const [userCount, setUserCount] = useState(0);
  
  const { cartItems, addToCart, updateQuantity, removeItem, clearCart, getCartItemCount } = useCart();

  useEffect(() => {
    fetchProducts();
    fetchCategories(); 
    fetchUserCount();
    
    // Set up real-time listener for user count
    const channel = supabase
      .channel('user-count-changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'profiles' }, 
        () => {
          fetchUserCount();
        }
      )
      .subscribe();
      
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, profile]);

  useEffect(() => {
    // Recalculate BTC prices when currentBtcPrice changes
    if (currentBtcPrice && products.length > 0) {
      const prices: {[key: string]: number} = {};
      products.forEach(product => {
        prices[product.id] = product.price / currentBtcPrice;
      });
      setBtcPrices(prices);
    }
  }, [currentBtcPrice, products]);

  useEffect(() => {
    // Recalculate LTC prices when currentLtcPrice changes
    if (currentLtcPrice && products.length > 0) {
      const prices: {[key: string]: number} = {};
      products.forEach(product => {
        prices[product.id] = product.price / currentLtcPrice;
      });
      setLtcPrices(prices);
    }
  }, [currentLtcPrice, products]);

  useEffect(() => {
    filterProducts();
    calculateCategoryCounts();
  }, [products, searchTerm, selectedCategory]);

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

  const fetchUserCount = async () => {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('Error fetching user count:', error);
      return;
    }

    setUserCount(count || 0);
  };



  const fetchProducts = async () => {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching products:', error);
      toast({
        title: "Error",
        description: "Products could not be loaded.",
        variant: "destructive"
      });
      return;
    }

    setProducts(data || []);
    
    // Calculate BTC prices for all products
    if (currentBtcPrice && data) {
      const btcPricesMap: {[key: string]: number} = {};
      data.forEach(product => {
        btcPricesMap[product.id] = product.price / currentBtcPrice;
      });
      setBtcPrices(btcPricesMap);
    }
    
    // Calculate LTC prices for all products
    if (currentLtcPrice && data) {
      const ltcPricesMap: {[key: string]: number} = {};
      data.forEach(product => {
        ltcPricesMap[product.id] = product.price / currentLtcPrice;
      });
      setLtcPrices(ltcPricesMap);
    }
  };

  const calculateCategoryCounts = () => {
    const counts: {[key: string]: number} = { all: products.length };
    
    products.forEach(product => {
      counts[product.category] = (counts[product.category] || 0) + 1;
    });
    
    setCategoryCounts(counts);
  };

  const filterProducts = () => {
    let filtered = products;

    if (searchTerm) {
      filtered = filtered.filter(product =>
        product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        product.description?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (selectedCategory !== 'all') {
      filtered = filtered.filter(product => product.category === selectedCategory);
    }

    setFilteredProducts(filtered);
  };

  const openProductModal = (product: Product) => {
    setSelectedProduct(product);
    setModalOpen(true);
  };

  const handleAddToCart = (product: Product) => {
    // Check if user is trying to buy their own product
    if (user && product.seller_id === user.id) {
      toast({
        title: "Cannot Add to Cart",
        description: "You cannot purchase your own product.",
        variant: "destructive"
      });
      return;
    }

    addToCart({
      id: product.id,
      title: product.title,
      price: product.price,
      image_url: product.image_url,
      category: product.category
    });
    
    toast({
      title: "Added to Cart",
      description: `${product.title} has been added to your cart.`
    });
  };

  const handleSignOut = async () => {
    await signOut();
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
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-3 py-3">
          <div className="flex items-center justify-between">
            <h1 className="text-xl md:text-3xl font-bold font-cinzel">Oracle Market</h1>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setCartOpen(true)}
                className="relative shrink-0"
              >
                Cart ({getCartItemCount()})
              </Button>
              
              <Button variant="outline" size="sm" onClick={handleSignOut} className="shrink-0">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Sign Out</span>
              </Button>
            </div>
          </div>
          
          {/* Second row for user info and navigation on mobile */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground truncate">
              {profile?.username} ({profile?.role})
            </span>
            
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={() => navigate('/settings')} className="text-xs px-1 sm:px-2">
                <Settings className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Settings</span>
              </Button>
              
              <Button variant="ghost" size="sm" onClick={() => navigate('/wallet')} className="text-xs px-1 sm:px-2">
                <Wallet className="h-3 w-3 sm:mr-1" />
                <span className="hidden sm:inline">Wallet</span>
              </Button>
              
              {profile?.role === 'admin' && (
                <Button variant="ghost" size="sm" onClick={() => window.location.href = '/admin'} className="text-xs px-1 sm:px-2">
                  <span>Admin Panel</span>
                </Button>
              )}
              
              {(profile?.role === 'seller' || profile?.role === 'admin') && (
                <Button variant="ghost" size="sm" onClick={() => window.location.href = '/seller'} className="text-xs px-1 sm:px-2">
                  <span>Seller Dashboard</span>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 md:px-6 py-4 md:py-6">

        {/* User Statistics */}
        <div className="mb-6">
          <Card className="bg-gradient-to-r from-primary/10 to-secondary/10">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">Registrierte Nutzer</span>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {userCount}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-6">
          <NewsPanel />
        </div>

        {/* Search and Filter */}
        <div className="mb-6 md:mb-8 space-y-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search products..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All Categories ({categoryCounts.all || 0})
                </SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.name}>
                    {category.name} ({categoryCounts[category.name] || 0})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Products Grid - Mobile optimized with exactly 5 columns on larger screens */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 md:gap-4">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="hover:shadow-lg transition-shadow">
              <div onClick={() => openProductModal(product)} className="cursor-pointer">
                {product.image_url && (
                  <div className="aspect-square bg-muted">
                    <img
                      src={product.image_url}
                      alt={product.title}
                      className="w-full h-full object-cover rounded-t-lg pointer-events-none select-none"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                      onContextMenu={(e) => e.preventDefault()}
                      draggable={false}
                    />
                  </div>
                )}
                <CardHeader className="pb-2 px-3 pt-3">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-sm md:text-base line-clamp-2">{product.title}</CardTitle>
                    <Badge variant="secondary" className="text-xs shrink-0 ml-2">
                      {product.category}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-3 pb-3">
                  <div className="space-y-2">
                    <div className="text-lg font-bold text-primary">
                      €{product.price.toFixed(2)}
                    </div>
                    <div className="flex flex-col gap-1">
                      {currentBtcPrice && (
                        <div className="flex items-center text-xs text-orange-500">
                          <Bitcoin className="h-3 w-3 mr-1" />
                          <span>₿{(product.price / currentBtcPrice).toFixed(8)}</span>
                        </div>
                      )}
                      {currentLtcPrice && (
                        <div className="flex items-center text-xs text-blue-500">
                          <div className="h-3 w-3 bg-blue-500 rounded-full flex items-center justify-center mr-1">
                            <span className="text-white text-[8px] font-bold">L</span>
                          </div>
                          <span>Ł{(product.price / currentLtcPrice).toFixed(8)}</span>
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Stock: {product.stock > 0 ? `${product.stock} available` : 'Out of stock'}
                    </div>
                  </div>
                  <Button 
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToCart(product);
                    }}
                    className="w-full mt-3 text-xs md:text-sm"
                    size="sm"
                    disabled={product.stock === 0}
                  >
                    {product.stock === 0 ? 'Out of Stock' : 'Buy Now'}
                  </Button>
                </CardContent>
              </div>
            </Card>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12 col-span-full">
            <h3 className="text-lg font-semibold mb-2">No Products Found</h3>
            <p className="text-muted-foreground">
              {searchTerm || selectedCategory !== 'all'
                ? 'Try different search terms or filters.'
                : 'No products are currently available.'}
            </p>
          </div>
        )}
      </main>

      {/* Product Modal */}
      <ProductModal
        product={selectedProduct}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />

      {/* Shopping Cart */}
      <ShoppingCart
        open={cartOpen}
        onOpenChange={setCartOpen}
        cartItems={cartItems}
        onUpdateQuantity={updateQuantity}
        onRemoveItem={removeItem}
        onClearCart={clearCart}
      />
    </div>
  );
};

export default Marketplace;