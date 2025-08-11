import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown, ArrowUp, Bitcoin, Coins } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { useCryptoPrices } from "@/hooks/useCryptoPrices";

interface Transaction {
  id: string;
  type: string;
  transaction_direction: string | null;
  amount_eur: number;
  amount_btc: number;
  status: string;
  description: string;
  created_at: string;
  btc_confirmations: number | null;
  from_username: string | null;
  to_username: string | null;
}

export function TransactionHistory() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const { btcPrice, ltcPrice } = useCryptoPrices();

  const fetchTransactions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransactions(data || []);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, [user]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Transactions</CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">
            No transactions available yet.
          </p>
        ) : (
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {transactions.map((transaction) => {
              const isIncoming = transaction.transaction_direction === 'incoming' || transaction.type === 'deposit';
              const isOutgoing = transaction.transaction_direction === 'outgoing' || transaction.type === 'purchase';
              
              // Determine crypto amount and symbol
              let cryptoAmount = transaction.amount_btc;
              let cryptoSymbol = 'BTC';
              let IconComponent = Bitcoin;
              let iconColor = 'text-orange-500';
              
              // If it's LTC transaction (check description or amount patterns)
              if (transaction.description?.toLowerCase().includes('ltc') || 
                  transaction.description?.toLowerCase().includes('litecoin')) {
                cryptoSymbol = 'LTC';
                IconComponent = Coins;
                iconColor = 'text-blue-500';
              }

              return (
                <div key={transaction.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                        isIncoming ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                      }`}>
                        {isIncoming ? (
                          <ArrowDown className="h-4 w-4" />
                        ) : (
                          <ArrowUp className="h-4 w-4" />
                        )}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium capitalize">
                            {transaction.type}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs ${
                            transaction.status === 'completed' 
                              ? 'bg-green-100 text-green-700' 
                              : transaction.status === 'pending'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-gray-100 text-gray-700'
                          }`}>
                            {transaction.status}
                          </span>
                        </div>
                        
                        <p className="text-sm text-muted-foreground">
                          {transaction.description}
                        </p>
                        
                        {/* Show sender/receiver if available */}
                        {transaction.from_username && isIncoming && (
                          <p className="text-xs text-muted-foreground">
                            From: @{transaction.from_username}
                          </p>
                        )}
                        {transaction.to_username && isOutgoing && (
                          <p className="text-xs text-muted-foreground">
                            To: @{transaction.to_username}
                          </p>
                        )}
                        
                        <div className="text-xs text-muted-foreground">
                          {format(new Date(transaction.created_at), 'MMM d, yyyy HH:mm')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right">
                      <div className={`text-lg font-bold ${
                        isIncoming ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {isIncoming ? '+' : '-'}€{transaction.amount_eur.toFixed(2)}
                      </div>
                      
                      {cryptoAmount > 0 && (
                        <div className={`flex items-center gap-1 text-sm ${iconColor} justify-end`}>
                          <IconComponent className="h-3 w-3" />
                          <span>
                            {isIncoming ? '+' : '-'}{cryptoAmount.toFixed(8)} {cryptoSymbol}
                          </span>
                        </div>
                      )}
                      
                      {transaction.btc_confirmations !== null && transaction.btc_confirmations >= 0 && (
                        <div className="text-xs text-muted-foreground">
                          {transaction.btc_confirmations} confirmations
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}