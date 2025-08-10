import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Database {
  public: {
    Tables: {
      bitcoin_addresses: {
        Row: {
          id: string
          user_id: string
          address: string
          private_key_encrypted: string
          is_active: boolean
          created_at: string
        }
        Insert: {
          user_id: string
          address: string
          private_key_encrypted: string
          is_active?: boolean
        }
      }
      wallet_balances: {
        Row: {
          id: string
          user_id: string
          balance_eur: number
          balance_btc: number
          created_at: string
          updated_at: string
        }
        Insert: {
          user_id: string
          balance_eur?: number
          balance_btc?: number
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

    console.log('Generating Bitcoin address for user:', user.id)

    // Check if user already has an active Bitcoin address
    const { data: existingAddress } = await supabaseClient
      .from('bitcoin_addresses')
      .select('address')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .single()

    if (existingAddress) {
      console.log('User already has Bitcoin address:', existingAddress.address)
      return new Response(
        JSON.stringify({ address: existingAddress.address }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Generate new Bitcoin address using BlockCypher API
    const blockcypherToken = Deno.env.get('BLOCKCYPHER_TOKEN')
    if (!blockcypherToken) {
      throw new Error('BlockCypher token not configured')
    }

    const generateResponse = await fetch(
      `https://api.blockcypher.com/v1/btc/main/addrs?token=${blockcypherToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }
    )

    if (!generateResponse.ok) {
      throw new Error(`BlockCypher API error: ${generateResponse.statusText}`)
    }

    const addressData = await generateResponse.json()
    console.log('Generated Bitcoin address:', addressData.address)

    // Store the Bitcoin address (in production, encrypt the private key properly)
    const { error } = await supabaseClient
      .from('bitcoin_addresses')
      .insert({
        user_id: user.id,
        address: addressData.address,
        private_key_encrypted: addressData.private // In production, this should be properly encrypted
      })

    if (error) {
      console.error('Error storing Bitcoin address:', error)
      throw error
    }

    // Ensure wallet balance exists
    const { error: balanceError } = await supabaseClient
      .from('wallet_balances')
      .upsert({
        user_id: user.id,
        balance_eur: 0,
        balance_btc: 0
      })

    if (balanceError) {
      console.error('Error creating wallet balance:', balanceError)
    }

    return new Response(
      JSON.stringify({ address: addressData.address }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in generate-bitcoin-address:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})