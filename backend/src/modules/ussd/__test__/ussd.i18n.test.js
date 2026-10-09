import test from 'node:test';
import assert from 'node:assert/strict';
import { t, SUPPORTED_LANGUAGES } from '../ussd.i18n.js';

// Run with:  node --test src/modules/ussd/__tests__/ussd.i18n.test.js

test('en and sw define the same keys with the same placeholders', async () => {
  const mod = await import('../ussd.i18n.js');
  const src = (await import('node:fs')).readFileSync(new URL('../ussd.i18n.js', import.meta.url), 'utf8');
  const block = (name) => {
    const start = src.indexOf(`  ${name}: {`);
    const end = src.indexOf('\n  },', start);
    return src.slice(start, end);
  };
  const parse = (text) => {
    const out = new Map();
    for (const m of text.matchAll(/^\s{4}(\w+):\s*\n?\s*'((?:[^'\\]|\\.)*)'/gm)) out.set(m[1], m[2]);
    return out;
  };
  const en = parse(block('en'));
  const sw = parse(block('sw'));
  assert.ok(en.size > 60, 'parsed English strings');
  assert.deepEqual([...en.keys()].sort(), [...sw.keys()].sort(), 'key sets match');
  for (const [k, v] of en) {
    const ph = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort().join(',');
    assert.equal(ph(v), ph(sw.get(k)), `placeholders differ for "${k}"`);
  }
  assert.ok(mod.t);
});

test('main menu fits a single USSD screen in both languages', () => {
  for (const lang of SUPPORTED_LANGUAGES) {
    assert.ok(t(lang, 'menu_main').length <= 182, `${lang} main menu too long`);
  }
});

test('t() fills placeholders and falls back to English for unknown language', () => {
  assert.equal(t('en', 'pin_wrong', { n: 2 }), 'Incorrect PIN. 2 attempt(s) left.');
  assert.equal(t('xx', 'cancelled'), t('en', 'cancelled'));
});
