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
    const { url, method = 'GET', headers: requestHeaders = {}, body } = await req.json()
    
    if (!url) {
      return new Response('URL is required', { 
        status: 400,
        headers: corsHeaders 
      })
    }

    console.log('Proxying request to:', url)

    // Remove potentially identifying headers
    const sanitizedHeaders = { ...requestHeaders }
    delete sanitizedHeaders['user-agent']
    delete sanitizedHeaders['x-forwarded-for']
    delete sanitizedHeaders['x-real-ip']
    delete sanitizedHeaders['cf-connecting-ip']
    
    // Add anonymized headers
    const proxyHeaders = {
      ...sanitizedHeaders,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; rv:91.0) Gecko/20100101 Firefox/91.0',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.5',
      'Accept-Encoding': 'gzip, deflate',
      'DNT': '1',
      'Connection': 'keep-alive'
    }

    const response = await fetch(url, {
      method: method.toUpperCase(),
      headers: proxyHeaders,
      body: method.toUpperCase() !== 'GET' && body ? JSON.stringify(body) : undefined
    })

    // Get response headers but filter out server-identifying ones
    const responseHeaders: Record<string, string> = {}
    response.headers.forEach((value, key) => {
      const lowerKey = key.toLowerCase()
      if (!['server', 'x-powered-by', 'via', 'x-cache'].includes(lowerKey)) {
        responseHeaders[key] = value
      }
    })

    const responseBody = await response.text()
    
    console.log('Proxy response status:', response.status)

    return new Response(responseBody, {
      status: response.status,
      headers: {
        ...corsHeaders,
        ...responseHeaders,
        'Content-Type': response.headers.get('content-type') || 'text/plain'
      }
    })

  } catch (error) {
    console.error('Proxy error:', error)
    return new Response('Proxy request failed', { 
      status: 500,
      headers: corsHeaders 
    })
  }
})