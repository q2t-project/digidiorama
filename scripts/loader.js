// scripts/loader.js
import Ajv from 'https://cdn.jsdelivr.net/npm/ajv@8.17.1/+esm';

// 最小スキーマ（P1用：必須部のみ抜粋）
const schema = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  title: 'digidiorama(min)',
  type: 'object',
  required: ['version', 'meta', 'nodes'],
  properties: {
    version: { type: 'string' },
    meta: {
      type: 'object',
      required: ['title'],
      properties: {
        title: { type: 'string' },
        author: { type: 'string' },
        created: { type: 'string' },
        tags:   { type: 'array', items: { type: 'string' } }
      }
    },
    space: { type: 'object' },   // P1では内容は未検証（将来拡張）
    layers:{ type: 'array' },    // 同上
    nodes: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'label', 'position'],
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          position: {
            type: 'array', minItems: 3, maxItems: 3,
            items: { type: 'number' }
          },
          color: { type: 'string' },
          size:  { type: 'number' },
          tags:  { type: 'array', items: { type: 'string' } },
          description: { type: 'string' },
          links: { type: 'array', items: { type: 'string' } }
        }
      }
    },
    edges:  { type: 'array' },
    models: { type: 'array' }
  }
};

const ajv = new Ajv({ allErrors: true, allowUnionTypes: true });
const validate = ajv.compile(schema);

export function getQueryParam(name) {
  const u = new URL(window.location.href);
  return u.searchParams.get(name);
}

export async function loadManifest(url = 'assets/manifest.json') {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`manifest fetch failed: ${res.status} ${res.statusText}`);
  return await res.json();
}

export async function loadDigigiorama(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`data fetch failed: ${res.status} ${res.statusText}`);
  const data = await res.json();

  // AJV 検証（必須フィールドが欠けていたら詳細を返す）
  const ok = validate(data);
  if (!ok) {
    const detail = ajv.errorsText(validate.errors, { separator: '\n' });
    const e = new Error('schema validation failed');
    e.validation = detail;
    e.errors = validate.errors;
    throw e;
  }
  return data;
}
