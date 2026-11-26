'use strict';
// Cleans a submitted grudge: strips control/invisible characters, collapses whitespace,
// and enforces length in user-visible characters (so emoji count as one).
function sanitizeGrudge(raw, { maxLength = 80, minLength = 3 } = {}) {
  if (typeof raw !== 'string') return { ok: false, error: 'Please type a grudge first.' };
  const text = raw
    .normalize('NFC')
    .replace(/[\u0000-\u001F\u007F-\u009F­​-‏‪-‮⁠-⁤﻿]/g, ' ')
    .replace(/[<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const len = [...text].length;
  if (len < minLength) return { ok: false, error: 'That grudge is a bit too small. Give Grumbles a few more words!' };
  if (len > maxLength) return { ok: false, error: `Keep it under ${maxLength} characters, please.` };
  return { ok: true, text };
}
module.exports = { sanitizeGrudge };
