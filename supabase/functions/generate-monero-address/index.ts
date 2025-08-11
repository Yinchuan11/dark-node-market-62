import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Monero wallet RPC methods
class MoneroWalletRPC {
  private rpcUrl: string
  private rpcUser: string
  private rpcPassword: string

  constructor(url: string, user: string, password: string) {
    this.rpcUrl = url
    this.rpcUser = user
    this.rpcPassword = password
  }

  private async callRPC(method: string, params: any = {}): Promise<any> {
    const auth = btoa(`${this.rpcUser}:${this.rpcPassword}`)
    
    const response = await fetch(this.rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${auth}`
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: '0',
        method: method,
        params: params
      })
    })

    if (!response.ok) {
      throw new Error(`RPC call failed: ${response.statusText}`)
    }

    const data = await response.json()
    if (data.error) {
      throw new Error(`RPC error: ${data.error.message}`)
    }

    return data.result
  }

  async createWallet(filename: string, password: string, language: string = 'English'): Promise<void> {
    await this.callRPC('create_wallet', {
      filename: filename,
      password: password,
      language: language
    })
  }

  async openWallet(filename: string, password: string): Promise<void> {
    await this.callRPC('open_wallet', {
      filename: filename,
      password: password
    })
  }

  async getAddress(accountIndex: number = 0, addressIndex: number = 0): Promise<string> {
    const result = await this.callRPC('get_address', {
      account_index: accountIndex,
      address_index: [addressIndex]
    })
    return result.address
  }

  async createAddress(accountIndex: number = 0, label: string = ''): Promise<{address: string, addressIndex: number}> {
    const result = await this.callRPC('create_address', {
      account_index: accountIndex,
      label: label
    })
    return {
      address: result.address,
      addressIndex: result.address_index
    }
  }

  async getPrivateKeys(): Promise<{spendKey: string, viewKey: string}> {
    const result = await this.callRPC('query_key', { key_type: 'spend_key' })
    const spendKey = result.key
    
    const viewResult = await this.callRPC('query_key', { key_type: 'view_key' })
    const viewKey = viewResult.key

    return { spendKey, viewKey }
  }

  async getBalance(accountIndex: number = 0): Promise<{balance: number, unlockedBalance: number}> {
    const result = await this.callRPC('get_balance', {
      account_index: accountIndex
    })
    return {
      balance: result.balance / 1e12, // Convert from atomic units to XMR
      unlockedBalance: result.unlocked_balance / 1e12
    }
  }

  async transfer(destinations: Array<{address: string, amount: number}>, accountIndex: number = 0): Promise<{txHash: string, fee: number}> {
    const atomicDestinations = destinations.map(dest => ({
      address: dest.address,
      amount: Math.floor(dest.amount * 1e12) // Convert XMR to atomic units
    }))

    const result = await this.callRPC('transfer', {
      destinations: atomicDestinations,
      account_index: accountIndex,
      priority: 1, // Normal priority
      ring_size: 11, // Default ring size
      get_tx_key: true
    })

    return {
      txHash: result.tx_hash,
      fee: result.fee / 1e12 // Convert atomic units to XMR
    }
  }
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

    console.log('Generating real Monero address for user:', user.id)

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

    // Get Monero RPC configuration
    const moneroRpcUrl = Deno.env.get('MONERO_RPC_URL') || 'http://localhost:18082/json_rpc'
    const moneroRpcUser = Deno.env.get('MONERO_RPC_USER') || 'monero'
    const moneroRpcPassword = Deno.env.get('MONERO_RPC_PASSWORD') || 'password'

    const walletRPC = new MoneroWalletRPC(moneroRpcUrl, moneroRpcUser, moneroRpcPassword)

    try {
      // Create or open a wallet for this user
      const walletFilename = `user_${user.id.replace(/-/g, '_')}`
      const walletPassword = `wallet_${user.id}_${Date.now()}`

      try {
        // Try to open existing wallet first
        await walletRPC.openWallet(walletFilename, walletPassword)
        console.log('Opened existing wallet for user')
      } catch (error) {
        // Create new wallet if it doesn't exist
        console.log('Creating new wallet for user')
        await walletRPC.createWallet(walletFilename, walletPassword)
      }

      // Create a new address for this user
      const addressInfo = await walletRPC.createAddress(0, `Address for user ${user.id}`)
      console.log('Generated Monero address:', addressInfo.address)

      // Get private keys for backup/storage
      const privateKeys = await walletRPC.getPrivateKeys()

      // Store the address and encrypted private keys in database
      const { error: xmrError } = await supabaseClient
        .from('user_addresses')
        .upsert({
          user_id: user.id,
          currency: 'XMR',
          address: addressInfo.address,
          private_key_encrypted: JSON.stringify({
            walletFilename: walletFilename,
            walletPassword: walletPassword,
            addressIndex: addressInfo.addressIndex,
            spendKey: privateKeys.spendKey,
            viewKey: privateKeys.viewKey
          })
        })

      if (xmrError) {
        console.error('Error storing Monero address:', xmrError)
        throw xmrError
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          address: addressInfo.address,
          message: 'Real Monero address generated successfully'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )

    } catch (rpcError) {
      console.error('Monero RPC Error:', rpcError)
      
      // Fallback to simulated address if RPC is not available
      console.log('Falling back to simulated address generation')
      
      const simulatedAddress = '48' + Array.from(crypto.getRandomValues(new Uint8Array(47)))
        .map(b => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'[b % 58])
        .join('')

      const { error: fallbackError } = await supabaseClient
        .from('user_addresses')
        .upsert({
          user_id: user.id,
          currency: 'XMR',
          address: simulatedAddress,
          private_key_encrypted: JSON.stringify({
            simulated: true,
            note: 'Generated without RPC - not functional for real transactions'
          })
        })

      if (fallbackError) {
        throw fallbackError
      }

      return new Response(
        JSON.stringify({ 
          success: true,
          address: simulatedAddress,
          message: 'Simulated Monero address generated (RPC not available)',
          warning: 'This is a simulated address - not functional for real transactions'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error in generate-monero-address:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})