-- Add order status enum and tracking fields
DO $$ BEGIN
    CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS order_status order_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS tracking_number TEXT,
ADD COLUMN IF NOT EXISTS tracking_url TEXT,
ADD COLUMN IF NOT EXISTS status_updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
ADD COLUMN IF NOT EXISTS status_updated_by UUID;

-- Update existing orders to use new status
UPDATE public.orders SET order_status = 'confirmed'::order_status WHERE status = 'confirmed';
UPDATE public.orders SET order_status = 'pending'::order_status WHERE status = 'pending';

-- Create reviews table for buyer reviews of sellers
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
    reviewer_id UUID NOT NULL, -- buyer
    seller_id UUID NOT NULL, -- seller being reviewed
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(order_id, reviewer_id, seller_id)
);

-- Enable RLS on reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- RLS policies for reviews
CREATE POLICY "Users can view all reviews" 
ON public.reviews 
FOR SELECT 
USING (true);

CREATE POLICY "Users can create reviews for their orders" 
ON public.reviews 
FOR INSERT 
WITH CHECK (
    auth.uid() = reviewer_id 
    AND EXISTS (
        SELECT 1 FROM public.orders o 
        WHERE o.id = order_id 
        AND o.user_id = auth.uid() 
        AND o.order_status = 'delivered'
    )
);

CREATE POLICY "Users can update their own reviews" 
ON public.reviews 
FOR UPDATE 
USING (auth.uid() = reviewer_id);

CREATE POLICY "Users can delete their own reviews" 
ON public.reviews 
FOR DELETE 
USING (auth.uid() = reviewer_id);

-- Create seller ratings summary table (computed ratings)
CREATE TABLE IF NOT EXISTS public.seller_ratings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    seller_id UUID NOT NULL UNIQUE,
    total_reviews INTEGER NOT NULL DEFAULT 0,
    average_rating NUMERIC(3,2) NOT NULL DEFAULT 0.00,
    total_rating_points INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on seller_ratings
ALTER TABLE public.seller_ratings ENABLE ROW LEVEL SECURITY;

-- RLS policies for seller_ratings
CREATE POLICY "Anyone can view seller ratings" 
ON public.seller_ratings 
FOR SELECT 
USING (true);

CREATE POLICY "System can manage seller ratings" 
ON public.seller_ratings 
FOR ALL 
USING (true);

-- Function to update seller ratings
CREATE OR REPLACE FUNCTION public.update_seller_ratings()
RETURNS TRIGGER AS $$
BEGIN
    -- Update seller ratings when review is inserted, updated, or deleted
    INSERT INTO public.seller_ratings (seller_id, total_reviews, average_rating, total_rating_points)
    SELECT 
        COALESCE(NEW.seller_id, OLD.seller_id) as seller_id,
        COUNT(*) as total_reviews,
        ROUND(AVG(rating), 2) as average_rating,
        SUM(rating) as total_rating_points
    FROM public.reviews 
    WHERE seller_id = COALESCE(NEW.seller_id, OLD.seller_id)
    GROUP BY seller_id
    ON CONFLICT (seller_id) 
    DO UPDATE SET 
        total_reviews = EXCLUDED.total_reviews,
        average_rating = EXCLUDED.average_rating,
        total_rating_points = EXCLUDED.total_rating_points,
        updated_at = now();
    
    -- If no reviews left, set to defaults
    IF NOT FOUND AND OLD.seller_id IS NOT NULL THEN
        INSERT INTO public.seller_ratings (seller_id, total_reviews, average_rating, total_rating_points)
        VALUES (OLD.seller_id, 0, 0.00, 0)
        ON CONFLICT (seller_id) 
        DO UPDATE SET 
            total_reviews = 0,
            average_rating = 0.00,
            total_rating_points = 0,
            updated_at = now();
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create triggers for seller ratings updates
DROP TRIGGER IF EXISTS update_seller_ratings_on_review_insert ON public.reviews;
CREATE TRIGGER update_seller_ratings_on_review_insert
    AFTER INSERT ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.update_seller_ratings();

DROP TRIGGER IF EXISTS update_seller_ratings_on_review_update ON public.reviews;
CREATE TRIGGER update_seller_ratings_on_review_update
    AFTER UPDATE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.update_seller_ratings();

DROP TRIGGER IF EXISTS update_seller_ratings_on_review_delete ON public.reviews;
CREATE TRIGGER update_seller_ratings_on_review_delete
    AFTER DELETE ON public.reviews
    FOR EACH ROW EXECUTE FUNCTION public.update_seller_ratings();

-- Function for sellers to update order status
CREATE OR REPLACE FUNCTION public.update_order_status(
    order_uuid UUID,
    new_status order_status,
    tracking_num TEXT DEFAULT NULL,
    tracking_link TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    order_seller_id UUID;
BEGIN
    -- Check if the user is the seller of any products in this order
    SELECT DISTINCT p.seller_id INTO order_seller_id
    FROM public.order_items oi
    JOIN public.products p ON p.id = oi.product_id
    WHERE oi.order_id = order_uuid
    AND p.seller_id = auth.uid()
    LIMIT 1;
    
    -- If user is not a seller of products in this order and not admin, deny
    IF order_seller_id IS NULL AND public.get_user_role(auth.uid()) != 'admin' THEN
        RETURN FALSE;
    END IF;
    
    -- Update the order status
    UPDATE public.orders
    SET 
        order_status = new_status,
        tracking_number = COALESCE(tracking_num, tracking_number),
        tracking_url = COALESCE(tracking_link, tracking_url),
        status_updated_at = now(),
        status_updated_by = auth.uid()
    WHERE id = order_uuid;
    
    RETURN TRUE;
END;
$$;

-- Create updated_at trigger for reviews
CREATE TRIGGER update_reviews_updated_at
    BEFORE UPDATE ON public.reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();