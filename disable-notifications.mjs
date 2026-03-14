import fs from 'fs/promises';

const START_DATE = '2026-03-01';
const END_DATE = '2026-03-31';
const STATUSES = ['CONFIRMED', 'PENDING', 'OVERDUE'];

const envText = await fs.readFile('.env', 'utf8');
const envLines = envText.split(/\r?\n/);
const asaasKeyLine = envLines.find((l) => l.startsWith('ASAAS_API_KEY='));
if (!asaasKeyLine) throw new Error('ASAAS_API_KEY não encontrado no .env');
const ASAAS_API_KEY = asaasKeyLine.replace('ASAAS_API_KEY=', '').trim();

const baseLine = envLines.find((l) => l.startsWith('ASAAS_BASE_URL='));
const ASAAS_BASE_URL = baseLine ? baseLine.replace('ASAAS_BASE_URL=', '').trim() : 'https://api.asaas.com/v3';

const buildQuery = (params) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== null);
  if (!entries.length) return '';
  return '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`).join('&');
};

async function asaasGet(path, params = {}) {
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

async function asaasPut(path, body) {
  const url = `${ASAAS_BASE_URL}${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'access_token': ASAAS_API_KEY,
    },
    body: JSON.stringify(body),
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
    const page = await asaasGet(path, { ...params, limit, offset });
    if (totalCount === null) totalCount = page.totalCount ?? page.data?.length ?? 0;
    all = all.concat(page.data || []);
    offset += limit;
  } while (totalCount !== null && offset < totalCount);
  return all;
}

console.log('Buscando payments em março/2026 (CONFIRMED, PENDING, OVERDUE)...');
const paymentsByStatus = await Promise.all(
  STATUSES.map((status) => fetchAll('/payments', {
    status,
    'dueDate[ge]': START_DATE,
    'dueDate[le]': END_DATE,
  }))
);

const allPayments = paymentsByStatus.flat();
console.log(`Total payments encontrados: ${allPayments.length}`);

const customerIds = new Set(
  allPayments.map((p) => p.customer).filter(Boolean)
);

console.log(`Customers únicos encontrados: ${customerIds.size}`);

const ids = Array.from(customerIds);
const concurrency = 5;
let updated = 0;

for (let i = 0; i < ids.length; i += concurrency) {
  const chunk = ids.slice(i, i + concurrency);
  const results = await Promise.all(chunk.map(async (customerId) => {
    const customer = await asaasPut(`/customers/${customerId}`, { notificationDisabled: true });
    return { id: customerId, name: customer?.name || null };
  }));

  results.forEach((c) => {
    updated += 1;
    console.log(`[${updated}/${ids.length}] ${c.id} - ${c.name || 'N/A'}`);
  });
}

console.log('Concluído.');
