// Прогресс: интервальные повторения (коробки Лейтнера), серия дней, настройки. Всё в localStorage.
(function () {
  const KEY = 'hangul-study-v1';
  const DAY = 86400000;
  const INTERVALS = [0, 1, 2, 4, 8, 16, 32].map((d) => d * DAY); // по коробкам 0..6
  const MAX_BOX = INTERVALS.length - 1;

  const empty = () => ({ items: {}, days: {}, settings: { rate: 0.85, dailyGoal: 30, romanize: true, typing: true, keyboard: true, theme: 'auto' }, tests: {}, custom: [], meta: {} });
  // Всё, что приходит из localStorage, ссылки переноса или файла, приводим к ожидаемым типам:
  // числа — числами, строки — строками, лишнее выбрасываем. Иначе чужая ссылка могла бы внедрить разметку.
  const int = (v, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min; };
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const str = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
  const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  function cleanItems(items) {
    const out = {};
    for (const [k, it] of Object.entries(items || {})) {
      if (typeof k !== 'string' || k.length > 300 || !it || typeof it !== 'object') continue;
      if (/^num:[sn]:\d+$/.test(k)) continue; // старый формат чисел: ключ на каждое число
      // время ответа из будущего не должно навсегда перебивать местный прогресс
      out[k] = { box: int(it.box, 0, MAX_BOX), due: num(it.due), right: int(it.right, 0, 1e6), wrong: int(it.wrong, 0, 1e6), last: Math.min(num(it.last), Date.now() + DAY) };
    }
    return out;
  }
  function cleanDays(days) {
    const out = {};
    for (const [d, v] of Object.entries(days || {})) if (isDay(d) && v && typeof v === 'object') out[d] = { n: int(v.n, 0, 1e5), ok: int(v.ok, 0, 1e5) };
    return out;
  }
  function cleanTests(tests) {
    const out = {};
    for (const [n, t] of Object.entries(tests || {})) if (/^\d{1,3}$/.test(n) && t && typeof t === 'object') out[n] = { best: int(t.best, 0, 100), last: int(t.last, 0, 100), date: isDay(t.date) ? t.date : '' };
    return out;
  }
  function cleanCustom(list) {
    return (Array.isArray(list) ? list : []).map((w) => w && ({ ko: str(w.ko, 60).trim(), ru: str(w.ru, 120).trim(), c: str(w.c, 40) || 'Мои слова', added: isDay(w.added) ? w.added : '' }))
      .filter((w) => w && w.ko && w.ru && /[가-힣]/.test(w.ko)).slice(0, 2000);
  }
  function cleanMeta(meta) { const m = meta || {}; return { matchBest: num(m.matchBest) || undefined, timedBest: int(m.timedBest, 0, 1e4) || undefined }; }
  function cleanSettings(s) {
    const d = empty().settings, x = Object.assign({}, d, s || {});
    return { rate: Math.min(1.5, Math.max(0.5, num(x.rate) || d.rate)), dailyGoal: int(x.dailyGoal, 5, 300), romanize: !!x.romanize, typing: !!x.typing, keyboard: !!x.keyboard, theme: ['auto', 'light', 'dark'].includes(x.theme) ? x.theme : 'auto' };
  }
  const clean = (s) => ({ items: cleanItems(s.items), days: cleanDays(s.days), tests: cleanTests(s.tests), custom: cleanCustom(s.custom), meta: cleanMeta(s.meta), settings: cleanSettings(s.settings) });

  let state;
  try { state = clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { state = empty(); }

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
  const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD в местном времени

  function get(key) { return state.items[key]; }
  function box(key) { return state.items[key]?.box ?? -1; } // -1 — ещё не встречалось
  function isDue(key, now = Date.now()) { const it = state.items[key]; return !!it && it.due <= now; }

  function countDay(correct) {
    const d = today();
    const day = state.days[d] || { n: 0, ok: 0 };
    day.n++; if (correct) day.ok++;
    state.days[d] = day;
  }
  function answer(key, correct) {
    const now = Date.now();
    const it = state.items[key] || { box: 0, due: now, right: 0, wrong: 0 };
    if (correct) { it.right++; it.box = Math.min(MAX_BOX, it.box + 1); }
    else { it.wrong++; it.box = Math.max(0, it.box - 2); }
    it.due = now + INTERVALS[it.box];
    it.last = now;
    state.items[key] = it;
    countDay(correct); save();
    return it;
  }
  // Оценка карточки как в Anki: 0 снова, 1 трудно, 2 хорошо, 3 легко
  function grade(key, g) {
    const now = Date.now();
    const it = state.items[key] || { box: 0, due: now, right: 0, wrong: 0 };
    if (g === 0) { it.wrong++; it.box = 0; it.due = now; }
    else {
      it.right++;
      it.box = g === 1 ? Math.max(1, it.box) : Math.min(MAX_BOX, it.box + (g === 3 ? 2 : 1));
      it.due = now + INTERVALS[it.box] * (g === 1 ? 0.5 : 1);
    }
    it.last = now; state.items[key] = it;
    countDay(g > 0); save();
    return it;
  }
  // Сколько заданий станет к повторению к концу завтрашнего дня (из тех, что сейчас ещё не пора)
  function forecastTomorrow(keys) {
    const now = Date.now(); const end = new Date(); end.setDate(end.getDate() + 1); end.setHours(23, 59, 59, 999);
    return keys.filter((k) => { const it = state.items[k]; return it && it.due > now && it.due <= end.getTime(); }).length;
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
    get, box, isDue, answer, grade, forecastTomorrow, streak, lastDays, MAX_BOX,
    todayStats: () => state.days[today()] || { n: 0, ok: 0 },
    settings: () => state.settings,
    // через cleanSettings: пустое поле цели не превратится в 0, скорость речи останется в пределах
    setSetting(k, v) { state.settings = cleanSettings({ ...state.settings, [k]: v }); save(); },
    getTest: (n) => state.tests?.[n] || null,
    setTest(n, pct) {
      const prev = state.tests[n];
      state.tests[n] = { best: Math.max(pct, prev?.best || 0), last: pct, date: today() }; save();
    },
    // свои слова
    custom: () => state.custom || [],
    addCustom(w) { state.custom = (state.custom || []).filter((x) => x.ko !== w.ko); state.custom.push({ ...w, added: today() }); save(); },
    removeCustom(ko) { state.custom = (state.custom || []).filter((x) => x.ko !== ko); save(); },
    meta: (k) => state.meta?.[k],
    setMeta(k, v) { state.meta = state.meta || {}; state.meta[k] = v; save(); },
    exportJSON: () => JSON.stringify(state, null, 1),
    importJSON(text) {
      const s = JSON.parse(text);
      if (!s || typeof s !== 'object' || !s.items || typeof s.items !== 'object') throw new Error('Не похоже на файл прогресса');
      state = clean(s); save();
    },
    // Объединить прогресс с другого устройства: по каждому заданию берём более свежий ответ
    merge(raw) {
      if (!raw || typeof raw !== 'object' || !raw.items || typeof raw.items !== 'object') throw new Error('Не похоже на прогресс');
      const other = clean(raw);
      for (const [k, it] of Object.entries(other.items)) { const mine = state.items[k]; if (!mine || it.last > (mine.last || 0)) state.items[k] = it; }
      for (const [d, v] of Object.entries(other.days)) { const m = state.days[d]; if (!m || v.n > m.n) state.days[d] = v; }
      for (const [n, t] of Object.entries(other.tests)) { const m = state.tests[n]; if (!m || t.best > m.best) state.tests[n] = t; }
      for (const w of other.custom) if (!state.custom.some((x) => x.ko === w.ko)) state.custom.push(w);
      save();
    },
    keys: () => Object.keys(state.items),
    // Компактная строка для ссылки переноса (без настроек)
    async pack() {
      const json = JSON.stringify({ items: state.items, days: state.days, tests: state.tests || {}, custom: state.custom || [] });
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
