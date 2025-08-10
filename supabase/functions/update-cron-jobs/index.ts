import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Update cron jobs for the new system
    const cronJobs = [
      {
        name: 'check-user-deposits-every-minute',
        schedule: '* * * * *', // every minute
        function_name: 'check-user-deposits'
      },
      {
        name: 'expire-deposit-requests-every-5-minutes',
        schedule: '*/5 * * * *', // every 5 minutes
        function_name: 'expire-deposit-requests'
      }
    ];

    for (const job of cronJobs) {
      const sql = `
        SELECT cron.schedule(
          '${job.name}',
          '${job.schedule}',
          $$
          SELECT
            net.http_post(
                url:='https://iqeubhhqdurqoaxnnyng.supabase.co/functions/v1/${job.function_name}',
                headers:='{"Content-Type": "application/json", "Authorization": "Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}"}'::jsonb,
                body:=concat('{"time": "', now(), '"}')::jsonb
            ) as request_id;
          $$
        );
      `;

      // Execute the SQL using the client
      const { error } = await supabase.rpc('exec_sql', { sql_query: sql });
      
      if (error) {
        console.error(`Error setting up cron job ${job.name}:`, error);
      } else {
        console.log(`Successfully set up cron job: ${job.name}`);
      }
    }

    console.log('Cron jobs setup completed');

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Cron jobs updated successfully'
      }), 
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (e) {
    console.error('Error in update-cron-jobs:', e);
    return new Response(
      JSON.stringify({ error: String(e) }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});