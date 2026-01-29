/**
 * Edge Function: Test IMAP Connection
 *
 * Testa a conexão IMAP usando a mesma lógica do process-emails.
 */

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.90.1';
import { decrypt, getEncryptionKey } from '../_shared/encryption.ts';
import { getCorsHeaders } from '../_shared/cors.ts';

/**
 * Classe simples de cliente IMAP usando Deno.connect
 */
class SimpleImapClient {
  private conn: Deno.TlsConn | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private tagCounter = 0;

  constructor(
    private host: string,
    private port: number,
    private user: string,
    private password: string
  ) {}

  private getTag(): string {
    return `A${++this.tagCounter}`;
  }

  private encode(text: string): Uint8Array {
    return new TextEncoder().encode(text);
  }

  private decode(data: Uint8Array): string {
    return new TextDecoder().decode(data);
  }

  async connect(): Promise<string> {
    this.conn = await Deno.connectTls({
      hostname: this.host,
      port: this.port,
    });

    this.reader = this.conn.readable.getReader();
    this.writer = this.conn.writable.getWriter();

    // Ler greeting
    const greeting = await this.readResponse();

    // Login
    const loginTag = this.getTag();
    await this.sendCommand(`${loginTag} LOGIN "${this.user}" "${this.password}"`);
    const loginResponse = await this.readUntilTag(loginTag);

    if (!loginResponse.includes('OK')) {
      throw new Error('Login failed: ' + loginResponse);
    }

    return greeting;
  }

  private async sendCommand(command: string): Promise<void> {
    if (!this.writer) throw new Error('Not connected');
    await this.writer.write(this.encode(command + '\r\n'));
  }

  private async readResponse(): Promise<string> {
    if (!this.reader) throw new Error('Not connected');

    const { value, done } = await this.reader.read();
    if (done || !value) return '';

    return this.decode(value);
  }

  private async readUntilTag(tag: string): Promise<string> {
    let response = '';
    const maxIterations = 100;
    let iterations = 0;

    while (iterations < maxIterations) {
      const chunk = await this.readResponse();
      response += chunk;

      if (response.includes(`${tag} OK`) || response.includes(`${tag} NO`) || response.includes(`${tag} BAD`)) {
        break;
      }
      iterations++;
    }

    return response;
  }

  async selectInbox(): Promise<{ exists: number; unseen: number }> {
    const tag = this.getTag();
    await this.sendCommand(`${tag} SELECT INBOX`);
    const response = await this.readUntilTag(tag);

    const existsMatch = response.match(/\* (\d+) EXISTS/);
    const exists = existsMatch ? parseInt(existsMatch[1], 10) : 0;

    // Buscar unseen
    const unseenTag = this.getTag();
    await this.sendCommand(`${unseenTag} SEARCH UNSEEN`);
    const searchResponse = await this.readUntilTag(unseenTag);

    const searchMatch = searchResponse.match(/\* SEARCH([\d\s]*)/);
    const unseenIds = searchMatch && searchMatch[1].trim()
      ? searchMatch[1].trim().split(/\s+/).filter(n => n)
      : [];

    return { exists, unseen: unseenIds.length };
  }

  async logout(): Promise<void> {
    try {
      const tag = this.getTag();
      await this.sendCommand(`${tag} LOGOUT`);
    } catch {
      // Ignorar erros de logout
    }
    try {
      this.conn?.close();
    } catch {
      // Ignorar erros de close
    }
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

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

    const { shop_name } = await req.json();

    if (!shop_name) {
      return new Response(
        JSON.stringify({ error: 'shop_name é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar loja
    const { data: shops, error: shopError } = await supabase
      .from('shops')
      .select('*')
      .ilike('name', `%${shop_name}%`)
      .eq('is_active', true);

    if (shopError || !shops || shops.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Loja não encontrada' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const shop = shops[0];

    // Descriptografar senha
    const encryptionKey = getEncryptionKey();
    let imapPassword = '';

    if (shop.imap_password_encrypted) {
      imapPassword = await decrypt(shop.imap_password_encrypted, encryptionKey);
    } else if (shop.imap_password) {
      imapPassword = shop.imap_password;
    }

    if (!imapPassword) {
      return new Response(
        JSON.stringify({ error: 'Senha IMAP não configurada' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result: Record<string, unknown> = {
      shop_name: shop.name,
      shop_id: shop.id,
      imap_host: shop.imap_host,
      imap_port: shop.imap_port,
      imap_user: shop.imap_user,
    };

    // Testar conexão
    const client = new SimpleImapClient(
      shop.imap_host,
      parseInt(shop.imap_port || '993'),
      shop.imap_user,
      imapPassword
    );

    try {
      console.log(`Conectando a ${shop.imap_host}...`);
      const greeting = await client.connect();
      result.greeting = greeting.substring(0, 100);

      console.log('Login OK, selecionando INBOX...');
      const inbox = await client.selectInbox();
      result.inbox_exists = inbox.exists;
      result.inbox_unseen = inbox.unseen;
      result.status = 'success';

      await client.logout();
    } catch (imapError) {
      result.status = 'error';
      result.error = imapError.message;
      console.error('Erro IMAP:', imapError);
    }

    return new Response(
      JSON.stringify(result, null, 2),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
