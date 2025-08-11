import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Package, Truck, CheckCircle } from 'lucide-react';

interface OrderStatusModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  currentStatus: string;
  onStatusUpdated: () => void;
}

const statusOptions = [
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { value: 'processing', label: 'Processing', icon: Package },
  { value: 'shipped', label: 'Shipped', icon: Truck },
  { value: 'delivered', label: 'Delivered', icon: CheckCircle },
];

const OrderStatusModal: React.FC<OrderStatusModalProps> = ({
  open,
  onOpenChange,
  orderId,
  currentStatus,
  onStatusUpdated
}) => {
  const { toast } = useToast();
  const [newStatus, setNewStatus] = useState<'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled'>(currentStatus as any);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [trackingUrl, setTrackingUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const { data, error } = await supabase.rpc('update_order_status', {
        order_uuid: orderId,
        new_status: newStatus,
        tracking_num: trackingNumber || null,
        tracking_link: trackingUrl || null
      });

      if (error) throw error;

      if (data) {
        toast({
          title: "Status Updated",
          description: "Order status has been successfully updated."
        });
        onStatusUpdated();
        onOpenChange(false);
      } else {
        throw new Error("You don't have permission to update this order");
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update order status",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Order Status</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="status">Order Status</Label>
            <Select value={newStatus} onValueChange={(value) => setNewStatus(value as any)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {(newStatus === 'shipped' || newStatus === 'delivered') && (
            <>
              <div>
                <Label htmlFor="tracking">Tracking Number (Optional)</Label>
                <Input
                  id="tracking"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter tracking number"
                />
              </div>

              <div>
                <Label htmlFor="trackingUrl">Tracking URL (Optional)</Label>
                <Input
                  id="trackingUrl"
                  value={trackingUrl}
                  onChange={(e) => setTrackingUrl(e.target.value)}
                  placeholder="https://tracking.carrier.com/..."
                />
              </div>
            </>
          )}

          <div className="flex space-x-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={isLoading}
            >
              {isLoading ? 'Updating...' : 'Update Status'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default OrderStatusModal;