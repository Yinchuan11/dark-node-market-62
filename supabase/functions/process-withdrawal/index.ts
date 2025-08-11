import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Database {
  public: {
    Tables: {
      withdrawal_requests: {
        Row: {
          id: string
          user_id: string
          amount_eur: number
          amount_crypto: number
          currency: string
          destination_address: string
          status: string
          tx_hash: string | null
          fee_eur: number
          created_at: string
          updated_at: string
          processed_at: string | null
          notes: string | null
        }
        Insert: {
          user_id: string
          amount_eur: number
          amount_crypto: number
          currency: string
          destination_address: string
          fee_eur: number
        }
      }
      wallet_balances: {
        Row: {
          id: string
          user_id: string
          balance_eur: number
          balance_btc: number
          balance_ltc: number
          created_at: string
          updated_at: string
        }
      }
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
      }
      withdrawal_fees: {
        Row: {
          id: string
          currency: string
          min_amount_eur: number
          base_fee_eur: number
          percentage_fee: number
          network_fee_crypto: number
          created_at: string
          updated_at: string
        }
      }
    }
  }
}

// Simple AES encryption for private keys (in production use proper HSM)
async function encryptPrivateKey(privateKey: string, userKey: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(privateKey)
  const key = encoder.encode(userKey.slice(0, 32).padEnd(32, '0'))
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['encrypt']
  )
  
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    data
  )
  
  const result = new Uint8Array(iv.length + encrypted.byteLength)
  result.set(iv)
  result.set(new Uint8Array(encrypted), iv.length)
  
  return btoa(String.fromCharCode(...result))
}

async function decryptPrivateKey(encryptedKey: string, userKey: string): Promise<string> {
  const decoder = new TextDecoder()
  const key = new TextEncoder().encode(userKey.slice(0, 32).padEnd(32, '0'))
  
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    key,
    { name: 'AES-GCM' },
    false,
    ['decrypt']
  )
  
  const data = Uint8Array.from(atob(encryptedKey), c => c.charCodeAt(0))
  const iv = data.slice(0, 12)
  const encrypted = data.slice(12)
  
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    cryptoKey,
    encrypted
  )
  
  return decoder.decode(decrypted)
}

async function validateBitcoinAddress(address: string): Promise<boolean> {
  // Basic Bitcoin address validation
  const btcRegex = /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$|^bc1[a-z0-9]{39,59}$/
  return btcRegex.test(address)
}

async function validateLitecoinAddress(address: string): Promise<boolean> {
  // Basic Litecoin address validation
  const ltcRegex = /^[LM3][a-km-zA-HJ-NP-Z1-9]{26,33}$|^ltc1[a-z0-9]{39,59}$/
  return ltcRegex.test(address)
}

async function sendBitcoinTransaction(
  privateKey: string, 
  fromAddress: string, 
  toAddress: string, 
  amountSatoshi: number
): Promise<string> {
  const blockcypherToken = Deno.env.get('BLOCKCYPHER_TOKEN')
  if (!blockcypherToken) {
    throw new Error('BlockCypher token not configured')
  }

  console.log(`Preparing BTC transaction: ${amountSatoshi} satoshi from ${fromAddress} to ${toAddress}`)

  // Create new transaction
  const txResponse = await fetch(
    `https://api.blockcypher.com/v1/btc/main/txs/new?token=${blockcypherToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: [{ addresses: [fromAddress] }],
        outputs: [{ addresses: [toAddress], value: amountSatoshi }]
      })
    }
  )

  if (!txResponse.ok) {
    throw new Error(`Failed to create BTC transaction: ${txResponse.statusText}`)
  }

  const txData = await txResponse.json()
  console.log('Created transaction:', txData.tx.hash)

  // Sign transaction
  const signedResponse = await fetch(
    `https://api.blockcypher.com/v1/btc/main/txs/send?token=${blockcypherToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx: txData,
        private_keys: [privateKey]
      })
    }
  )

  if (!signedResponse.ok) {
    throw new Error(`Failed to send BTC transaction: ${signedResponse.statusText}`)
  }

  const signedData = await signedResponse.json()
  console.log('Sent transaction:', signedData.tx.hash)
  
  return signedData.tx.hash
}

