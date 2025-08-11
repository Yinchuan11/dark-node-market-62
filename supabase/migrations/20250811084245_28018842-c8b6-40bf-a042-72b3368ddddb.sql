-- Create news table and secure RLS policies
CREATE TABLE IF NOT EXISTS public.news (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id UUID NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.news ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
  -- Viewable by everyone
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'news' AND policyname = 'Anyone can view news'
  ) THEN
    CREATE POLICY "Anyone can view news"
    ON public.news
    FOR SELECT
    USING (true);
  END IF;

  -- Admins can manage news
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'news' AND policyname = 'Admins can manage news'
  ) THEN
    CREATE POLICY "Admins can manage news"
    ON public.news
    FOR ALL
    USING (get_user_role(auth.uid()) = 'admin'::user_role)
    WITH CHECK (get_user_role(auth.uid()) = 'admin'::user_role);
  END IF;
END$$;

-- Trigger to update updated_at
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_news_updated_at'
  ) THEN
    CREATE TRIGGER update_news_updated_at
    BEFORE UPDATE ON public.news
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- Secure function for sellers to fetch their orders with buyer and address details
CREATE OR REPLACE FUNCTION public.get_seller_orders(seller_uuid uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  total_amount_eur numeric,
  status text,
  created_at timestamptz,
  shipping_first_name text,
  shipping_last_name text,
  shipping_street text,
  shipping_house_number text,
  shipping_postal_code text,
  shipping_city text,
  shipping_country text,
  buyer_username text,
  items jsonb
) AS $$
BEGIN
  -- Ensure caller is the seller themselves or an admin
  IF seller_uuid <> auth.uid() AND public.get_user_role(auth.uid()) <> 'admin'::user_role THEN
    RAISE EXCEPTION 'Not authorized to view these orders';
  END IF;

  RETURN QUERY
  SELECT 
    o.id,
    o.user_id,
    o.total_amount_eur,
    o.status,
    o.created_at,
    o.shipping_first_name,
    o.shipping_last_name,
    o.shipping_street,
    o.shipping_house_number,
    o.shipping_postal_code,
    o.shipping_city,
    o.shipping_country,
    p.username AS buyer_username,
    (
      SELECT jsonb_agg(jsonb_build_object(
        'order_item_id', oi.id,
        'quantity', oi.quantity,
        'price_eur', oi.price_eur,
        'product_title', pr.title
      ))
      FROM public.order_items oi
      JOIN public.products pr ON pr.id = oi.product_id
      WHERE oi.order_id = o.id AND pr.seller_id = seller_uuid
    ) AS items
  FROM public.orders o
  JOIN public.profiles p ON p.user_id = o.user_id
  WHERE EXISTS (
    SELECT 1 FROM public.order_items oi
    JOIN public.products pr ON pr.id = oi.product_id
    WHERE oi.order_id = o.id AND pr.seller_id = seller_uuid
  )
  AND o.status = 'confirmed'
  ORDER BY o.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO public;