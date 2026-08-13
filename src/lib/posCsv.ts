import type { PosSaleDraft } from './pos';

export type CsvPreviewRow = {
  line: number;
  business_date: string;
  receipt_no: string;
  gross_amount: number;
  net_amount: number;
  source: string;
  valid: boolean;
  error?: string;
};

const aliases = {
  date: ['date','business_date','business date','businessdate','päivä','paiva','pvm','fecha','datum'],
  receipt: ['receipt','receipt_no','receipt no','receiptnumber','receipt number','kuitti','kuittinumero','recibo','ticket'],
  gross: ['gross','gross_amount','gross amount','brutto','brutto €','brutto eur','venta bruta','bruto','total'],
  net: ['net','net_amount','net amount','netto','netto €','netto eur','venta neta','neto'],
  source: ['source','lähde','lahde','fuente','pos','system'],
};

function norm(value: string) {
  return value.trim().toLowerCase().replace(/\ufeff/g, '').replace(/\s+/g, ' ');
}

function findIndex(headers: string[], names: string[]) {
  const normalized = headers.map(norm);
  return normalized.findIndex(h => names.includes(h));
}

function parseDelimitedLine(line: string, delimiter: string) {
  const out: string[] = [];
  let current = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (quoted && line[i + 1] === '"') { current += '"'; i += 1; }
      else quoted = !quoted;
    } else if (ch === delimiter && !quoted) {
      out.push(current.trim()); current = '';
    } else current += ch;
  }
  out.push(current.trim());
  return out;
}

function detectDelimiter(headerLine: string) {
  const candidates = [';', ',', '\t'];
  return candidates.map(d => ({ d, n: parseDelimitedLine(headerLine, d).length }))
    .sort((a, b) => b.n - a.n)[0].d;
}

function parseDate(value: string) {
  const v = value.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  let m = v.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  m = v.match(/^(\d{4})[.\/-](\d{1,2})[.\/-](\d{1,2})$/);
  if (m) return `${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`;
  return '';
}

function parseMoney(value: string) {
  let v = value.trim().replace(/\s/g, '').replace(/€/g, '');
  if (v.includes(',') && v.includes('.')) {
    if (v.lastIndexOf(',') > v.lastIndexOf('.')) v = v.replace(/\./g, '').replace(',', '.');
    else v = v.replace(/,/g, '');
  } else if (v.includes(',')) v = v.replace(',', '.');
  const n = Number(v);
  return Number.isFinite(n) ? n : NaN;
}

export function parsePosCsv(text: string, fallbackSource = 'csv'): CsvPreviewRow[] {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').filter(x => x.trim().length > 0);
  if (lines.length < 2) throw new Error('CSV file is empty or has no data rows.');
  const delimiter = detectDelimiter(lines[0]);
  const headers = parseDelimitedLine(lines[0], delimiter);
  const dateIdx = findIndex(headers, aliases.date);
  const receiptIdx = findIndex(headers, aliases.receipt);
  const grossIdx = findIndex(headers, aliases.gross);
  const netIdx = findIndex(headers, aliases.net);
  const sourceIdx = findIndex(headers, aliases.source);
  if (dateIdx < 0) throw new Error('CSV needs a Date / Business Date column.');
  if (grossIdx < 0 && netIdx < 0) throw new Error('CSV needs a Gross or Net amount column.');

  return lines.slice(1).map((line, i) => {
    const cells = parseDelimitedLine(line, delimiter);
    const business_date = parseDate(cells[dateIdx] || '');
    const gross = grossIdx >= 0 ? parseMoney(cells[grossIdx] || '') : 0;
    const net = netIdx >= 0 ? parseMoney(cells[netIdx] || '') : 0;
    const errors: string[] = [];
    if (!business_date) errors.push('invalid date');
    if (grossIdx >= 0 && Number.isNaN(gross)) errors.push('invalid gross');
    if (netIdx >= 0 && Number.isNaN(net)) errors.push('invalid net');
    return {
      line: i + 2,
      business_date,
      receipt_no: receiptIdx >= 0 ? (cells[receiptIdx] || '').trim() : '',
      gross_amount: Number.isNaN(gross) ? 0 : gross,
      net_amount: Number.isNaN(net) ? 0 : net,
      source: sourceIdx >= 0 ? ((cells[sourceIdx] || '').trim() || fallbackSource) : fallbackSource,
      valid: errors.length === 0,
      error: errors.join(', ') || undefined,
    };
  });
}

export function validCsvRows(rows: CsvPreviewRow[], restaurantId: string): PosSaleDraft[] {
  return rows.filter(r => r.valid).map(r => ({
    restaurant_id: restaurantId,
    business_date: r.business_date,
    receipt_no: r.receipt_no,
    gross_amount: r.gross_amount,
    net_amount: r.net_amount,
    source: r.source || 'csv',
  }));
}
