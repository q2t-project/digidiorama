// scripts/validate.js
const fs = require("fs");
const path = require("path");
const Ajv = require("ajv");
const wanakana = require("wanakana");

const ajv = new Ajv({ allErrors: true, strict: false });

// === カスタムキーワード ===
ajv.addKeyword({
  keyword: "normalizedRange",
  type: "array",
  validate: function (schema, data) {
    if (!schema) return true;
    if (!Array.isArray(data)) return true;
    return data.every(v => typeof v === "number" && v >= 0 && v <= 1);
  },
  errors: false
});

// === スキーマ読み込み ===
const schemaPath = "assets/schema/digigiorama.schema.json";
const schema = JSON.parse(fs.readFileSync(schemaPath, "utf-8"));
const validate = ajv.compile(schema);

// === タグ正規化処理 ===
function toKebabRomaji(tag) {
  let romaji = wanakana.toRomaji(tag).toLowerCase();
  romaji = romaji.replace(/\s+/g, "-");
  romaji = romaji.replace(/[^a-z0-9-]/g, "");
  return romaji;
}

function normalizeTags(data) {
  for (const node of data.nodes || []) {
    if (node.tags) {
      node.tags = node.tags.map(tag => {
        const normalized = toKebabRomaji(tag);
        if (tag !== normalized) {
          console.log(`[normalize] '${tag}' -> '${normalized}'`);
        }
        return normalized;
      });
    }
  }
}

// === テスト実行 ===
const dataDir = "assets/data";
const files = fs.readdirSync(dataDir).filter(f => f.endsWith(".digigiorama.json"));

let hasError = false;

for (const file of files) {
  const fullPath = path.join(dataDir, file);
  const json = JSON.parse(fs.readFileSync(fullPath, "utf-8"));

  // タグ正規化
  normalizeTags(json);

  const valid = validate(json);

  if (valid) {
    console.log(`✅ OK: ${file}`);
  } else {
    console.error(`❌ NG: ${file}`);
    console.error(validate.errors);
    hasError = true;
  }
}

if (hasError) process.exit(1);
