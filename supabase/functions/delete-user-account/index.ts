import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      console.error('Missing authorization header')
      return new Response('Missing authorization header', { 
        status: 401,
        headers: corsHeaders 
      })
    }

    // Create admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get user from token
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (userError || !user) {
      console.error('Invalid user:', userError)
      return new Response('Invalid user', { 
        status: 401,
        headers: corsHeaders 
      })
    }

    console.log('Deleting account for user:', user.id)

    // First deactivate bitcoin addresses
    const { error: bitcoinError } = await supabaseAdmin
      .from('bitcoin_addresses')
      .update({ is_active: false })
      .eq('user_id', user.id)

    if (bitcoinError) {
      console.error('Error deactivating bitcoin addresses:', bitcoinError)
    }

    // Delete user profile
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('user_id', user.id)

    if (profileError) {
      console.error('Error deleting profile:', profileError)
      return new Response('Error deleting profile', { 
        status: 500,
        headers: corsHeaders 
      })
    }

    // Delete the auth user
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(user.id)

    if (authError) {
      console.error('Error deleting auth user:', authError)
      return new Response('Error deleting auth user', { 
        status: 500,
        headers: corsHeaders 
      })
    }

    console.log('Successfully deleted account for user:', user.id)

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('Error in delete-user-account function:', error)
    return new Response('Internal server error', { 
      status: 500,
      headers: corsHeaders 
    })
  }
})