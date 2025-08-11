import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { QRCodeSVG } from "qrcode.react";
import { Copy, Bitcoin, Coins, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export function CryptoDeposit() {
  const { toast } = useToast();
  const [selectedCrypto, setSelectedCrypto] = useState<"bitcoin" | "litecoin" | "monero">("bitcoin");

  // NEUE ADRESSEN - DIESE SIND JETZT AKTUELL
  const addresses = {
    bitcoin: "bc1qdqmcl0rc5u62653y68wqxcadtespq68kzt4z2z",
    litecoin: "LiFeR5xaRCWPPpNsvb1XHLPytyQHAHKRex",
    monero: "89abcdefghijklmnopqrstuvwxyz123456789abcdefghijklmnopqrstuvwxyz12345"
  };

  const currentAddress = addresses[selectedCrypto];

  const copyAddress = async () => {
    await navigator.clipboard.writeText(currentAddress);
    toast({
      title: "Copied",
      description: `${selectedCrypto === "bitcoin" ? "Bitcoin" : selectedCrypto === "litecoin" ? "Litecoin" : "Monero"} address copied to clipboard`,
    });
    console.log('Current address copied:', currentAddress); // Debug log
  };

  console.log('CryptoDeposit loaded with addresses:', addresses); // Debug log

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {selectedCrypto === "bitcoin" ? (
            <Bitcoin className="h-5 w-5 text-orange-500" />
          ) : selectedCrypto === "litecoin" ? (
            <Coins className="h-5 w-5 text-gray-500" />
          ) : (
            <Shield className="h-5 w-5 text-purple-500" />
          )}
          Cryptocurrency Deposit
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <Label className="text-sm font-medium">Select Cryptocurrency:</Label>
          <RadioGroup 
            value={selectedCrypto} 
            onValueChange={(value) => {
              console.log('Crypto changed to:', value); // Debug log
              setSelectedCrypto(value as "bitcoin" | "litecoin" | "monero");
            }}
            className="flex gap-4 flex-wrap"
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
                <Coins className="h-4 w-4 text-gray-500" />
                Litecoin (LTC)
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="monero" id="monero" />
              <Label htmlFor="monero" className="flex items-center gap-2 cursor-pointer">
                <Shield className="h-4 w-4 text-purple-500" />
                Monero (XMR)
              </Label>
            </div>
          </RadioGroup>
        </div>

        <div className="text-center">
          <QRCodeSVG 
            value={currentAddress} 
            size={200}
            className="mx-auto border rounded-lg p-2"
          />
        </div>
        
        <div className="space-y-2">
          <label className="text-sm font-medium">
            Your {selectedCrypto === "bitcoin" ? "Bitcoin" : selectedCrypto === "litecoin" ? "Litecoin" : "Monero"} Address:
          </label>
          <div className="flex items-center gap-2">
            <code className="flex-1 p-2 bg-muted rounded text-sm break-all">
              {currentAddress}
            </code>
            <Button variant="outline" size="sm" onClick={copyAddress}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
        
        <div className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Important Notes:</strong>
          </p>
          <ul className="list-disc list-inside space-y-1">
            <li>Only send {selectedCrypto === "bitcoin" ? "Bitcoin (BTC)" : selectedCrypto === "litecoin" ? "Litecoin (LTC)" : "Monero (XMR)"} to this address</li>
            <li>Balance will be credited after {selectedCrypto === "monero" ? "10" : "1"} confirmation{selectedCrypto === "monero" ? "s" : ""}</li>
            <li>Conversion is done at current rate</li>
            <li>Click "Refresh" to check for new payments</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}