import fs from 'fs/promises';
import { createClient } from '@supabase/supabase-js';

const START_DATE = '2026-03-01';
const END_DATE = '2026-03-31';

const envText = await fs.readFile('.env', 'utf8');
const envLines = envText.split(/\r?\n/);
const asaasKeyLine = envLines.find((l) => l.startsWith('ASAAS_API_KEY='));
if (!asaasKeyLine) throw new Error('ASAAS_API_KEY não encontrado no .env');
const ASAAS_API_KEY = asaasKeyLine.replace('ASAAS_API_KEY=', '').trim();

const baseLine = envLines.find((l) => l.startsWith('ASAAS_BASE_URL='));
const ASAAS_BASE_URL = baseLine ? baseLine.replace('ASAAS_BASE_URL=', '').trim() : 'https://api.asaas.com/v3';

const checkOrphansText = await fs.readFile('check-orphans.mjs', 'utf8');
const match = checkOrphansText.match(/createClient\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/);
if (!match) throw new Error('Não foi possível extrair SUPABASE_URL e service role do check-orphans.mjs');
const SUPABASE_URL = match[1];
const SUPABASE_SERVICE_ROLE_KEY = match[2];

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const buildQuery = (params) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
};

async function asaasRequest(path, params = {}) {
  const url = `${ASAAS_BASE_URL}${path}${buildQuery(params)}`;
  const res = await fetch(url, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    },
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`Asaas error ${res.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function fetchAll(path, params) {
  const limit = 100;
  let offset = 0;
  let all = [];
  let totalCount = null;
  do {
    const page = await asaasRequest(path, { ...params, limit, offset });
    if (totalCount === null) totalCount = page.totalCount ?? page.data?.length ?? 0;
    all = all.concat(page.data || []);
    offset += limit;
  } while (totalCount !== null && offset < totalCount);
  return all;
}

async function fetchAllUsersCustomerIds() {
  const ids = new Set();
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from('users')
      .select('asaas_customer_id')
      .not('asaas_customer_id', 'is', null)
      .range(from, from + pageSize - 1);
    if (error) throw error;
    (data || []).forEach((row) => { if (row.asaas_customer_id) ids.add(row.asaas_customer_id); });
    if (!data || data.length < pageSize) break;
    from += pageSize;
  }
  return ids;
}

async function fetchCustomerName(customerId) {
  try {
    const data = await asaasRequest(`/customers/${customerId}`);
    return data?.name || null;
  } catch {
    return null;
  }
}

console.log('Buscando payments CONFIRMED e RECEIVED com vencimento em março/2026...');
const [confirmed, received] = await Promise.all([
  fetchAll('/payments', { status: 'CONFIRMED', 'dueDate[ge]': START_DATE, 'dueDate[le]': END_DATE }),
  fetchAll('/payments', { status: 'RECEIVED', 'dueDate[ge]': START_DATE, 'dueDate[le]': END_DATE }),
]);
const payments = [...confirmed, ...received];
console.log(`Total payments encontrados: ${payments.length}`);

console.log('Buscando customer IDs do Supabase...');
const customerIds = await fetchAllUsersCustomerIds();

const orphans = payments.filter((p) => p.customer && !customerIds.has(p.customer));
console.log(`Payments órfãos: ${orphans.length}`);

const results = [];
const concurrency = 5;
for (let i = 0; i < orphans.length; i += concurrency) {
  const chunk = orphans.slice(i, i + concurrency);
  const names = await Promise.all(chunk.map((p) => fetchCustomerName(p.customer)));
  chunk.forEach((p, idx) => {
    results.push({
      payment_id: p.id,
      customer_id: p.customer,
      customer_name: names[idx],
      status: p.status,
      value: p.value,
      dueDate: p.dueDate || null,
    });
  });
}

console.table(results);
const totalValue = results.reduce((sum, r) => sum + Number(r.value || 0), 0);
console.log(`Total órfãos: ${results.length}`);
console.log(`Soma valores órfãos: ${totalValue.toFixed(2)}`);
NODE
