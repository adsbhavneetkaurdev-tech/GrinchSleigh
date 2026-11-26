'use strict';
// Loads config/event.json, merged over the shipped defaults.
// The file is re-read whenever it changes, so display/form text can be edited live.
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = process.env.GRUDGE_CONFIG || path.join(__dirname, '..', 'config', 'event.json');

// Defaults mirror config/event.json so a partial config still works.
const DEFAULTS = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'config', 'event.json'), 'utf8'));

function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
function merge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    out[k] = isObj(v) && isObj(base[k]) ? merge(base[k], v) : v;
  }
  return out;
}

let cached = null;
let cachedMtime = 0;

function getConfig() {
  let mtime = 0;
  try { mtime = fs.statSync(CONFIG_PATH).mtimeMs; } catch (_) { /* fall back to defaults */ }
  if (!cached || mtime !== cachedMtime) {
    let fileCfg = {};
    try {
      fileCfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
    } catch (err) {
      if (cached) {
        console.warn(`[config] Could not parse ${CONFIG_PATH}; keeping previous config. ${err.message}`);
        return cached;
      }
      console.warn(`[config] Using defaults: ${err.message}`);
    }
    let cfg = merge(DEFAULTS, fileCfg);
    if (process.env.PORT) cfg.port = Number(process.env.PORT);
    // ADMIN_PASSWORD is accepted too, to match the Wish Tree setup.
    if (process.env.ADMIN_PASSWORD) cfg.hostKey = process.env.ADMIN_PASSWORD;
    if (process.env.HOST_KEY) cfg.hostKey = process.env.HOST_KEY;
    if (process.env.PUBLIC_URL) cfg.publicUrl = process.env.PUBLIC_URL;
    if (cached) console.log('[config] Reloaded config/event.json');
    cached = cfg;
    cachedMtime = mtime;
  }
  return cached;
}

// Only what browsers need. Never sends hostKey or moderation word lists.
function publicConfig(cfg) {
  return {
    eventName: cfg.eventName,
    display: cfg.display,
    speech: cfg.speech,
    form: cfg.form,
    limits: { maxLength: cfg.limits.maxLength, minLength: cfg.limits.minLength },
    demo: cfg.demo
  };
}

module.exports = { getConfig, publicConfig, CONFIG_PATH };
