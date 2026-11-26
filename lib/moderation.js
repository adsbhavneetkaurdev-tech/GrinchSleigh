'use strict';
// Grudge moderation: flags names, profanity and contact details so the host can review them.
// Flagged entries are never shown on screen until the host approves them.
const { PROFANITY, PROFANITY_ROOTS, FIRST_NAMES, AMBIGUOUS_NAMES } = require('./wordlists');

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i', '|': 'l', '+': 't' };

const stripDiacritics = (s) => s.normalize('NFKD').replace(/[̀-ͯ]/g, '');
const deleet = (s) => s.replace(/[0134578@$!|+]/g, (c) => LEET[c]);
const collapse = (s) => s.replace(/(.)\1+/g, '$1');
const lettersOnly = (s) => s.replace(/[^a-z]/g, '');

// Lowercase a token, undo leetspeak, drop possessive 's and anything that is not a letter.
function normToken(tok) {
  let t = stripDiacritics(tok).toLowerCase().replace(/['’]s$/, '').replace(/['’]/g, '');
  t = t.replace(/[!|]+$/, ''); // "shit!" -> "shit", not "shiti"
  return lettersOnly(deleet(t));
}
const plainToken = (tok) => lettersOnly(stripDiacritics(tok).toLowerCase().replace(/['’]s$/, ''));

const PATTERNS = {
  email: /[^\s@]+@[^\s@]+\.[a-z]{2,}/i,
  link: /(https?:\/\/|www\.)\S+|\b[a-z0-9-]+\.(com|net|org|co|io|uk|me|ly|app|biz|info)\b/i,
  handle: /(^|[^\w])@[a-z0-9_.]{2,}/i,
  phone: /(\+?\d[\d\s().-]{7,}\d)/,
  // "Mr Smith", "Dr. Jones" — the name part must be capitalised.
  title: /\b(?:[Mm]r|[Mm]rs|[Mm]s|[Mm]iss|[Dd]r|[Pp]rof|[Ss]ir|[Aa]unt(?:ie)?|[Uu]ncle)\.?\s+[A-Z][a-z]+/,
  // "my boss Kevin", "our manager Priya" — catches names that are not on the list.
  relation: /\b(?:boss|manager|supervisor|coworker|co-worker|colleague|neighbou?r|sister|brother|mum|mom|dad|wife|husband|ex|cousin|landlord|landlady|teacher|roommate|flatmate|partner|friend|intern|director|ceo|client)\s+([A-Z][a-z]{2,})\b/
};
const RELATION_SAFE = new Set(['the', 'who', 'and', 'for', 'with', 'from', 'that', 'this', 'again', 'always', 'never', 'keeps', 'still']);

function createModerator(opts = {}) {
  const allowed = new Set((opts.allowedWords || []).map(normToken));
  const profanity = new Set([...PROFANITY, ...(opts.extraBlockedWords || [])].map(normToken).filter(Boolean));
  const profanityCollapsed = new Set([...profanity].filter((w) => w.length >= 4).map(collapse));
  const roots = PROFANITY_ROOTS.map(normToken);
  const ambiguous = new Set(AMBIGUOUS_NAMES.map(normToken));
  const names = new Set([...FIRST_NAMES, ...(opts.extraBlockedNames || [])].map(normToken).filter(Boolean));
  // Extra names the host added are always blocked, even if they look like a common word.
  for (const n of (opts.extraBlockedNames || []).map(normToken)) ambiguous.delete(n);
  for (const n of ambiguous) names.delete(n);

  function isProfane(word) {
    if (!word || allowed.has(word)) return false;
    if (profanity.has(word)) return true;
    const c = collapse(word);
    if (c.length >= 4 && profanityCollapsed.has(c)) return true;
    return roots.some((r) => word.includes(r) || (c.length >= 4 && c.includes(collapse(r))));
  }

  /**
   * @param {string} text
   * @param {{holdAll?: boolean}} [flags]
   * @returns {{flagged: boolean, reasons: string[], matches: string[]}}
   */
  function check(text, flags = {}) {
    const reasons = new Set();
    const matches = [];
    const flag = (reason, match) => { reasons.add(reason); if (match) matches.push(match); };

    if (opts.enabled === false) return { flagged: false, reasons: [], matches: [] };
    if (flags.holdAll || opts.holdAllForReview) flag('manual review');

    if (opts.blockContactInfo !== false) {
      for (const key of ['email', 'link', 'handle', 'phone']) {
        const m = text.match(PATTERNS[key]);
        if (m) flag(key === 'link' ? 'link' : 'contact info', m[0].trim());
      }
    }

    // Tokenise, remembering whether each token starts a sentence.
    const tokens = [];
    const re = /[\p{L}\p{N}@$!|+'’]+/gu;
    let m;
    while ((m = re.exec(text))) {
      const before = text.slice(0, m.index).replace(/\s+$/, '');
      const sentenceStart = before === '' || /[.!?:;"“(-]$/.test(before);
      tokens.push({ raw: m[0], sentenceStart });
    }
    const letters = text.replace(/[^\p{L}]/gu, '');
    const mostlyUpper = letters.length > 0 && letters.replace(/[^\p{Lu}]/gu, '').length / letters.length > 0.6;

    if (opts.blockProfanity !== false) {
      for (const t of tokens) {
        const w = normToken(t.raw);
        if (isProfane(w) || isProfane(plainToken(t.raw))) flag('profanity', t.raw);
      }
      // Spaced or dotted out: "f u c k", "s.h.i.t"
      let run = '';
      const flushRun = () => { if (run.length >= 3 && isProfane(run)) flag('profanity', run); run = ''; };
      for (const t of tokens) {
        const w = normToken(t.raw);
        if (w.length === 1) run += w; else flushRun();
      }
      flushRun();
    }

    if (opts.blockNames !== false) {
      for (const t of tokens) {
        const w = plainToken(t.raw);
        if (!w || allowed.has(w)) continue;
        const capitalised = /^\p{Lu}/u.test(t.raw) && !mostlyUpper;
        if (names.has(w) || names.has(normToken(t.raw))) {
          flag('name', t.raw);
        } else if (ambiguous.has(w) && capitalised && !t.sentenceStart) {
          flag('name', t.raw);
        }
      }
      const title = text.match(PATTERNS.title);
      if (title) flag('name', title[0]);
      const rel = text.match(PATTERNS.relation);
      if (rel && !RELATION_SAFE.has(rel[1].toLowerCase()) && !allowed.has(rel[1].toLowerCase())) flag('name', rel[1]);
    }

    return { flagged: reasons.size > 0, reasons: [...reasons], matches: [...new Set(matches)] };
  }

  return { check };
}

module.exports = { createModerator };
