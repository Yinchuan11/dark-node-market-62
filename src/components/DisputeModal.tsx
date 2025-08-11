import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { AlertTriangle, MessageSquare, Clock, CheckCircle } from "lucide-react";

interface DisputeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId?: string;
  orderDetails?: any;
}

interface Dispute {
  id: string;
  reason: string;
  status: string;
  priority: string;
  created_at: string;
  resolution?: string;
  dispute_messages: Array<{
    id: string;
    message: string;
    sender_id: string;
    is_admin: boolean;
    created_at: string;
  }>;
}

export function DisputeModal({ open, onOpenChange, orderId, orderDetails }: DisputeModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [reason, setReason] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const [existingDispute, setExistingDispute] = useState<Dispute | null>(null);

  useEffect(() => {
    if (open && orderId) {
      checkExistingDispute();
    }
  }, [open, orderId]);

  const checkExistingDispute = async () => {
    if (!orderId) return;

    try {
      const { data, error } = await supabase
        .from('disputes')
        .select(`
          *,
          dispute_messages (*)
        `)
        .eq('order_id', orderId)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking dispute:', error);
        return;
      }

      if (data) {
        setExistingDispute(data);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const createDispute = async () => {
    if (!orderId || !reason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for the dispute",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      // Get seller ID from order
      const { data: orderData } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            product_id,
            products (seller_id)
          )
        `)
        .eq('id', orderId)
        .single();

      if (!orderData) throw new Error('Order not found');

      const sellerId = orderData.order_items[0]?.products?.seller_id;
      if (!sellerId) throw new Error('Seller not found');

      const { error } = await supabase
        .from('disputes')
        .insert({
          order_id: orderId,
          plaintiff_id: user.user.id,
          defendant_id: sellerId,
          reason: reason.trim(),
          status: 'open',
          priority: 'medium'
        });

      if (error) throw error;

      toast({
        title: "Dispute Created",
        description: "Your dispute has been submitted and will be reviewed by our team.",
      });

      setReason("");
      await checkExistingDispute();
    } catch (error) {
      console.error('Error creating dispute:', error);
      toast({
        title: "Error",
        description: "Failed to create dispute. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!existingDispute || !newMessage.trim()) return;

    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('dispute_messages')
        .insert({
          dispute_id: existingDispute.id,
          sender_id: user.user.id,
          message: newMessage.trim(),
          is_admin: false
        });

      if (error) throw error;

      setNewMessage("");
      await checkExistingDispute();
    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'open':
        return <AlertTriangle className="h-4 w-4" />;
      case 'in_progress':
        return <Clock className="h-4 w-4" />;
      case 'resolved':
        return <CheckCircle className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'destructive';
      case 'in_progress':
        return 'default';
      case 'resolved':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            {existingDispute ? 'Dispute Details' : 'Create Dispute'}
          </DialogTitle>
        </DialogHeader>

        {existingDispute ? (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Dispute #{existingDispute.id.slice(0, 8)}</span>
                  <Badge variant={getStatusColor(existingDispute.status)} className="flex items-center gap-1">
                    {getStatusIcon(existingDispute.status)}
                    {existingDispute.status.toUpperCase()}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <p><strong>Reason:</strong> {existingDispute.reason}</p>
                  <p><strong>Priority:</strong> {existingDispute.priority}</p>
                  <p><strong>Created:</strong> {new Date(existingDispute.created_at).toLocaleDateString()}</p>
                  {existingDispute.resolution && (
                    <p><strong>Resolution:</strong> {existingDispute.resolution}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Messages */}
            <Card>
              <CardHeader>
                <CardTitle>Messages</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 max-h-96 overflow-y-auto">
                {existingDispute.dispute_messages?.map((message) => (
                  <div
                    key={message.id}
                    className={`p-3 rounded-lg ${
                      message.is_admin 
                        ? 'bg-blue-50 border-blue-200' 
                        : 'bg-gray-50 border-gray-200'
                    } border`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant={message.is_admin ? 'default' : 'outline'}>
                        {message.is_admin ? 'Admin' : 'User'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(message.created_at).toLocaleString()}
                      </span>
                    </div>
                    <p className="text-sm">{message.message}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Send new message */}
            {existingDispute.status !== 'closed' && existingDispute.status !== 'resolved' && (
              <div className="space-y-2">
                <Textarea
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                />
                <Button onClick={sendMessage} disabled={loading || !newMessage.trim()}>
                  Send Message
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-4">
                Create a dispute for order #{orderId?.slice(0, 8)} if you're experiencing issues with your purchase.
              </p>
              
              <div className="space-y-2">
                <label className="text-sm font-medium">Reason for Dispute</label>
                <Textarea
                  placeholder="Please describe the issue in detail..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={createDispute} disabled={loading || !reason.trim()}>
                {loading ? 'Creating...' : 'Create Dispute'}
              </Button>
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}