import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { currency } = await req.json();
    
    let address: string;
    if (currency === 'btc') {
      address = Deno.env.get('SHARED_BTC_ADDRESS') || '';
    } else if (currency === 'ltc') {
      address = Deno.env.get('SHARED_LTC_ADDRESS') || '';
    } else {
      throw new Error('Invalid currency');
    }

    if (!address) {
      throw new Error(`No shared address configured for ${currency}`);
    }

    return new Response(
      JSON.stringify({ address }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error getting shared address:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});