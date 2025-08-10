import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { History, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

interface Transaction {
  id: string;
  type: string;
  amount_eur: number;
  amount_btc: number;
  btc_tx_hash: string | null;
  btc_confirmations: number | null;
  status: string;
  description: string | null;
  created_at: string;
  confirmed_at: string | null;
}

export function TransactionHistory() {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTransactions = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) {
        throw error;
      }

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
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Transaction History
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Transaction History
        </CardTitle>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No transactions available yet
          </div>
        ) : (
          <div className="space-y-4">
            {transactions.map((transaction) => (
              <div 
                key={transaction.id} 
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {transaction.type === 'deposit' ? (
                      <ArrowDown className="h-5 w-5 text-green-500" />
                    ) : (
                      <ArrowUp className="h-5 w-5 text-red-500" />
                    )}
                  </div>
                  
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">
                        {transaction.type === 'deposit' ? 'Einzahlung' : 'Kauf'}
                      </span>
                      <Badge 
                        variant={transaction.status === 'completed' ? 'default' : 'secondary'}
                      >
                        {transaction.status === 'completed' ? 'Bestätigt' : 'Ausstehend'}
                      </Badge>
                    </div>
                    
                    {transaction.description && (
                      <p className="text-sm text-muted-foreground truncate">
                        {transaction.description}
                      </p>
                    )}
                    
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(transaction.created_at), 'dd.MM.yyyy HH:mm', { locale: de })}
                    </p>
                    
                    {transaction.btc_confirmations !== null && (
                      <p className="text-xs text-muted-foreground">
                        {transaction.btc_confirmations} Bestätigungen
                      </p>
                    )}
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="font-semibold">
                    {transaction.type === 'deposit' ? '+' : '-'}€{transaction.amount_eur.toFixed(2)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {transaction.type === 'deposit' ? '+' : '-'}{transaction.amount_btc.toFixed(8)} BTC
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}