async function sendLitecoinTransaction(
  privateKey: string,
  fromAddress: string,
  toAddress: string,
  amountLitoshi: number
): Promise<string> {
  const blockcypherToken = Deno.env.get('BLOCKCYPHER_TOKEN')
  if (!blockcypherToken) {
    throw new Error('BlockCypher token not configured')
  }

  console.log(`Preparing LTC transaction: ${amountLitoshi} litoshi from ${fromAddress} to ${toAddress}`)

  // Create new transaction
  const txResponse = await fetch(
    `https://api.blockcypher.com/v1/ltc/main/txs/new?token=${blockcypherToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        inputs: [{ addresses: [fromAddress] }],
        outputs: [{ addresses: [toAddress], value: amountLitoshi }]
      })
    }
  )

  if (!txResponse.ok) {
    throw new Error(`Failed to create LTC transaction: ${txResponse.statusText}`)
  }

  const txData = await txResponse.json()
  console.log('Created LTC transaction:', txData.tx.hash)

  // Sign transaction
  const signedResponse = await fetch(
    `https://api.blockcypher.com/v1/ltc/main/txs/send?token=${blockcypherToken}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tx: txData,
        private_keys: [privateKey]
      })
    }
  )

  if (!signedResponse.ok) {
    throw new Error(`Failed to send LTC transaction: ${signedResponse.statusText}`)
  }

  const signedData = await signedResponse.json()
  console.log('Sent LTC transaction:', signedData.tx.hash)
  
  return signedData.tx.hash
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

    const { amount_eur, currency, destination_address } = await req.json()

    console.log(`Processing withdrawal: ${amount_eur} EUR in ${currency} to ${destination_address}`)

    // Validate inputs
    if (!amount_eur || !currency || !destination_address) {
      throw new Error('Missing required fields')
    }

    if (!['BTC', 'LTC'].includes(currency)) {
      throw new Error('Invalid currency')
    }

    // Validate destination address
    if (currency === 'BTC' && !(await validateBitcoinAddress(destination_address))) {
      throw new Error('Invalid Bitcoin address')
    }

    if (currency === 'LTC' && !(await validateLitecoinAddress(destination_address))) {
      throw new Error('Invalid Litecoin address')
    }

    // Get withdrawal fees
    const { data: feeData, error: feeError } = await supabaseClient
      .from('withdrawal_fees')
      .select('*')
      .eq('currency', currency)
      .single()

    if (feeError || !feeData) {
      throw new Error('Failed to get withdrawal fees')
    }

    // Check minimum amount
    if (amount_eur < feeData.min_amount_eur) {
      throw new Error(`Minimum withdrawal amount is ${feeData.min_amount_eur} EUR`)
    }

    // Calculate fees
    const percentageFee = amount_eur * feeData.percentage_fee
    const totalFee = feeData.base_fee_eur + percentageFee
    const netAmount = amount_eur - totalFee

    if (netAmount <= 0) {
      throw new Error('Amount too small after fees')
    }

    // Check withdrawal limits
    const { data: limitCheck, error: limitError } = await supabaseClient
      .rpc('check_withdrawal_limits', {
        user_uuid: user.id,
        amount_eur: amount_eur
      })

    if (limitError) {
      throw new Error('Failed to check withdrawal limits')
    }

    if (!limitCheck) {
      throw new Error('Withdrawal exceeds daily or monthly limits')
    }

    // Get current crypto prices
    const priceResponse = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,litecoin&vs_currencies=eur&precision=8')
    const priceData = await priceResponse.json()

    let cryptoPrice: number
    if (currency === 'BTC') {
      cryptoPrice = priceData.bitcoin.eur
    } else {
      cryptoPrice = priceData.litecoin.eur
    }

    const cryptoAmount = netAmount / cryptoPrice

    // Check user balance
    const { data: balanceData, error: balanceError } = await supabaseClient
      .from('wallet_balances')
      .select('*')
      .eq('user_id', user.id)
      .single()

    if (balanceError || !balanceData) {
      throw new Error('Failed to get wallet balance')
    }

    const currentBalance = currency === 'BTC' ? balanceData.balance_btc : balanceData.balance_ltc

    if (currentBalance < cryptoAmount) {
      throw new Error('Insufficient balance')
    }

    // Create withdrawal request
    const { data: withdrawalData, error: withdrawalError } = await supabaseClient
      .from('withdrawal_requests')
      .insert({
        user_id: user.id,
        amount_eur: amount_eur,
        amount_crypto: cryptoAmount,
        currency: currency,
        destination_address: destination_address,
        fee_eur: totalFee
      })
      .select()
      .single()

    if (withdrawalError || !withdrawalData) {
      throw new Error('Failed to create withdrawal request')
    }

    // Process the withdrawal in background
    EdgeRuntime.waitUntil((async () => {
      try {
        console.log(`Processing withdrawal ${withdrawalData.id}`)

        // Update status to processing
        await supabaseClient
          .from('withdrawal_requests')
          .update({ 
            status: 'processing',
            updated_at: new Date().toISOString()
          })
          .eq('id', withdrawalData.id)

        // Get user's wallet address and private key
        const { data: addressData, error: addressError } = await supabaseClient
          .from('user_addresses')
          .select('*')
          .eq('user_id', user.id)
          .eq('currency', currency)
          .eq('is_active', true)
          .single()

        if (addressError || !addressData || !addressData.private_key_encrypted) {
          throw new Error('No active wallet found for user')
        }

        // Decrypt private key (using user ID as encryption key for simplicity)
        const privateKey = await decryptPrivateKey(addressData.private_key_encrypted, user.id)

        let txHash: string
        if (currency === 'BTC') {
          const satoshiAmount = Math.floor(cryptoAmount * 100000000)
          txHash = await sendBitcoinTransaction(
            privateKey,
            addressData.address,
            destination_address,
            satoshiAmount
          )
        } else {
          const litoshiAmount = Math.floor(cryptoAmount * 100000000)
          txHash = await sendLitecoinTransaction(
            privateKey,
            addressData.address,
            destination_address,
            litoshiAmount
          )
        }

        // Update withdrawal as completed
        await supabaseClient
          .from('withdrawal_requests')
          .update({ 
            status: 'completed',
            tx_hash: txHash,
            processed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', withdrawalData.id)

        // Update user balance
        const balanceUpdate = currency === 'BTC' 
          ? { balance_btc: balanceData.balance_btc - cryptoAmount }
          : { balance_ltc: balanceData.balance_ltc - cryptoAmount }

        await supabaseClient
          .from('wallet_balances')
          .update(balanceUpdate)
          .eq('user_id', user.id)

        console.log(`Withdrawal ${withdrawalData.id} completed with tx: ${txHash}`)

      } catch (error) {
        console.error(`Withdrawal ${withdrawalData.id} failed:`, error)
        
        await supabaseClient
          .from('withdrawal_requests')
          .update({ 
            status: 'failed',
            notes: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', withdrawalData.id)
      }
    })())

    return new Response(
      JSON.stringify({ 
        success: true, 
        withdrawal_id: withdrawalData.id,
        estimated_crypto_amount: cryptoAmount,
        fee_eur: totalFee,
        net_amount_eur: netAmount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Error processing withdrawal:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})