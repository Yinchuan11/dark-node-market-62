import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Bitcoin, Coins, Euro, RefreshCw, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export function DepositRequest() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedCrypto, setSelectedCrypto] = useState<"bitcoin" | "litecoin">("bitcoin");
  const [eurAmount, setEurAmount] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [generatingAddresses, setGeneratingAddresses] = useState(false);
  const [userAddresses, setUserAddresses] = useState<{btc: string, ltc: string} | null>(null);
  const [existingRequest, setExistingRequest] = useState<{
    id: string;
    crypto_amount: number;
    requested_eur: number;
    qr_data: string;
    fingerprint: number;
    expires_at: string;
    address: string;
    currency: string;
  } | null>(null);
  const [btcPrice, setBtcPrice] = useState<number | null>(null);
  const [ltcPrice, setLtcPrice] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>("");

  // Check for existing pending request and user addresses
  useEffect(() => {
    if (user) {
      checkExistingRequest();
      getUserAddresses();
    }
  }, [user]);

  // Countdown timer for active deposit request
  useEffect(() => {
    if (!existingRequest) return;
    
    const updateCountdown = () => {
      const now = new Date().getTime();
      const expires = new Date(existingRequest.expires_at).getTime();
      const difference = expires - now;
      
      if (difference > 0) {
        const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);
        
        setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
      } else {
        setTimeLeft("Expired");
        setExistingRequest(null);
      }
    };
    
    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(timer);
  }, [existingRequest]);

  const checkExistingRequest = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('deposit_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .maybeSingle();

      if (error) throw error;
      
      if (data) {
        // Check if request is still valid (not expired)
        const now = new Date().getTime();
        const expires = new Date(data.expires_at).getTime();
        
        if (expires > now) {
          const currency = data.currency === 'BTC' ? 'bitcoin' : 'litecoin';
          const qrData = `${currency}:${data.address}?amount=${data.crypto_amount.toFixed(8)}`;
          
          setExistingRequest({
            ...data,
            qr_data: qrData
          });
          setSelectedCrypto(currency);
        }
      }
    } catch (error) {
      console.error('Error checking existing request:', error);
    }
  };

  const getUserAddresses = async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase
        .from('user_addresses')
        .select('currency, address')
        .eq('user_id', user.id)
        .eq('is_active', true);

      if (error) throw error;
      
      if (data && data.length >= 2) {
        const btcAddr = data.find(addr => addr.currency === 'BTC')?.address;
        const ltcAddr = data.find(addr => addr.currency === 'LTC')?.address;
        
        if (btcAddr && ltcAddr && btcAddr !== 'pending' && ltcAddr !== 'pending') {
          setUserAddresses({ btc: btcAddr, ltc: ltcAddr });
        } else {
          // Generate addresses if they are still pending
          await generateUserAddresses();
        }
      } else {
        // Generate addresses if they don't exist
        await generateUserAddresses();
      }
    } catch (error) {
      console.error('Error getting user addresses:', error);
    }
  };

  const generateUserAddresses = async () => {
    if (!user) return;
    
    setGeneratingAddresses(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-user-addresses');
      if (error) throw error;
      
      if (data && data.success) {
        // Refresh addresses
        setTimeout(() => getUserAddresses(), 1000);
        toast({
          title: "Addresses Generated",
          description: "Your Bitcoin and Litecoin addresses have been created.",
        });
      } else {
        throw new Error("Failed to generate addresses");
      }
    } catch (error) {
      console.error('Error generating addresses:', error);
      toast({
        title: "Error", 
        description: "Could not generate crypto addresses. Please refresh the page.",
        variant: "destructive",
      });
      
      // Retry after delay
      setTimeout(() => {
        setGeneratingAddresses(false);
        getUserAddresses();
      }, 2000);
    } finally {
      setTimeout(() => setGeneratingAddresses(false), 1000);
    }
  };

  const fetchPrices = async () => {
    try {
      // Use a more reliable endpoint with better CORS support
      const response = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,litecoin&vs_currencies=eur&precision=2');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      const btcPriceValue = data.bitcoin?.eur;
      const ltcPriceValue = data.litecoin?.eur;
      
      if (!btcPriceValue || !ltcPriceValue) {
        throw new Error('Invalid price data received');
      }
      
      setBtcPrice(btcPriceValue);
      setLtcPrice(ltcPriceValue);
      
      return { btcPrice: btcPriceValue, ltcPrice: ltcPriceValue };
    } catch (error) {
      console.error('Error fetching crypto prices:', error);
      // Use fallback prices to prevent blocking
      const fallbackBtc = 90000;
      const fallbackLtc = 100;
      setBtcPrice(fallbackBtc);
      setLtcPrice(fallbackLtc);
      return { btcPrice: fallbackBtc, ltcPrice: fallbackLtc };
    }
  };

  const createDepositRequest = async () => {
    if (!user) {
      toast({
        title: "Authentication Required",
        description: "Please log in to create a deposit request",
        variant: "destructive",
      });
      return;
    }

    if (!userAddresses) {
      toast({
        title: "Error",
        description: "User addresses not ready. Please wait or refresh the page.",
        variant: "destructive",
      });
      return;
    }

    if (!eurAmount || parseFloat(eurAmount) <= 0) {
      toast({
        title: "Error",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    // Check if there's already a pending request
    if (existingRequest) {
      toast({
        title: "Active Request Exists",
        description: "You already have a pending deposit request. Please complete or close it first.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    
    try {
      const prices = await fetchPrices();
      
      const amountEur = parseFloat(eurAmount);
      const price = selectedCrypto === "bitcoin" ? prices.btcPrice : prices.ltcPrice;
      
      if (!price || price <= 0) {
        throw new Error("Invalid crypto price received");
      }
      
      const amountCrypto = amountEur / price;
      
      // Use user's individual address
      const address = selectedCrypto === "bitcoin" ? userAddresses.btc : userAddresses.ltc;
      
      // Generate fingerprint (1-99 satoshis/litoshis)
      const fingerprint = Math.floor(Math.random() * 99) + 1;
      const finalAmount = amountCrypto + (fingerprint / 1e8);
      
      // Set expiry to 6 hours from now
      const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
      
      // Create deposit request in database
      const { data, error } = await supabase
        .from('deposit_requests')
        .insert({
          user_id: user.id,
          currency: selectedCrypto === "bitcoin" ? "BTC" : "LTC",
          address: address,
          requested_eur: amountEur,
          rate_locked: price,
          crypto_amount: finalAmount,
          fingerprint: fingerprint,
          status: 'pending',
          expires_at: expiresAt
        })
        .select()
        .single();

      if (error) throw error;

      // Create BIP21 URI with exact amount
      const currency = selectedCrypto === "bitcoin" ? "bitcoin" : "litecoin";
      const qrData = `${currency}:${address}?amount=${finalAmount.toFixed(8)}`;
      
      const newRequest = {
        id: data.id,
        crypto_amount: finalAmount,
        requested_eur: amountEur,
        qr_data: qrData,
        fingerprint: fingerprint,
        expires_at: expiresAt,
        address: address,
        currency: data.currency
      };

      setExistingRequest(newRequest);

      toast({
        title: "Deposit Request Created",
        description: `Send exactly ${finalAmount.toFixed(8)} ${selectedCrypto.toUpperCase()} to your address within 6 hours`,
      });
      
    } catch (error) {
      console.error('Error creating deposit request:', error);
      
      let errorMessage = "Could not create deposit request";
      
      if (error instanceof Error) {
        if (error.message.includes('auth')) {
          errorMessage = "Please log in to create a deposit request";
        } else if (error.message.includes('price')) {
          errorMessage = "Could not fetch current crypto prices. Please try again.";
        } else if (error.message.includes('duplicate key')) {
          errorMessage = "You already have a pending deposit request. Please complete or close it first.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const closeDepositRequest = async () => {
    if (!existingRequest) return;
    
    try {
      const { data, error } = await supabase.rpc('close_deposit_request', {
        request_id: existingRequest.id
      });

      if (error) throw error;

      if (data) {
        setExistingRequest(null);
        setEurAmount("");
        toast({
          title: "Request Closed",
          description: "Your deposit request has been closed.",
        });
      } else {
        throw new Error("Failed to close request");
      }
    } catch (error) {
      console.error('Error closing request:', error);
      toast({
        title: "Error",
        description: "Could not close deposit request",
        variant: "destructive",
      });
    }
  };

  const copyQRData = async () => {
    if (!existingRequest) return;
    
    await navigator.clipboard.writeText(existingRequest.qr_data);
    toast({
      title: "Copied",
      description: "Payment URI copied to clipboard",
    });
  };

  const copyAddress = async () => {
    if (!existingRequest) return;
    await navigator.clipboard.writeText(existingRequest.address);
    toast({
      title: "Copied",
      description: "Address copied to clipboard",
    });
  };

  const resetRequest = () => {
    setExistingRequest(null);
    setEurAmount("");
  };

  // Show existing request if it exists
  if (existingRequest) {
    const cryptoName = existingRequest.currency === 'BTC' ? 'bitcoin' : 'litecoin';
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {cryptoName === "bitcoin" ? (
                <Bitcoin className="h-5 w-5 text-orange-500" />
              ) : (
                <Coins className="h-5 w-5 text-blue-500" />
              )}
              Active Deposit Request
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={closeDepositRequest}
              className="text-red-600 hover:text-red-700"
            >
              <X className="h-4 w-4 mr-1" />
              Close
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="bg-muted p-4 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span>Amount (EUR):</span>
              <span className="font-bold">€{existingRequest.requested_eur.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>Amount ({existingRequest.currency}):</span>
              <span className="font-bold">{existingRequest.crypto_amount.toFixed(8)}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Expires at:</span>
              <span>{new Date(existingRequest.expires_at).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm font-medium">
              <span>Time remaining:</span>
              <span className={timeLeft === "Expired" ? "text-red-500" : "text-primary"}>{timeLeft}</span>
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Fingerprint:</span>
              <span>+{existingRequest.fingerprint} {cryptoName === "bitcoin" ? "sats" : "litoshis"}</span>
            </div>
          </div>

          <div className="text-center">
            <QRCodeSVG 
              value={existingRequest.qr_data}
              size={200}
              className="mx-auto border rounded-lg p-2"
            />
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">BIP21 Payment URI:</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-xs break-all">
                  {existingRequest.qr_data}
                </code>
                <Button variant="outline" size="sm" onClick={copyQRData}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Your {cryptoName === "bitcoin" ? "Bitcoin" : "Litecoin"} Address:
              </Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-muted rounded text-sm break-all">
                  {existingRequest.address}
                </code>
                <Button variant="outline" size="sm" onClick={copyAddress}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="bg-card border p-4 rounded-lg">
            <h4 className="font-medium mb-2">Important:</h4>
            <ul className="list-disc list-inside space-y-1 text-sm">
              <li>Send EXACTLY {existingRequest.crypto_amount.toFixed(8)} {existingRequest.currency}</li>
              <li>This is your personal {existingRequest.currency} address</li>
              <li>Payment will be credited after 1 confirmation</li>
              <li>Request expires at {new Date(existingRequest.expires_at).toLocaleString()}</li>
              <li>You can close this request anytime using the Close button</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show loading state while generating addresses
  if (generatingAddresses || !userAddresses) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Euro className="h-5 w-5 text-primary" />
            Setting Up Your Wallet
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <div className="flex flex-col items-center gap-4">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
            <p className="text-muted-foreground">
              {generatingAddresses ? "Generating your Bitcoin and Litecoin addresses..." : "Loading your addresses..."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Euro className="h-5 w-5 text-primary" />
          Create Deposit Request
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="amount">Amount (EUR)</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="1"
              placeholder="Enter amount in EUR"
              value={eurAmount}
              onChange={(e) => setEurAmount(e.target.value)}
              disabled={!user}
            />
            {!user && (
              <p className="text-sm text-muted-foreground">
                Please log in to create deposit requests
              </p>
            )}
          </div>

          <div className="space-y-4">
            <Label className="text-sm font-medium">Select Cryptocurrency:</Label>
            <RadioGroup 
              value={selectedCrypto} 
              onValueChange={(value) => setSelectedCrypto(value as "bitcoin" | "litecoin")}
              className="flex gap-6"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="bitcoin" id="bitcoin" />
                <Label htmlFor="bitcoin" className="flex items-center gap-2 cursor-pointer">
                  <Bitcoin className="h-4 w-4 text-orange-500" />
                  Bitcoin (BTC)
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="litecoin" id="litecoin" />
                <Label htmlFor="litecoin" className="flex items-center gap-2 cursor-pointer">
                  <Coins className="h-4 w-4 text-blue-500" />
                  Litecoin (LTC)
                </Label>
              </div>
            </RadioGroup>
          </div>

          {userAddresses && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <h4 className="font-medium text-sm">Your Addresses:</h4>
              <div className="text-xs space-y-1">
                <div><strong>BTC:</strong> {userAddresses.btc}</div>
                <div><strong>LTC:</strong> {userAddresses.ltc}</div>
              </div>
            </div>
          )}

          <Button 
            onClick={createDepositRequest} 
            disabled={loading || !user || !eurAmount || parseFloat(eurAmount) <= 0 || !!existingRequest}
            className="w-full"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                Creating Request...
              </>
            ) : existingRequest ? (
              'Complete Current Request First'
            ) : (
              'Create Deposit Request'
            )}
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-2">
          <p><strong>How it works:</strong></p>
          <ul className="list-disc list-inside space-y-1">
            <li>Enter the EUR amount you want to deposit</li>
            <li>Choose Bitcoin or Litecoin</li>
            <li>Send to your personal crypto address</li>
            <li>Only one active request allowed at a time</li>
            <li>Requests expire after 6 hours</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}