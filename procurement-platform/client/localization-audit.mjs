import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve('src/i18n/locales');
const namespaces = ['common', 'procurex-static'];

const artifactPattern =
  /\b(?:tengenezad|hakikied|iliyohakikied|zabunis|mkatabas|wasilianad|failedi|queued|signedi|auditedi|aprovui|rejecti|submited|completedi)\b/i;

const identicalAllowlist = {
  values: new Set([
    'ProcureX',
    'TANePS',
    'PPRA',
    'TRA',
    'BRELA',
    'ISO',
    'API',
    'MFA',
    'OTP',
    'SMS',
    'TIN',
    'VAT',
    'TZS',
    'USD',
    'PDF',
    'CSV',
    'XLSX',
    'HTML',
    'TLS',
    'QR',
    'GPS',
    'CCTV',
    'KYC',
    'SLA',
    'RFP',
    'EOI',
    'PO',
    'SOP'
  ]),
  valuePatterns: [
    /^$/,
    /^[^A-Za-z]+$/,
    /^[-+*!.★]+$/,
    /^ XXX XXX XXX$/,
    /^GET|POST|PUT|PATCH|DELETE|OK|REST|JSON|XML|URL|URI|ID$/,
    /@|https?:\/\/|www\.|\.(?:pdf|csv|xlsx?|docx?|png|jpe?g)$/i,
    /^\d+\s?(?:m|h|d|%|\/\d+)?$/i,
    /^\d+[\w -]*(?:items?|comments?|views?|days?(?: remaining)?|months?|mandatory|ready|workflows?|archived|unread messages?|schedule items?|priced lines?|pricing lines reviewed|response items.*|structured fields started|of \d+.*)$/i,
    /^[A-Z0-9&./() -]{2,}$/
  ],
  keyPatterns: [
    /\.id$/i,
    /\.code$/i,
    /\.email$/i,
    /\.filename$/i,
    /\.reference$/i,
    /\.source$/i,
    /\.route$/i,
    /\.path$/i
  ]
};

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function flatten(value, prefix = '', out = {}) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, out));
    return out;
  }

  if (value && typeof value === 'object') {
    Object.entries(value).forEach(([key, item]) => flatten(item, prefix ? `${prefix}.${key}` : key, out));
    return out;
  }

  out[prefix] = String(value ?? '');
  return out;
}

function isIntentionalIdentical(key, value) {
  const trimmed = value.trim();
  return (
    identicalAllowlist.values.has(trimmed) ||
    identicalAllowlist.valuePatterns.some((pattern) => pattern.test(trimmed)) ||
    identicalAllowlist.keyPatterns.some((pattern) => pattern.test(key))
  );
}

let failures = 0;

for (const namespace of namespaces) {
  const en = flatten(readJson(path.join(root, 'en', `${namespace}.json`)));
  const sw = flatten(readJson(path.join(root, 'sw', `${namespace}.json`)));
  const enKeys = new Set(Object.keys(en));
  const swKeys = new Set(Object.keys(sw));

  const missingInSw = [...enKeys].filter((key) => !swKeys.has(key));
  const extraInSw = [...swKeys].filter((key) => !enKeys.has(key));
  const artifacts = Object.entries(sw).filter(([, value]) => artifactPattern.test(value));
  const identical = Object.entries(en).filter(([key, value]) => sw[key] === value);
  const reviewIdentical = identical.filter(([key, value]) => !isIntentionalIdentical(key, value));

  if (missingInSw.length || extraInSw.length || artifacts.length) failures += 1;

  console.log(`${namespace}: ${Object.keys(en).length} keys`);
  console.log(`  missing sw keys: ${missingInSw.length}`);
  console.log(`  extra sw keys: ${extraInSw.length}`);
  console.log(`  generated-copy artifacts: ${artifacts.length}`);
  console.log(`  identical strings allowed: ${identical.length - reviewIdentical.length}`);
  console.log(`  identical strings needing human review: ${reviewIdentical.length}`);

  if (missingInSw.length) console.log(`  first missing: ${missingInSw.slice(0, 10).join(', ')}`);
  if (extraInSw.length) console.log(`  first extra: ${extraInSw.slice(0, 10).join(', ')}`);
  if (artifacts.length) console.log(`  first artifacts: ${artifacts.slice(0, 10).map(([key]) => key).join(', ')}`);
  if (reviewIdentical.length) console.log(`  first review items: ${reviewIdentical.slice(0, 10).map(([key]) => key).join(', ')}`);
}

if (failures) {
  console.error('Localization audit failed.');
  process.exit(1);
}

console.log('Localization audit passed.');
