/**
 * Edge Function: Diagnostic Cron
 * Temporária - verifica status do pg_cron e migrations
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const results: any = {
      timestamp: new Date().toISOString(),
      checks: []
    };

    // 1. Verificar se tabela job_queue existe (migration 021)
    const { data: jobQueue, error: jqError } = await supabase
      .from('job_queue')
      .select('id')
      .limit(1);

    results.checks.push({
      name: 'job_queue_table',
      status: jqError ? 'ERROR' : 'OK',
      message: jqError ? `Tabela job_queue não existe: ${jqError.message}` : 'Tabela job_queue existe',
      error: jqError?.message
    });

    // 2. Tentar buscar função aggregate_queue_metrics (migration 021)
    try {
      const { error: funcError } = await supabase.rpc('aggregate_queue_metrics');
      results.checks.push({
        name: 'aggregate_queue_metrics_function',
        status: funcError?.message.includes('does not exist') ? 'ERROR' : 'OK',
        message: funcError?.message.includes('does not exist')
          ? 'Função aggregate_queue_metrics não existe'
          : 'Função aggregate_queue_metrics existe',
        error: funcError?.message
      });
    } catch (e) {
      results.checks.push({
        name: 'aggregate_queue_metrics_function',
        status: 'ERROR',
        message: 'Erro ao verificar função',
        error: e.message
      });
    }

    // 3. Verificar permissões no schema cron (se pg_cron está disponível)
    const { data: cronCheck, error: cronCheckError } = await supabase
      .from('information_schema.schemata')
      .select('schema_name')
      .eq('schema_name', 'cron')
      .single();

    results.checks.push({
      name: 'pg_cron_schema',
      status: cronCheckError ? 'ERROR' : 'OK',
      message: cronCheckError ? 'Schema cron não existe (pg_cron não instalado)' : 'Schema cron existe',
      error: cronCheckError?.message
    });

    // 4. Verificar schema net (pg_net)
    const { data: netCheck, error: netCheckError } = await supabase
      .from('information_schema.schemata')
      .select('schema_name')
      .eq('schema_name', 'net')
      .single();

    results.checks.push({
      name: 'pg_net_schema',
      status: netCheckError ? 'ERROR' : 'OK',
      message: netCheckError ? 'Schema net não existe (pg_net não instalado)' : 'Schema net existe',
      error: netCheckError?.message
    });

    // Resumo
    const errors = results.checks.filter((c: any) => c.status === 'ERROR');
    results.summary = {
      total_checks: results.checks.length,
      errors: errors.length,
      status: errors.length === 0 ? 'ALL_OK' : 'HAS_ERRORS'
    };

    if (errors.length > 0) {
      results.next_steps = [
        'Execute as migrations no Supabase Dashboard:',
        '1. Vá em Database > Migrations',
        '2. Execute migration 021 (job_queue_system.sql)',
        '3. Execute migration 022 (setup_queue_cron_jobs.sql)',
        '',
        'Ou habilite extensões em Database > Extensions:',
        '- pg_cron',
        '- pg_net'
      ];
    }

    return new Response(
      JSON.stringify(results, null, 2),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({
        error: error.message,
        stack: error.stack
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    );
  }
});
