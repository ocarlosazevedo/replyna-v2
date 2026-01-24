/**
 * Edge Function: Process Pending Migrations
 *
 * Processa emails de clientes pendentes:
 * 1. Cria conta no Auth (se não existir)
 * 2. Cria registro na tabela users (se não existir)
 * 3. Envia email de reset de senha
 *
 * Compatível com Deno v2.x
 */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Emails para processar (apenas os que falharam anteriormente)
    const emailsToProcess = [
      'zarcorafrance@gmail.com',
      'onlinesttore2023@gmail.com',
    ];

    const results: Array<{
      email: string;
      status: string;
      message: string;
    }> = [];

    for (const email of emailsToProcess) {
      console.log(`\n=== Processando: ${email} ===`);

      try {
        // 1. Buscar dados do convite de migração (apenas pendentes)
        const { data: invites, error: inviteError } = await supabase
          .from('migration_invites')
          .select('*, plans:plan_id(*)')
          .eq('customer_email', email)
          .eq('status', 'pending')
          .order('created_at', { ascending: false })
          .limit(1);

        const invite = invites?.[0];

        if (inviteError || !invite) {
          console.log(`Convite não encontrado para ${email}`);
          results.push({
            email,
            status: 'error',
            message: 'Convite de migração não encontrado',
          });
          continue;
        }

        console.log(`Convite encontrado: ${invite.code}, Status: ${invite.status}`);

        // 2. Verificar se usuário já existe no Auth
        const { data: authUsers } = await supabase.auth.admin.listUsers();
        const existingAuthUser = authUsers?.users.find(
          (u) => u.email?.toLowerCase() === email.toLowerCase()
        );

        let userId: string;

        if (existingAuthUser) {
          console.log(`Usuário já existe no Auth: ${existingAuthUser.id}`);
          userId = existingAuthUser.id;
        } else {
          // 3. Criar usuário no Auth
          const tempPassword = crypto.randomUUID().slice(0, 12) + 'Aa1!';
          const { data: newAuthUser, error: authError } = await supabase.auth.admin.createUser({
            email: email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: { name: invite.customer_name || '' },
          });

          if (authError) {
            console.error(`Erro ao criar usuário no Auth:`, authError);
            results.push({
              email,
              status: 'error',
              message: `Erro ao criar Auth: ${authError.message}`,
            });
            continue;
          }

          userId = newAuthUser.user.id;
          console.log(`Usuário criado no Auth: ${userId}`);
        }

        // 4. Verificar/criar registro na tabela users
        const { data: existingUser } = await supabase
          .from('users')
          .select('id')
          .eq('email', email.toLowerCase())
          .single();

        if (!existingUser) {
          // Buscar dados do plano
          const plan = invite.plans;
          const planName = plan?.name?.toLowerCase() || 'starter';
          const emailsLimit = plan?.emails_limit || 500;
          const shopsLimit = invite.shops_limit || 1;

          const { error: createError } = await supabase.from('users').insert({
            id: userId,
            email: email.toLowerCase(),
            name: invite.customer_name || null,
            plan: planName,
            emails_limit: emailsLimit,
            shops_limit: shopsLimit,
            emails_used: 0,
            status: 'active',
          });

          if (createError) {
            console.error(`Erro ao criar usuário na tabela users:`, createError);
            results.push({
              email,
              status: 'error',
              message: `Erro ao criar users: ${createError.message}`,
            });
            continue;
          }

          console.log(`Registro criado na tabela users`);
        } else {
          console.log(`Usuário já existe na tabela users`);
        }

        // 5. Atualizar convite como aceito
        if (invite.status !== 'accepted') {
          await supabase
            .from('migration_invites')
            .update({
              status: 'accepted',
              accepted_by_user_id: userId,
              accepted_at: new Date().toISOString(),
            })
            .eq('id', invite.id);

          console.log(`Convite marcado como aceito`);
        }

        // 6. Enviar email de reset de senha
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: 'https://app.replyna.me/reset-password',
        });

        if (resetError) {
          console.error(`Erro ao enviar email de reset:`, resetError);
          results.push({
            email,
            status: 'partial',
            message: `Conta criada, mas erro ao enviar email: ${resetError.message}`,
          });
          continue;
        }

        console.log(`Email de reset enviado com sucesso!`);
        results.push({
          email,
          status: 'success',
          message: 'Conta criada/verificada e email de reset enviado',
        });

      } catch (err) {
        console.error(`Erro ao processar ${email}:`, err);
        results.push({
          email,
          status: 'error',
          message: err instanceof Error ? err.message : 'Erro desconhecido',
        });
      }
    }

    // Resumo
    const summary = {
      total: emailsToProcess.length,
      success: results.filter((r) => r.status === 'success').length,
      partial: results.filter((r) => r.status === 'partial').length,
      errors: results.filter((r) => r.status === 'error').length,
      results,
    };

    console.log('\n=== RESUMO ===');
    console.log(JSON.stringify(summary, null, 2));

    return new Response(JSON.stringify(summary, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro geral:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Erro desconhecido' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
