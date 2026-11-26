/* Guest form: one anonymous text field, nothing else is collected. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const form = $('#grudge-form'), ta = $('#grudge'), count = $('#count'), send = $('#send');
  const result = $('#result'), resultMsg = $('#result-msg');
  let cfg = { form: {}, limits: { maxLength: 80, minLength: 3 } };

  // The Grumpster on top of the form.
  const art = window.GrumpArt;
  $('.mascot').innerHTML = art.defs() + art.grumbles();

  const len = (s) => [...s].length;
  function updateCount() {
    const max = cfg.limits.maxLength;
    const n = len(ta.value);
    count.textContent = `${n}/${max}`;
    count.classList.toggle('near', n > max - 10);
  }

  fetch('/api/config', { cache: 'no-store' }).then((r) => r.json()).then((c) => {
    cfg = c;
    document.querySelectorAll('[data-cfg]').forEach((el) => {
      const v = el.dataset.cfg.split('.').reduce((o, k) => (o ? o[k] : undefined), cfg);
      if (typeof v === 'string' && v) el.textContent = v;
    });
    if (cfg.form.placeholder) ta.placeholder = cfg.form.placeholder;
    ta.maxLength = cfg.limits.maxLength * 2; // emoji take 2 UTF-16 units; real limit checked below
    updateCount();
  }).catch(() => {});

  ta.addEventListener('input', () => {
    const max = cfg.limits.maxLength;
    if (len(ta.value) > max) ta.value = [...ta.value].slice(0, max).join('');
    updateCount();
    clearError();
  });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });

  function showError(msg) {
    let el = $('#error');
    if (!el) { el = document.createElement('p'); el.id = 'error'; el.setAttribute('role', 'alert'); send.after(el); }
    el.textContent = msg;
  }
  function clearError() { const el = $('#error'); if (el) el.remove(); }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = ta.value.trim();
    if (len(text) < (cfg.limits.minLength || 3)) { showError('Give the Grumpster a few more words!'); ta.focus(); return; }
    send.disabled = true;
    try {
      const res = await fetch('/api/grudge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text }) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        form.hidden = true;
        result.hidden = false;
        result.classList.toggle('held', data.status === 'held');
        resultMsg.textContent = data.message || (data.status === 'held' ? cfg.form.held : cfg.form.thanks);
        ta.value = '';
        updateCount();
        $('#again').focus();
      } else {
        showError(data.message || 'Something went wrong. Try again?');
      }
    } catch (_) {
      showError('No connection. Check the Wi-Fi and try again.');
    } finally {
      send.disabled = false;
    }
  });

  $('#again').addEventListener('click', () => {
    result.hidden = true;
    form.hidden = false;
    const b = $('.ball'); b.style.animation = 'none'; void b.offsetWidth; b.style.animation = '';
    ta.focus();
  });
  updateCount();
})();
