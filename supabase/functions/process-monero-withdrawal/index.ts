import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface WithdrawalRequest {
  amount_eur: number;
  currency: string;
  destination_address: string;
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

    const body: WithdrawalRequest = await req.json()
    const { amount_eur, currency, destination_address } = body

    if (currency !== 'XMR') {
      throw new Error('This function only handles Monero withdrawals')
    }

    console.log(`Processing Monero withdrawal for user ${user.id}: ${amount_eur} EUR to ${destination_address}`)

    // Get withdrawal fees
    const { data: feeData } = await supabaseClient
      .from('withdrawal_fees')
      .select('*')
      .eq('currency', 'XMR')
      .single()

    if (!feeData) {
      throw new Error('Withdrawal fees not configured for Monero')
    }

    // Calculate fees
    const percentageFee = amount_eur * feeData.percentage_fee
    const totalFeeEur = feeData.base_fee_eur + percentageFee
    const netAmountEur = amount_eur - totalFeeEur

    if (netAmountEur <= 0) {
      throw new Error('Amount too small after fees')
    }

    // Get current Monero price
    const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=monero&vs_currencies=eur')
    const priceData = await priceResponse.json()
    const xmrPrice = priceData.monero?.eur

    if (!xmrPrice) {
      throw new Error('Could not fetch Monero price')
    }

    const cryptoAmount = netAmountEur / xmrPrice

    // Check user balance
    const { data: balance } = await supabaseClient
      .from('wallet_balances')
      .select('balance_xmr')
      .eq('user_id', user.id)
      .single()

    if (!balance || balance.balance_xmr < cryptoAmount) {
      throw new Error('Insufficient Monero balance')
    }

    // Create withdrawal request
    const { data: withdrawalData, error: withdrawalError } = await supabaseClient
      .from('withdrawal_requests')
      .insert({
        user_id: user.id,
        amount_eur: amount_eur,
        currency: 'XMR',
        destination_address: destination_address,
        fee_eur: totalFeeEur,
        amount_crypto: cryptoAmount,
        status: 'pending'
      })
      .select()
      .single()

    if (withdrawalError) {
      throw withdrawalError
    }

    // Update user balance (deduct the amount)
    const { error: balanceError } = await supabaseClient
      .from('wallet_balances')
      .update({
        balance_xmr: balance.balance_xmr - cryptoAmount
      })
      .eq('user_id', user.id)

    if (balanceError) {
      throw balanceError
    }

    // In a real implementation, you would:
    // 1. Get user's Monero private keys from database
    // 2. Create and sign a Monero transaction
    // 3. Broadcast it to the Monero network
    // 4. Update withdrawal status when confirmed

    // For now, we'll simulate the process
    console.log(`Monero withdrawal processed: ${cryptoAmount.toFixed(8)} XMR to ${destination_address}`)

    // Update withdrawal status to processing
    await supabaseClient
      .from('withdrawal_requests')
      .update({ 
        status: 'processing',
        notes: 'Monero transaction being prepared'
      })
      .eq('id', withdrawalData.id)

    return new Response(
      JSON.stringify({
        success: true,
        withdrawal_id: withdrawalData.id,
        amount_eur: amount_eur,
        fee_eur: totalFeeEur,
        net_amount_eur: netAmountEur,
        estimated_crypto_amount: cryptoAmount,
        currency: 'XMR',
        status: 'processing'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in process-monero-withdrawal:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})