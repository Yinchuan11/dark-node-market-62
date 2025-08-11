import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Bitcoin, ShoppingCart, User, Coins } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

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
}

interface ProductModalProps {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ProductModal: React.FC<ProductModalProps> = ({ product, open, onOpenChange }) => {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [ltcPrice, setLtcPrice] = useState<number | null>(null);
  const [btcAmount, setBtcAmount] = useState<number | null>(null);
  const [ltcAmount, setLtcAmount] = useState<number | null>(null);
  const [sellerUsername, setSellerUsername] = useState<string>('');

  useEffect(() => {
    if (product && open) {
      fetchCryptoPrices();
      fetchSellerUsername();
    }
  }, [product, open]);

  const fetchCryptoPrices = async () => {
    try {
      const [btcResponse, ltcResponse] = await Promise.all([
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur'),
        fetch('https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=eur')
      ]);
      
      const btcData = await btcResponse.json();
      const ltcData = await ltcResponse.json();
      
      const currentBtcPrice = btcData.bitcoin.eur;
      const currentLtcPrice = ltcData.litecoin.eur;
      
      setBtcPrice(currentBtcPrice);
      setLtcPrice(currentLtcPrice);
      
      if (product) {
        setBtcAmount(product.price / currentBtcPrice);
        setLtcAmount(product.price / currentLtcPrice);
      }
    } catch (error) {
      console.error('Error fetching crypto prices:', error);
    }
  };

  const fetchSellerUsername = async () => {
    if (!product) return;
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('user_id', product.seller_id)
        .single();
      
      if (error) {
        console.error('Error fetching seller username:', error);
        setSellerUsername('Unknown');
      } else {
        setSellerUsername(data?.username || 'Unknown');
      }
    } catch (error) {
      console.error('Error fetching seller username:', error);
      setSellerUsername('Unknown');
    }
  };

  if (!product) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <ShoppingCart className="h-5 w-5" />
            <span>{product.title}</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Product Image */}
          {product.image_url && (
            <div className="w-full h-64 bg-muted rounded-lg overflow-hidden">
              <img
                src={product.image_url}
                alt={product.title}
                className="w-full h-full object-cover pointer-events-none select-none"
                onError={(e) => {
                  e.currentTarget.style.display = 'none';
                }}
                onContextMenu={(e) => e.preventDefault()}
                draggable={false}
              />
            </div>
          )}

          {/* Product Info */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge variant="secondary">{product.category}</Badge>
              <div className="flex items-center space-x-1 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Seller: {sellerUsername}</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-2xl font-bold text-primary">
                €{product.price.toFixed(2)}
              </div>
              {btcPrice && btcAmount && (
                <div className="flex items-center text-lg text-orange-500">
                  <Bitcoin className="h-5 w-5 mr-2" />
                  <span>₿{btcAmount.toFixed(8)}</span>
                </div>
              )}
              {ltcPrice && ltcAmount && (
                <div className="flex items-center text-lg text-blue-500">
                  <Coins className="h-5 w-5 mr-2" />
                  <span>Ł{ltcAmount.toFixed(8)}</span>
                </div>
              )}
            </div>

            <div>
              <h3 className="text-lg font-semibold mb-2">Description</h3>
              <p className="text-muted-foreground">
                {product.description || 'No description available.'}
              </p>
            </div>

            <Separator />

            {/* Action Buttons */}
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                onClick={() => onOpenChange(false)}
                className="flex-1"
              >
                Back
              </Button>
              <Button 
                className="flex-1"
                onClick={() => {
                  // Prevent purchasing own product if logged in
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
                    category: product.category,
                    image_url: product.image_url
                  });
                  
                  toast({
                    title: "Added to Cart",
                    description: `${product.title} has been added to your cart.`
                  });
                  
                  onOpenChange(false);
                }}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Buy Now
              </Button>
            </div>

            {/* Product Meta */}
            <div className="text-xs text-muted-foreground">
              Added on: {new Date(product.created_at).toLocaleDateString('en-US')}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProductModal;