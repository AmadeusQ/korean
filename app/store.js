// Прогресс: интервальные повторения (коробки Лейтнера), серия дней, настройки. Всё в localStorage.
(function () {
  const KEY = 'hangul-study-v1';
  const DAY = 86400000;
  const INTERVALS = [0, 1, 2, 4, 8, 16, 32].map((d) => d * DAY); // по коробкам 0..6
  const MAX_BOX = INTERVALS.length - 1;

  const empty = () => ({ items: {}, days: {}, settings: { rate: 0.85, dailyGoal: 30, romanize: true, typing: true, keyboard: true, autoNext: true, theme: 'auto' }, tests: {} });
  let state;
  try { state = Object.assign(empty(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { state = empty(); }
  state.settings = Object.assign(empty().settings, state.settings);

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
  const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD в местном времени

  function get(key) { return state.items[key]; }
  function box(key) { return state.items[key]?.box ?? -1; } // -1 — ещё не встречалось
  function isDue(key, now = Date.now()) { const it = state.items[key]; return !!it && it.due <= now; }

  function answer(key, correct) {
    const now = Date.now();
    const it = state.items[key] || { box: 0, due: now, right: 0, wrong: 0 };
    if (correct) { it.right++; it.box = Math.min(MAX_BOX, it.box + 1); }
    else { it.wrong++; it.box = Math.max(0, it.box - 2); }
    it.due = now + INTERVALS[it.box];
    it.last = now;
    state.items[key] = it;
    const d = today();
    const day = state.days[d] || { n: 0, ok: 0 };
    day.n++; if (correct) day.ok++;
    state.days[d] = day;
    save();
    return it;
  }

  function streak() {
    let s = 0; const d = new Date();
    if (!state.days[today()]) d.setDate(d.getDate() - 1); // сегодня ещё не занимались — серия жива со вчера
    while (state.days[d.toLocaleDateString('sv-SE')]) { s++; d.setDate(d.getDate() - 1); }
    return s;
  }
  function lastDays(n) {
    const out = []; const d = new Date();
    for (let i = 0; i < n; i++) { const k = d.toLocaleDateString('sv-SE'); out.unshift({ date: k, ...(state.days[k] || { n: 0, ok: 0 }) }); d.setDate(d.getDate() - 1); }
    return out;
  }

  window.Store = {
    get, box, isDue, answer, streak, lastDays, MAX_BOX,
    todayStats: () => state.days[today()] || { n: 0, ok: 0 },
    settings: () => state.settings,
    setSetting(k, v) { state.settings[k] = v; save(); },
    getTest: (n) => state.tests?.[n] || null,
    setTest(n, pct) {
      state.tests = state.tests || {};
      const prev = state.tests[n];
      state.tests[n] = { best: Math.max(pct, prev?.best || 0), last: pct, date: today() }; save();
    },
    exportJSON: () => JSON.stringify(state, null, 1),
    importJSON(text) { const s = JSON.parse(text); if (!s.items) throw new Error('Не похоже на файл прогресса'); state = Object.assign(empty(), s); state.settings = Object.assign(empty().settings, s.settings); save(); },
    // Объединить прогресс с другого устройства: по каждому заданию берём более свежий ответ
    merge(other) {
      if (!other || !other.items) throw new Error('Не похоже на прогресс');
      for (const [k, it] of Object.entries(other.items)) { const mine = state.items[k]; if (!mine || (it.last || 0) > (mine.last || 0)) state.items[k] = it; }
      for (const [d, v] of Object.entries(other.days || {})) { const m = state.days[d]; if (!m || v.n > m.n) state.days[d] = v; }
      state.tests = state.tests || {};
      for (const [n, t] of Object.entries(other.tests || {})) { const m = state.tests[n]; if (!m || t.best > m.best) state.tests[n] = t; }
      save();
    },
    // Компактная строка для ссылки переноса (без настроек)
    async pack() {
      const json = JSON.stringify({ items: state.items, days: state.days, tests: state.tests || {} });
      let bytes = new TextEncoder().encode(json), z = '0';
      if (window.CompressionStream) { bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); z = '1'; }
      let bin = ''; bytes.forEach((b) => (bin += String.fromCharCode(b)));
      return z + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    async unpack(str) {
      const z = str[0], b64 = str.slice(1).replace(/-/g, '+').replace(/_/g, '/');
      let bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      if (z === '1') bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
      return JSON.parse(new TextDecoder().decode(bytes));
    },
    reset() { state = empty(); save(); },
  };
})();
