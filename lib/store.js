'use strict';
// Tiny JSON-file store for the current round: counter, phase and the host review queue.
// No names, emails or IP addresses are ever stored.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function createStore(file) {
  let state = { round: 1, count: 0, phase: 'collecting', holdAll: false, queue: [], recent: [] };
  try {
    state = { ...state, ...JSON.parse(fs.readFileSync(file, 'utf8')) };
  } catch (_) { /* first run */ }

  let timer = null;
  function save() {
    clearTimeout(timer);
    timer = setTimeout(() => {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const tmp = file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
      fs.renameSync(tmp, file);
    }, 200);
  }

  const id = () => crypto.randomBytes(6).toString('hex');

  return {
    get: () => state,
    publicState: () => ({ count: state.count, phase: state.phase, round: state.round }),
    addApproved(text, coal) {
      const g = { id: id(), text, coal: !!coal, at: Date.now() };
      state.count += 1;
      state.recent.unshift(g);
      state.recent = state.recent.slice(0, 100);
      save();
      return g;
    },
    enqueue(text, reasons, matches) {
      const q = { id: id(), text, reasons, matches, at: Date.now() };
      state.queue.push(q);
      state.queue = state.queue.slice(-500);
      save();
      return q;
    },
    take(qid) {
      const i = state.queue.findIndex((q) => q.id === qid);
      if (i < 0) return null;
      const [item] = state.queue.splice(i, 1);
      save();
      return item;
    },
    setPhase(phase) { state.phase = phase; save(); },
    setHoldAll(v) { state.holdAll = !!v; save(); },
    reset() {
      state.round += 1;
      state.count = 0;
      state.phase = 'collecting';
      state.recent = [];
      save(); // the review queue is kept on purpose; the host may still want to clear it
    },
    clearQueue() { state.queue = []; save(); }
  };
}

module.exports = { createStore };
