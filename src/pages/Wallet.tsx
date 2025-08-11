import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { WalletBalance } from "@/components/WalletBalance";
import { DepositRequest } from "@/components/DepositRequest";
import { TransactionHistory } from "@/components/TransactionHistory";
import WithdrawalModal from "@/components/WithdrawalModal";
import WithdrawalHistory from "@/components/WithdrawalHistory";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download } from "lucide-react";

export default function Wallet() {
  const navigate = useNavigate();
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      <div className="text-center">
        <div className="flex items-center justify-center gap-4 mb-4">
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={() => navigate('/marketplace')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>
        <h1 className="text-3xl font-bold">Wallet</h1>
        <p className="text-muted-foreground mt-2">
          Manage your balance, deposit and withdraw cryptocurrency
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <WalletBalance key={refreshKey} />
          <DepositRequest />
          <div className="flex gap-3">
            <Button 
              onClick={() => setWithdrawalModalOpen(true)}
              className="flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              Withdraw Crypto
            </Button>
          </div>
        </div>
        
        <div className="space-y-6">
          <TransactionHistory />
          <WithdrawalHistory key={refreshKey} />
        </div>
      </div>

      <WithdrawalModal
        open={withdrawalModalOpen}
        onOpenChange={setWithdrawalModalOpen}
        onWithdrawalSuccess={() => setRefreshKey(prev => prev + 1)}
      />
    </div>
  );
}