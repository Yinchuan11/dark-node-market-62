import { useState, useEffect } from 'react';

interface CryptoPrices {
  btcPrice: number | null;
  ltcPrice: number | null;
  loading: boolean;
  error: string | null;
}

export const useCryptoPrices = (autoRefresh = true): CryptoPrices => {
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [ltcPrice, setLtcPrice] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPrices = async () => {
    try {
      setError(null);
      
      // Use a more reliable API with better CORS support
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,litecoin&vs_currencies=eur&precision=2');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.bitcoin?.eur && data.litecoin?.eur) {
        setBtcPrice(data.bitcoin.eur);
        setLtcPrice(data.litecoin.eur);
      } else {
        throw new Error('Invalid price data received');
      }
    } catch (err) {
      console.error('Error fetching crypto prices:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch prices');
      
      // Set fallback prices to prevent blocking UI
      setBtcPrice(90000); // Approximate fallback
      setLtcPrice(100);   // Approximate fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPrices();
    
    if (autoRefresh) {
      // Refresh prices every 2 minutes
      const interval = setInterval(fetchPrices, 120000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  return { btcPrice, ltcPrice, loading, error };
};