const { test } = require('node:test');
const assert = require('node:assert/strict');
const { direction } = require('../preload.cjs');
for (const [text, expected] of [
  ['שלום Teams, בשעה 10:30 (בדיקה).', 'rtl'],
  ['Hello שלום', 'ltr'], ['Teams שלום', 'ltr'],
  ['123 — שלום', 'rtl'], ['🙂 (Hello)', 'ltr'],
  ['مرحبا Teams', 'rtl'], ['\u05B0שלום', 'rtl'],
  ['', 'ltr'], ['123 🙂 —', 'ltr'], ['\n\tשלום', 'rtl'],
]) test(`${JSON.stringify(text)} → ${expected}`, () => assert.equal(direction(text), expected));
test('neutral paragraphs can use an explicit fallback', () => assert.equal(direction('123', 'rtl'), 'rtl'));
