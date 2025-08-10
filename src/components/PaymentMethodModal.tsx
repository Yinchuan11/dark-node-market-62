import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Bitcoin, Coins } from "lucide-react";

interface PaymentMethodModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectPayment: (method: 'btc' | 'ltc') => void;
  totalAmountEur: number;
  currentBtcPrice: number;
  currentLtcPrice: number;
  walletBalance?: {
    balance_eur: number;
    balance_btc: number;
    balance_ltc: number;
  } | null;
}

export const PaymentMethodModal = ({
  open,
  onOpenChange,
  onSelectPayment,
  totalAmountEur,
  currentBtcPrice,
  currentLtcPrice,
  walletBalance
}: PaymentMethodModalProps) => {
  const btcAmount = currentBtcPrice > 0 ? (totalAmountEur / currentBtcPrice).toFixed(8) : '0';
  const ltcAmount = currentLtcPrice > 0 ? (totalAmountEur / currentLtcPrice).toFixed(8) : '0';
  
  const hasEnoughBtc = walletBalance ? walletBalance.balance_btc >= parseFloat(btcAmount) : false;
  const hasEnoughLtc = walletBalance ? walletBalance.balance_ltc >= parseFloat(ltcAmount) : false;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Choose Payment Method</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Total Amount: €{totalAmountEur.toFixed(2)}
          </p>
          
          <div className="space-y-3">
            <Button
              variant="outline"
              className="w-full h-auto p-4 flex items-center justify-between"
              onClick={() => onSelectPayment('btc')}
              disabled={!hasEnoughBtc}
            >
              <div className="flex items-center gap-3">
                <Bitcoin className="h-6 w-6 text-orange-500" />
                <div className="text-left">
                  <div className="font-medium">Bitcoin (BTC)</div>
                  <div className="text-sm text-muted-foreground">
                    {btcAmount} BTC
                    {!hasEnoughBtc && " (Insufficient Balance)"}
                  </div>
                </div>
              </div>
            </Button>
            
            <Button
              variant="outline"
              className="w-full h-auto p-4 flex items-center justify-between"
              onClick={() => onSelectPayment('ltc')}
              disabled={!hasEnoughLtc}
            >
              <div className="flex items-center gap-3">
                <Coins className="h-6 w-6 text-blue-500" />
                <div className="text-left">
                  <div className="font-medium">Litecoin (LTC)</div>
                  <div className="text-sm text-muted-foreground">
                    {ltcAmount} LTC
                    {!hasEnoughLtc && " (Insufficient Balance)"}
                  </div>
                </div>
              </div>
            </Button>
          </div>
          
          <Button 
            variant="ghost" 
            onClick={() => onOpenChange(false)}
            className="w-full"
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};