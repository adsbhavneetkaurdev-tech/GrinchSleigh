'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { createModerator } = require('../lib/moderation');
const { sanitizeGrudge } = require('../lib/sanitize');
const cfg = require('../config/event.json').moderation;

const mod = createModerator(cfg);
const flagged = (t) => mod.check(t).flagged;

test('clean grudges pass', () => {
  for (const t of [
    'The printer jams every single Monday',
    'Will someone please fix the office Wi-Fi?',
    'Meetings that could have been an email',
    'Be frank: who keeps stealing my stapler?',
    'Ho ho ho, no more reply-all chains',
    'Santa forgot my present again',
    'Stepping on LEGO at 6am',
    'My boss keeps scheduling 5pm calls',
    'I hope the trains run on time in 2027',
    'Push it to production on a Friday? No.'
  ]) assert.strictEqual(flagged(t), false, t);
});

test('names are flagged', () => {
  for (const t of [
    'Dave from accounts ate my lunch',
    'my manager Priya never replies',
    'kevin keeps microwaving fish',
    'Thanks a lot, Mark, for the 7am meeting',
    'Mr. Henderson and his loud phone calls',
    'Jessica\'s playlist in the office'
  ]) assert.strictEqual(flagged(t), true, t);
});

test('profanity is flagged, including disguised forms', () => {
  for (const t of ['This sh1t commute', 'f u c k Mondays', 'what a fuuuuck year', 'total $hit show', 'b!tch of a year', 'absolute fuckwit printer'])
    assert.strictEqual(flagged(t), true, t);
});

test('contact details and links are flagged', () => {
  for (const t of ['email me at a@b.com', 'follow @someone', 'see www.example.com', 'call 07700 900123'])
    assert.strictEqual(flagged(t), true, t);
});

test('extra blocked names from config', () => {
  const m = createModerator({ ...cfg, extraBlockedNames: ['Grace', 'Okonkwo'] });
  assert.strictEqual(m.check('okonkwo took the last mince pie').flagged, true);
  assert.strictEqual(m.check('no grace period on deadlines').flagged, true);
});

test('hold-all sends everything to review', () => {
  assert.deepStrictEqual(mod.check('Printer jams', { holdAll: true }).reasons, ['manual review']);
});

test('sanitizer enforces length and strips junk', () => {
  assert.strictEqual(sanitizeGrudge('  hi​  there <b> ').text, 'hi there b');
  assert.strictEqual(sanitizeGrudge('x'.repeat(81)).ok, false);
  assert.strictEqual(sanitizeGrudge('ok').ok, false);
  assert.strictEqual(sanitizeGrudge('🎄'.repeat(80)).ok, true);
});
