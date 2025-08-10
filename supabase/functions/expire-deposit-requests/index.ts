import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const now = new Date().toISOString();
    
    // Mark expired deposit requests
    const { data: expiredRequests, error: expireError } = await supabase
      .from('deposit_requests')
      .update({ status: 'expired' })
      .eq('status', 'pending')
      .lt('expires_at', now)
      .select('id, user_id');

    if (expireError) {
      console.error('Error expiring requests:', expireError);
      throw expireError;
    }

    console.log(`Expired ${expiredRequests?.length || 0} deposit requests`);

    return new Response(
      JSON.stringify({ 
        ok: true, 
        expired_count: expiredRequests?.length || 0 
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('Error in expire-deposit-requests:', e);
    return new Response(
      JSON.stringify({ error: String(e) }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});