import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Find expired deposit requests that are still pending
    const { data: expiredRequests, error: fetchError } = await supabase
      .from('deposit_requests')
      .select('id')
      .eq('status', 'pending')
      .lt('expires_at', new Date().toISOString());

    if (fetchError) {
      console.error('Error fetching expired requests:', fetchError);
      throw fetchError;
    }

    if (expiredRequests && expiredRequests.length > 0) {
      // Update expired requests to closed status
      const { error: updateError } = await supabase
        .from('deposit_requests')
        .update({ status: 'expired' })
        .in('id', expiredRequests.map(req => req.id));

      if (updateError) {
        console.error('Error updating expired requests:', updateError);
        throw updateError;
      }

      console.log(`Expired ${expiredRequests.length} deposit requests`);
    } else {
      console.log('No expired deposit requests found');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      expiredCount: expiredRequests?.length || 0 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Auto-expire error:', error);
    return new Response(JSON.stringify({ error: String(error) }), { 
      status: 400, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    });
  }
});