const { readFileSync, writeFileSync } = require('node:fs');
const path = require('node:path');

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function createPattern(text) {
  let index = 0;
  const parts = text.split(/(\d+(?:\.\d+)?)/);
  return '^' + parts.map((part, i) => i % 2
    ? `(?<value${index++}>\\d+(?:\\.\\d+)?)`
    : escapeRegExp(part)).join('') + '$';
}

function generateCandidates(translationList) {
  const simple = Object.create(null);
  const rules = new Map();
  for (const { text: source } of translationList) {
    const text = source.trim();
    if (!/[\u4e00-\u9fff\u3000-\u303f\uff00-\uffef]/.test(text)) continue;
    if (/\d/.test(text) && !/全角字符计数|流畅|清晰|高清|投影|构建号/.test(text)) {
      const pattern = createPattern(text);
      rules.set(pattern, { pattern, translation: '', example: text });
    } else {
      simple[text] = '';
    }
  }
  return { simple, rules: [...rules.values()] };
}

if (require.main === module) {
  const source = JSON.parse(readFileSync(path.resolve(__dirname, 'result/translation.json'), 'utf8'));
  // Candidates require review: numbers can also be fixed codec names or version identifiers.
  writeFileSync(path.resolve(__dirname, 'result/candidates.json'), JSON.stringify(generateCandidates(source), null, 2) + '\n');
}

module.exports = { createPattern, generateCandidates };
