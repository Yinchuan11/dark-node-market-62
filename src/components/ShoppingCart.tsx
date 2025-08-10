import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart as ShoppingCartIcon, Trash2, Plus, Minus, Bitcoin, Coins } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useIsMobile } from '@/hooks/use-mobile';
import CheckoutModal from './CheckoutModal';
import { PaymentMethodModal } from './PaymentMethodModal';

interface CartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
  image_url: string | null;
  category: string;
}

interface ShoppingCartProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartItems: CartItem[];
  onUpdateQuantity: (id: string, quantity: number) => void;
  onRemoveItem: (id: string) => void;
  onClearCart: () => void;
}

interface WalletBalance {
  balance_eur: number;
  balance_btc: number;
  balance_ltc: number;
}

const ShoppingCart: React.FC<ShoppingCartProps> = ({ 
  open, 
  onOpenChange, 
  cartItems, 
  onUpdateQuantity, 
  onRemoveItem, 
  onClearCart 
}) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [ltcPrice, setLtcPrice] = useState<number | null>(null);
  const [walletBalance, setWalletBalance] = useState<WalletBalance | null>(null);
  const [paymentMethodOpen, setPaymentMethodOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'btc' | 'ltc' | null>(null);
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);

  useEffect(() => {
    if (open) {
      fetchBtcPrice();
      fetchLtcPrice();
      fetchWalletBalance();
    }
  }, [open, user]);

  const fetchBtcPrice = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur');
      const data = await response.json();
      setBtcPrice(data.bitcoin.eur);
    } catch (error) {
      console.error('Error fetching BTC price:', error);
    }
  };

  const fetchLtcPrice = async () => {
    try {
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=litecoin&vs_currencies=eur');
      const data = await response.json();
      setLtcPrice(data.litecoin.eur);
    } catch (error) {
      console.error('Error fetching LTC price:', error);
    }
  };

  const fetchWalletBalance = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('wallet_balances')
        .select('balance_eur, balance_btc, balance_ltc')
        .eq('user_id', user.id)
        .single();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      setWalletBalance(data || { balance_eur: 0, balance_btc: 0, balance_ltc: 0 });
    } catch (error) {
      console.error('Error fetching wallet balance:', error);
    }
  };

  const handleCheckout = async () => {
    if (!walletBalance) {
      toast({
        title: "Error",
        description: "Wallet balance could not be loaded",
        variant: "destructive",
      });
      return;
    }

    // Calculate crypto amounts needed
    const btcNeeded = btcPrice ? totalEUR / btcPrice : 0;
    const ltcNeeded = ltcPrice ? totalEUR / ltcPrice : 0;
    
    // Check if user has enough in either currency
    const hasBtc = walletBalance.balance_btc >= btcNeeded;
    const hasLtc = walletBalance.balance_ltc >= ltcNeeded;

    if (!hasBtc && !hasLtc) {
      toast({
        title: "Insufficient Balance",
        description: `You need either ${btcNeeded.toFixed(8)} BTC or ${ltcNeeded.toFixed(8)} LTC to complete this purchase.`,
        variant: "destructive",
      });
      return;
    }

    setPaymentMethodOpen(true);
  };

  const handleConfirmOrder = async (addressData: any) => {
    if (!user || !selectedPaymentMethod) return;

    setIsProcessingOrder(true);
    
    try {
      // Use the new process-order function
      const items = cartItems.map(item => ({
        id: item.id,
        quantity: item.quantity
      }));

      const { data, error } = await supabase.functions.invoke('update-process-order', {
        body: {
          userId: user.id,
          items,
          method: selectedPaymentMethod,
          btcPrice,
          ltcPrice,
          shippingAddress: addressData
        }
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      // Success
      toast({
        title: "Order Successful",
        description: "Your order has been successfully placed and sellers have been credited",
      });

      onClearCart();
      setCheckoutOpen(false);
      setPaymentMethodOpen(false);
      onOpenChange(false);
      
    } catch (error) {
      console.error('Error processing order:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Order could not be processed",
        variant: "destructive",
      });
    } finally {
      setIsProcessingOrder(false);
    }
  };

  const handleSelectPayment = (method: 'btc' | 'ltc') => {
    setSelectedPaymentMethod(method);
    setPaymentMethodOpen(false);
    setCheckoutOpen(true);
  };

  const totalEUR = cartItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const totalBTC = btcPrice ? totalEUR / btcPrice : null;
  const totalLTC = ltcPrice ? totalEUR / ltcPrice : null;

  const CartContent = () => (
    <div className="space-y-4">
      {cartItems.length === 0 ? (
        <div className="text-center py-8">
          <ShoppingCartIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">Ihr Warenkorb ist leer</p>
        </div>
      ) : (
        <>
          {/* Cart Items */}
          <div className={`space-y-3 ${isMobile ? 'max-h-80' : 'max-h-64'} overflow-y-auto`}>
            {cartItems.map((item) => (
              <Card key={item.id}>
                <CardContent className={`${isMobile ? 'p-2' : 'p-3'}`}>
                  <div className={`flex items-center ${isMobile ? 'space-x-2' : 'space-x-3'}`}>
                    {item.image_url && (
                      <img
                        src={item.image_url}
                        alt={item.title}
                        className={`object-cover rounded ${isMobile ? 'w-12 h-12' : 'w-16 h-16'}`}
                        onError={(e) => {
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    )}
                    
                    <div className="flex-1 min-w-0">
                      <h4 className={`font-medium truncate ${isMobile ? 'text-sm' : ''}`}>{item.title}</h4>
                      <Badge variant="secondary" className="text-xs">{item.category}</Badge>
                      <p className="text-sm font-semibold text-primary">€{item.price.toFixed(2)}</p>
                    </div>
                    
                    {isMobile ? (
                      <div className="flex flex-col items-center space-y-1">
                        <div className="flex items-center space-x-1">
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))}
                          >
                            <Minus className="h-2 w-2" />
                          </Button>
                          
                          <span className="w-6 text-center text-xs">{item.quantity}</span>
                          
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                          >
                            <Plus className="h-2 w-2" />
                          </Button>
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-destructive"
                          onClick={() => onRemoveItem(item.id)}
                        >
                          <Trash2 className="h-2 w-2" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onUpdateQuantity(item.id, Math.max(0, item.quantity - 1))}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        
                        <span className="w-8 text-center text-sm">{item.quantity}</span>
                        
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => onUpdateQuantity(item.id, item.quantity + 1)}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive"
                          onClick={() => onRemoveItem(item.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Separator />

          {/* Total */}
          <div className="space-y-3">
            <div className="flex justify-between items-center text-lg font-semibold">
              <span>Gesamt:</span>
              <div className="text-right">
                <div className="text-primary">€{totalEUR.toFixed(2)}</div>
                {totalBTC && (
                  <div className="text-sm text-orange-500 flex items-center justify-end">
                    <Bitcoin className="h-3 w-3 mr-1" />
                    ₿{totalBTC.toFixed(8)}
                  </div>
                )}
                {totalLTC && (
                  <div className="text-sm text-blue-500 flex items-center justify-end">
                    <Coins className="h-3 w-3 mr-1" />
                    Ł{totalLTC.toFixed(8)}
                  </div>
                )}
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className={`flex ${isMobile ? 'flex-col space-y-2' : 'space-x-2'}`}>
            <Button 
              variant="outline" 
              onClick={onClearCart}
              className="flex-1"
            >
              Warenkorb leeren
            </Button>
            <Button className="flex-1" onClick={handleCheckout}>
              Zur Kasse
            </Button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {isMobile ? (
        <Drawer open={open} onOpenChange={onOpenChange}>
          <DrawerContent className="max-h-[90vh]">
            <DrawerHeader className="pb-4">
              <DrawerTitle className="flex items-center space-x-2">
                <ShoppingCartIcon className="h-5 w-5" />
                <span>Warenkorb ({cartItems.length} Artikel)</span>
              </DrawerTitle>
            </DrawerHeader>
            
            <div className="px-4 pb-4">
              <CartContent />
            </div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={onOpenChange}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <ShoppingCartIcon className="h-5 w-5" />
                <span>Warenkorb ({cartItems.length} Artikel)</span>
              </DialogTitle>
            </DialogHeader>
            
            <CartContent />
          </DialogContent>
        </Dialog>
      )}
      
      <PaymentMethodModal
        open={paymentMethodOpen}
        onOpenChange={setPaymentMethodOpen}
        onSelectPayment={handleSelectPayment}
        totalAmountEur={totalEUR}
        currentBtcPrice={btcPrice || 0}
        currentLtcPrice={ltcPrice || 0}
        walletBalance={walletBalance}
      />
      
      <CheckoutModal
        open={checkoutOpen}
        onOpenChange={setCheckoutOpen}
        totalAmount={totalEUR}
        onConfirmOrder={handleConfirmOrder}
        loading={isProcessingOrder}
      />
    </>
  );
};

export default ShoppingCart;