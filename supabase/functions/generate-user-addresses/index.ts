import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Database {
  public: {
    Tables: {
      user_addresses: {
        Row: {
          id: string
          user_id: string
          currency: string
          address: string
          private_key_encrypted: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          currency: string
          address: string
          private_key_encrypted?: string | null
          is_active?: boolean
        }
        Update: {
          address?: string
          private_key_encrypted?: string | null
          is_active?: boolean
        }
      }
    }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient<Database>(
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

    console.log('Generating addresses for user:', user.id)

    // Check if user already has addresses
    const { data: existingAddresses } = await supabaseClient
      .from('user_addresses')
      .select('*')
      .eq('user_id', user.id)

    if (existingAddresses && existingAddresses.length >= 2) {
      console.log('User already has addresses')
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'User already has addresses',
          addresses: existingAddresses 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate Bitcoin address using BlockCypher API
    const blockcypherToken = Deno.env.get('BLOCKCYPHER_TOKEN')
    if (!blockcypherToken) {
      throw new Error('BlockCypher token not configured')
    }

    const addresses: any[] = []

    // Generate Bitcoin address
    const btcResponse = await fetch(
      `https://api.blockcypher.com/v1/btc/main/addrs?token=${blockcypherToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }
    )

    if (!btcResponse.ok) {
      throw new Error(`BlockCypher Bitcoin API error: ${btcResponse.statusText}`)
    }

    const btcData = await btcResponse.json()
    console.log('Generated Bitcoin address:', btcData.address)

    // Generate Litecoin address using BlockCypher API  
    const ltcResponse = await fetch(
      `https://api.blockcypher.com/v1/ltc/main/addrs?token=${blockcypherToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }
    )

    if (!ltcResponse.ok) {
      throw new Error(`BlockCypher Litecoin API error: ${ltcResponse.statusText}`)
    }

    const ltcData = await ltcResponse.json()
    console.log('Generated Litecoin address:', ltcData.address)

    // Update or insert Bitcoin address
    const { error: btcError } = await supabaseClient
      .from('user_addresses')
      .upsert({
        user_id: user.id,
        currency: 'BTC',
        address: btcData.address,
        private_key_encrypted: btcData.private // In production, this should be properly encrypted
      })

    if (btcError) {
      console.error('Error storing Bitcoin address:', btcError)
      throw btcError
    }

    // Update or insert Litecoin address
    const { error: ltcError } = await supabaseClient
      .from('user_addresses')
      .upsert({
        user_id: user.id,
        currency: 'LTC',
        address: ltcData.address,
        private_key_encrypted: ltcData.private // In production, this should be properly encrypted
      })

    if (ltcError) {
      console.error('Error storing Litecoin address:', ltcError)
      throw ltcError
    }

    addresses.push(
      { currency: 'BTC', address: btcData.address },
      { currency: 'LTC', address: ltcData.address }
    )

    return new Response(
      JSON.stringify({ 
        success: true,
        addresses: addresses
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in generate-user-addresses:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})