import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Helper function to get current block height and calculate confirmations
async function getConfirmationCount(txBlockHeight: number): Promise<number> {
  try {
    const tipResponse = await fetch('https://mempool.space/api/blocks/tip/height')
    const currentHeight = await tipResponse.json()
    return Math.max(0, currentHeight - txBlockHeight + 1)
  } catch (error) {
    console.error('Error getting confirmation count:', error)
    return 0
  }
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
        Update: {
          balance_eur?: number
          balance_btc?: number
        }
      }
      transactions: {
        Row: {
          id: string
          user_id: string
          type: string
          amount_eur: number
          amount_btc: number
          btc_tx_hash: string | null
          btc_confirmations: number | null
          status: string
          description: string | null
          created_at: string
          confirmed_at: string | null
        }
        Insert: {
          user_id: string
          type: string
          amount_eur: number
          amount_btc: number
          btc_tx_hash?: string
          btc_confirmations?: number
          status?: string
          description?: string
          confirmed_at?: string
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

    console.log('Starting Bitcoin payment check with Mempool.space API...')

    // Get all active Bitcoin addresses
    const { data: addresses, error: addressError } = await supabaseClient
      .from('bitcoin_addresses')
      .select('*')
      .eq('is_active', true)

    if (addressError) {
      throw addressError
    }

    console.log(`Checking ${addresses?.length || 0} Bitcoin addresses`)

    // Get current BTC to EUR rate
    const btcResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=eur')
    const btcData = await btcResponse.json()
    const btcToEur = btcData.bitcoin.eur

    for (const addressRecord of addresses || []) {
      try {
        console.log(`Checking address: ${addressRecord.address}`)

        // Get address transactions from Mempool.space
        const txResponse = await fetch(
          `https://mempool.space/api/address/${addressRecord.address}/txs`
        )

        if (!txResponse.ok) {
          console.error(`Error fetching transactions for ${addressRecord.address}:`, txResponse.statusText)
          continue
        }

        const transactions = await txResponse.json()

        if (!transactions || transactions.length === 0) {
          continue
        }

        // Process each transaction
        for (const tx of transactions) {
          // Check if we already processed this transaction
          const { data: existingTx } = await supabaseClient
            .from('transactions')
            .select('id')
            .eq('btc_tx_hash', tx.hash)
            .eq('user_id', addressRecord.user_id)
            .single()

          if (existingTx) {
            continue // Already processed
          }

          // Calculate amount received to this address (Mempool.space format)
          let amountReceived = 0
          for (const vout of tx.vout || []) {
            if (vout.scriptpubkey_address === addressRecord.address) {
              amountReceived += vout.value
            }
          }

          if (amountReceived > 0) {
            const amountBtc = amountReceived / 100000000 // Convert satoshis to BTC
            const amountEur = amountBtc * btcToEur
            
            // Get confirmation count from Mempool.space
            const confirmations = tx.status?.confirmed ? tx.status.block_height ? 
              await getConfirmationCount(tx.status.block_height) : 0 : 0

            console.log(`Found payment: ${amountBtc} BTC (${amountEur} EUR) with ${confirmations} confirmations`)

            // Create transaction record
            const { error: txError } = await supabaseClient
              .from('transactions')
              .insert({
                user_id: addressRecord.user_id,
                type: 'deposit',
                amount_eur: amountEur,
                amount_btc: amountBtc,
                btc_tx_hash: tx.hash,
                btc_confirmations: confirmations,
                status: confirmations >= 1 ? 'completed' : 'pending',
                description: `Bitcoin deposit - ${tx.hash}`,
                confirmed_at: confirmations >= 1 ? new Date().toISOString() : null
              })

            if (txError) {
              console.error('Error creating transaction:', txError)
              continue
            }

            // Update wallet balance if confirmed
            if (confirmations >= 1) {
              console.log(`Updating wallet balance for user ${addressRecord.user_id}`)

              // Get current balance
              const { data: currentBalance } = await supabaseClient
                .from('wallet_balances')
                .select('balance_eur, balance_btc')
                .eq('user_id', addressRecord.user_id)
                .single()

              if (currentBalance) {
                const newBalanceEur = Number(currentBalance.balance_eur) + amountEur
                const newBalanceBtc = Number(currentBalance.balance_btc) + amountBtc

                const { error: balanceError } = await supabaseClient
                  .from('wallet_balances')
                  .update({
                    balance_eur: newBalanceEur,
                    balance_btc: newBalanceBtc
                  })
                  .eq('user_id', addressRecord.user_id)

                if (balanceError) {
                  console.error('Error updating wallet balance:', balanceError)
                }
              }
            }
          }
        }
      } catch (error) {
        console.error(`Error processing address ${addressRecord.address}:`, error)
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Payment check completed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error in check-bitcoin-payments:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})