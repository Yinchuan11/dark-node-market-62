import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface CartItem {
  id: string;
  title: string;
  price: number;
  quantity: number;
  image_url: string | null;
  category: string;
}

interface Product {
  id: string;
  title: string;
  price: number;
  image_url: string | null;
  category: string;
}

interface CartContextType {
  cartItems: CartItem[];
  addToCart: (product: Product) => void;
  updateQuantity: (id: string, quantity: number) => void;
  removeItem: (id: string) => void;
  clearCart: () => void;
  getCartTotal: () => number;
  getCartItemCount: () => number;
  isLoading: boolean;
}

const CART_STORAGE_KEY = 'shopping-cart-items';

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Load cart from database and localStorage
  const loadCart = useCallback(async () => {
    if (user) {
      // User is logged in - load from database
      try {
        setIsLoading(true);
        const { data, error } = await supabase
          .from('cart_items')
          .select('*')
          .eq('user_id', user.id);

        if (error) throw error;

        const dbCartItems: CartItem[] = (data || []).map((item: any) => ({
          id: item.product_id,
          title: item.title,
          price: Number(item.price),
          quantity: item.quantity,
          image_url: item.image_url,
          category: item.category
        }));

        setCartItems(dbCartItems);
        
        // Sync to localStorage
        try {
          localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(dbCartItems));
        } catch (e) {
          console.error('Error syncing cart to localStorage:', e);
        }
      } catch (error) {
        console.error('Error loading cart from database:', error);
        // Fallback to localStorage
        loadFromLocalStorage();
      } finally {
        setIsLoading(false);
      }
    } else {
      // User not logged in - load from localStorage
      loadFromLocalStorage();
    }
  }, [user]);

  const loadFromLocalStorage = () => {
    try {
      const savedCart = localStorage.getItem(CART_STORAGE_KEY);
      if (savedCart) {
        const parsedCart = JSON.parse(savedCart);
        setCartItems(parsedCart);
      } else {
        setCartItems([]);
      }
    } catch (error) {
      console.error('Error loading cart from localStorage:', error);
    }
  };

  // Save cart to database and localStorage
  const saveCart = useCallback(async (items: CartItem[]) => {
    // Always save to localStorage
    try {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
    } catch (error) {
      console.error('Error saving cart to localStorage:', error);
    }

    // Save to database if user is logged in
    if (user) {
      try {
        // Clear existing cart items
        await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', user.id);

        // Insert new cart items
        if (items.length > 0) {
          const dbCartItems = items.map(item => ({
            user_id: user.id,
            product_id: item.id,
            title: item.title,
            price: item.price,
            quantity: item.quantity,
            image_url: item.image_url,
            category: item.category
          }));

          const { error } = await supabase
            .from('cart_items')
            .insert(dbCartItems);

          if (error) throw error;
        }
      } catch (error) {
        console.error('Error saving cart to database:', error);
      }
    }
  }, [user]);

  // Load cart when component mounts or user changes
  useEffect(() => {
    loadCart();
  }, [loadCart]);

  // Clean up cart items for deleted/deactivated products
  useEffect(() => {
    const cleanupCart = async () => {
      if (cartItems.length === 0) return;

      try {
        const productIds = cartItems.map(item => item.id);
        const { data: activeProducts, error } = await supabase
          .from('products')
          .select('id, is_active')
          .in('id', productIds)
          .eq('is_active', true);

        if (error) throw error;

        const activeProductIds = new Set((activeProducts || []).map(p => p.id));
        const cleanedCartItems = cartItems.filter(item => activeProductIds.has(item.id));

        if (cleanedCartItems.length !== cartItems.length) {
          setCartItems(cleanedCartItems);
        }
      } catch (error) {
        console.error('Error cleaning up cart:', error);
      }
    };

    cleanupCart();
  }, [cartItems]);

  // Save cart whenever cartItems changes
  useEffect(() => {
    // Persist even when logged out via localStorage; also sync to DB when logged in
    saveCart(cartItems);
  }, [cartItems, saveCart]);

  const addToCart = useCallback((product: Product) => {
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === product.id);
      
      if (existingItem) {
        return prevItems.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      } else {
        return [...prevItems, {
          id: product.id,
          title: product.title,
          price: product.price,
          quantity: 1,
          image_url: product.image_url,
          category: product.category
        }];
      }
    });
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setCartItems(prevItems => prevItems.filter(item => item.id !== id));
    } else {
      setCartItems(prevItems =>
        prevItems.map(item =>
          item.id === id ? { ...item, quantity } : item
        )
      );
    }
  }, []);

  const removeItem = useCallback((id: string) => {
    setCartItems(prevItems => prevItems.filter(item => item.id !== id));
  }, []);

  const clearCart = useCallback(() => {
    setCartItems([]);
  }, []);

  const getCartTotal = useCallback(() => {
    return cartItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [cartItems]);

  const getCartItemCount = useCallback(() => {
    return cartItems.reduce((total, item) => total + item.quantity, 0);
  }, [cartItems]);

  const value: CartContextType = {
    cartItems,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
    getCartTotal,
    getCartItemCount,
    isLoading,
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = (): CartContextType => {
  const ctx = useContext(CartContext);
  if (!ctx) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return ctx;
};