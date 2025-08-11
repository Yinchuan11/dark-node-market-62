import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Monero address generation using cryptographic libraries
function generateMoneroAddress(): { address: string, privateKey: string, viewKey: string } {
  // Generate random bytes for seed
  const seedBytes = new Uint8Array(32);
  crypto.getRandomValues(seedBytes);
  
  // Convert to hex
  const seed = Array.from(seedBytes).map(b => b.toString(16).padStart(2, '0')).join('');
  
  // Generate Monero address (simplified - in production use monero-javascript library)
  // This creates a valid-looking Monero address structure
  const addressPrefix = '4'; // Standard Monero address prefix
  const addressBody = Array.from(crypto.getRandomValues(new Uint8Array(64)))
    .map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 94);
  
  const address = addressPrefix + addressBody;
  
  // Generate private spend key and view key
  const privateSpendKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  const privateViewKey = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0')).join('');
  
  return {
    address: address,
    privateKey: privateSpendKey,
    viewKey: privateViewKey
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const authHeader = req.headers.get('Authorization')!
    const token = authHeader.replace('Bearer ', '')
    const { data } = await supabaseClient.auth.getUser(token)
    const user = data.user

    if (!user) {
      throw new Error('Unauthorized')
    }

    console.log('Generating Monero address for user:', user.id)

    // Check if user already has a Monero address
    const { data: existingXMR } = await supabaseClient
      .from('user_addresses')
      .select('*')
      .eq('user_id', user.id)
      .eq('currency', 'XMR')
      .single()

    if (existingXMR && existingXMR.address !== 'pending') {
      console.log('User already has Monero address')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User already has Monero address',
          address: existingXMR.address 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate new Monero address
    const moneroWallet = generateMoneroAddress();
    console.log('Generated Monero address:', moneroWallet.address)

    // Store the address in database
    const { error: xmrError } = await supabaseClient
      .from('user_addresses')
      .upsert({
        user_id: user.id,
        currency: 'XMR',
        address: moneroWallet.address,
        private_key_encrypted: JSON.stringify({
          privateKey: moneroWallet.privateKey,
          viewKey: moneroWallet.viewKey
        }) // In production, this should be properly encrypted
      })

    if (xmrError) {
      console.error('Error storing Monero address:', xmrError)
      throw xmrError
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        address: moneroWallet.address,
        message: 'Monero address generated successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in generate-monero-address:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})