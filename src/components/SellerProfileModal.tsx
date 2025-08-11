import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { Star, User, Calendar, MessageCircle } from 'lucide-react';

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer_id: string;
}

interface SellerRating {
  total_reviews: number;
  average_rating: number;
}

interface SellerProfileModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  sellerId: string;
  sellerUsername: string;
}

const SellerProfileModal: React.FC<SellerProfileModalProps> = ({
  open,
  onOpenChange,
  sellerId,
  sellerUsername
}) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [sellerRating, setSellerRating] = useState<SellerRating | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (open && sellerId) {
      fetchSellerData();
    }
  }, [open, sellerId]);

  const fetchSellerData = async () => {
    setIsLoading(true);
    try {
      // Fetch seller rating summary
      const { data: ratingData, error: ratingError } = await supabase
        .from('seller_ratings')
        .select('total_reviews, average_rating')
        .eq('seller_id', sellerId)
        .single();

      if (ratingError && ratingError.code !== 'PGRST116') {
        console.error('Error fetching seller rating:', ratingError);
      } else {
        setSellerRating(ratingData || { total_reviews: 0, average_rating: 0 });
      }

      // Fetch recent reviews
      const { data: reviewsData, error: reviewsError } = await supabase
        .from('reviews')
        .select('id, rating, comment, created_at, reviewer_id')
        .eq('seller_id', sellerId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (reviewsError) {
        console.error('Error fetching reviews:', reviewsError);
      } else {
        setReviews(reviewsData || []);
      }
    } catch (error) {
      console.error('Error fetching seller data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? 'fill-yellow-400 text-yellow-400'
                : 'text-muted-foreground'
            }`}
          />
        ))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Seller Profile: @{sellerUsername}
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Rating Summary */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Rating Overview</CardTitle>
              </CardHeader>
              <CardContent>
                {sellerRating && sellerRating.total_reviews > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        {renderStars(Math.round(sellerRating.average_rating))}
                        <span className="text-2xl font-bold">
                          {sellerRating.average_rating.toFixed(1)}
                        </span>
                      </div>
                      <Badge variant="secondary">
                        {sellerRating.total_reviews} review{sellerRating.total_reviews !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </div>
                ) : (
                  <p className="text-muted-foreground">No ratings yet</p>
                )}
              </CardContent>
            </Card>

            {/* Reviews */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" />
                  Recent Reviews
                </CardTitle>
              </CardHeader>
              <CardContent>
                {reviews.length > 0 ? (
                  <div className="space-y-4">
                    {reviews.map((review) => (
                      <div key={review.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {renderStars(review.rating)}
                            <span className="text-sm text-muted-foreground">
                              {review.rating}/5
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {new Date(review.created_at).toLocaleDateString()}
                          </div>
                        </div>
                        {review.comment && (
                          <p className="text-sm text-muted-foreground italic">
                            "{review.comment}"
                          </p>
                        )}
                        <Separator />
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted-foreground">No reviews yet</p>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end">
              <Button onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SellerProfileModal;