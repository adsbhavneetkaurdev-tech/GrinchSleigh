/* Host panel: review flagged grudges and drive the big screen remotely. */
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const params = new URLSearchParams(location.search);
  let key = params.get('key') || sessionStorage.getItem('grudgeHostKey') || '';
  if (params.get('key')) history.replaceState(null, '', location.pathname); // keep the key out of the address bar

  const api = async (path, opts = {}) => {
    const res = await fetch('/api/host' + path, {
      ...opts, headers: { 'Content-Type': 'application/json', 'x-host-key': key, ...(opts.headers || {}) }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { const err = new Error(data.error || 'Error ' + res.status); err.status = res.status; throw err; }
    return data;
  };

  let toastTimer;
  const toast = (m) => { const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600); };
  const ago = (ts) => { const s = Math.round((Date.now() - ts) / 1000); return s < 60 ? `${s}s ago` : s < 3600 ? `${Math.round(s / 60)}m ago` : new Date(ts).toLocaleTimeString(); };

  function renderQueue(queue) {
    $('#s-queue').textContent = queue.length;
    $('#queue-empty').hidden = queue.length > 0;
    $('#clear-queue').hidden = queue.length === 0;
    const ul = $('#queue');
    ul.innerHTML = '';
    for (const item of queue) {
      const li = document.createElement('li');
      const ta = document.createElement('textarea');
      ta.value = item.text; ta.rows = 2; ta.maxLength = 160;
      const chips = document.createElement('div'); chips.className = 'chips';
      for (const r of item.reasons || []) { const c = document.createElement('span'); c.className = 'chip'; c.textContent = r; chips.append(c); }
      for (const m of item.matches || []) { const c = document.createElement('span'); c.className = 'chip match'; c.textContent = '“' + m + '”'; chips.append(c); }
      const row = document.createElement('div'); row.className = 'row';
      const time = document.createElement('span'); time.className = 'time'; time.textContent = ago(item.at);
      const ok = document.createElement('button'); ok.className = 'approve'; ok.textContent = 'Approve';
      const no = document.createElement('button'); no.className = 'reject'; no.textContent = 'Reject';
      ok.onclick = () => act(`/queue/${item.id}/approve`, { text: ta.value }, 'Approved. Into the sack!');
      no.onclick = () => act(`/queue/${item.id}/reject`, {}, 'Rejected.');
      row.append(time, no, ok);
      li.append(ta, chips, row);
      ul.append(li);
    }
  }
  function renderRecent(recent) {
    const ul = $('#recent');
    ul.innerHTML = '';
    for (const g of recent) {
      const li = document.createElement('li');
      const a = document.createElement('span'); a.textContent = (g.coal ? '⚫ ' : '') + g.text;
      const b = document.createElement('span'); b.textContent = ago(g.at);
      li.append(a, b); ul.append(li);
    }
    if (!recent.length) ul.innerHTML = '<li class="empty">No grudges yet.</li>';
  }
  function renderState(s) {
    $('#s-count').textContent = s.count;
    $('#s-phase').textContent = s.phase === 'finale' ? 'Finale' : 'Collecting';
  }

  async function act(path, body, msg) {
    try { await api(path, { method: 'POST', body: JSON.stringify(body) }); if (msg) toast(msg); await refresh(); }
    catch (e) { toast(e.message); }
  }

  async function refresh() {
    const s = await api('/state');
    renderState(s); renderQueue(s.queue); renderRecent(s.recent);
    $('#hold-all').checked = !!s.holdAll;
    $('#guest-url').textContent = s.guestUrl; $('#guest-url').href = s.guestUrl;
    $('#display-url').href = '/display?key=' + encodeURIComponent(key);
  }

  async function start() {
    try {
      await refresh();
    } catch (e) {
      sessionStorage.removeItem('grudgeHostKey');
      $('#panel').hidden = true; $('#login').hidden = false;
      if (key) $('#login-error').textContent = e.status === 401 ? 'Wrong admin password.' : e.message;
      return;
    }
    sessionStorage.setItem('grudgeHostKey', key);
    $('#login').hidden = true; $('#panel').hidden = false;
    const socket = io({ auth: { key } });
    socket.on('queue', (d) => { renderQueue(d.queue); if (d.added) toast('New grudge needs review'); });
    socket.on('recent', renderRecent);
    socket.on('state', renderState);
    socket.on('settings', (d) => { $('#hold-all').checked = !!d.holdAll; });
    socket.on('connect', refresh);
    setInterval(() => refresh().catch(() => {}), 30000);
  }

  document.querySelectorAll('[data-action]').forEach((b) => b.addEventListener('click', () => {
    const action = b.dataset.action;
    if (action === 'reset' && !confirm('Reset the round? The counter goes back to 0 and Grumbles returns with an empty sack.')) return;
    act('/control', { action }, { finale: 'Finale launched!', reset: 'New round started.' }[action]);
  }));
  $('#hold-all').addEventListener('change', (e) => act('/settings', { holdAll: e.target.checked }, e.target.checked ? 'Every grudge will wait for review.' : 'Only flagged grudges wait for review.'));
  $('#clear-queue').addEventListener('click', () => { if (confirm('Reject everything in the queue?')) act('/queue/clear', {}, 'Queue cleared.'); });
  $('#login-form').addEventListener('submit', (e) => { e.preventDefault(); key = $('#key').value; $('#login-error').textContent = ''; start(); });

  if (key) start(); else $('#login').hidden = false;
})();
