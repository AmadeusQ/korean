// Прогресс: интервальные повторения (коробки Лейтнера), серия дней, настройки. Всё в localStorage.
(function () {
  const KEY = 'hangul-study-v1';
  const DAY = 86400000;
  const INTERVALS = [0, 1, 2, 4, 8, 16, 32].map((d) => d * DAY); // по коробкам 0..6
  const MAX_BOX = INTERVALS.length - 1;

  const empty = () => ({ items: {}, days: {}, settings: { rate: 0.85, dailyGoal: 30, newPerDay: 15, sessionLen: 15, romanize: true, typing: true, keyboard: true, theme: 'auto' }, tests: {}, custom: [], meta: {}, notes: {}, reads: [] });
  // Всё, что приходит из localStorage, ссылки переноса или файла, приводим к ожидаемым типам:
  // числа — числами, строки — строками, лишнее выбрасываем. Иначе чужая ссылка могла бы внедрить разметку.
  const int = (v, min, max) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min; };
  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
  const str = (v, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
  const isDay = (d) => /^\d{4}-\d{2}-\d{2}$/.test(d);
  const BAD_KEY = new Set(['__proto__', 'constructor', 'prototype']);
  // пределы: реальный прогресс намного меньше, а чужая ссылка не должна забить localStorage
  const MAX_ITEMS = 20000, MAX_DAYS = 3700;
  function cleanItems(items) {
    const out = {};
    for (const [k, it] of Object.entries(items || {}).slice(0, MAX_ITEMS)) {
      if (typeof k !== 'string' || k.length > 300 || BAD_KEY.has(k) || !it || typeof it !== 'object') continue;
      if (/^num:[sn]:\d+$/.test(k)) continue; // старый формат чисел: ключ на каждое число
      // время ответа из будущего не должно навсегда перебивать местный прогресс
      out[k] = { box: int(it.box, 0, MAX_BOX), due: Math.min(num(it.due), Date.now() + 33 * DAY), right: int(it.right, 0, 1e6), wrong: int(it.wrong, 0, 1e6), last: Math.min(num(it.last), Date.now() + DAY) };
    }
    return out;
  }
  function cleanDays(days) {
    const out = {};
    for (const [d, v] of Object.entries(days || {}).filter(([d]) => isDay(d)).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, MAX_DAYS)) if (isDay(d) && v && typeof v === 'object') out[d] = { n: int(v.n, 0, 1e5), ok: int(v.ok, 0, 1e5), nw: int(v.nw, 0, 1e5) };
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
  // свой 자기소개: только хангыль (имя вставляется в задания и озвучку)
  const hangulOnly = (v, max) => { const x = str(v, max).trim(); return /^[가-힣]+( [가-힣]+)*$/.test(x) ? x : ''; };
  const cleanIntro = (v) => (v && typeof v === 'object' ? { name: hangulOnly(v.name, 12), country: hangulOnly(v.country, 20), job: hangulOnly(v.job, 20) } : undefined);
  // свои подсказки к словам: ko → текст (до 200 знаков)
  function cleanNotes(notes) {
    const out = {};
    for (const [k, v] of Object.entries(notes || {}).slice(0, 3000)) { const t = str(v, 200).trim(); if (k.length <= 60 && /[가-힣]/.test(k) && t) out[k] = t; }
    return out;
  }
  // Чтение текстов на время: t — id текста, spm — слогов в минуту, acc — сколько слов расслышано, % (-1 — читал про себя)
  const MAX_READS = 500;
  function cleanReads(list) {
    return (Array.isArray(list) ? list : []).filter((r) => r && typeof r === 'object' && typeof r.t === 'string' && /^[\w-]{1,40}$/.test(r.t))
      .map((r) => ({ t: r.t, spm: int(r.spm, 1, 2000), acc: int(r.acc, -1, 100), at: Math.min(num(r.at), Date.now() + DAY) }))
      .filter((r) => r.at > 0).sort((a, b) => a.at - b.at).slice(-MAX_READS);
  }
  // рекорд «Найди пары» в мс: быстрее 3 секунд не бывает, а время из будущего не должно навсегда скрыть напоминание о копии
  const time = (v) => Math.min(num(v), Date.now() + 31 * DAY) || undefined;
  function cleanMeta(meta) { const m = meta || {}; return { matchBest: num(m.matchBest) ? int(m.matchBest, 3000, 36e5) : undefined, timedBest: int(m.timedBest, 0, 1e4) || undefined, backupAt: time(m.backupAt), backupHide: time(m.backupHide), intro: cleanIntro(m.intro) }; }
  function cleanSettings(s) {
    const d = empty().settings, x = Object.assign({}, d, s || {});
    return { rate: Math.min(1.5, Math.max(0.5, num(x.rate) || d.rate)), dailyGoal: int(x.dailyGoal, 5, 300), newPerDay: int(x.newPerDay, 3, 100), sessionLen: [10, 15, 25].includes(+x.sessionLen) ? +x.sessionLen : 15, romanize: !!x.romanize, typing: !!x.typing, keyboard: !!x.keyboard, theme: ['auto', 'light', 'dark'].includes(x.theme) ? x.theme : 'auto' };
  }
  const clean = (s) => ({ items: cleanItems(s.items), days: cleanDays(s.days), tests: cleanTests(s.tests), custom: cleanCustom(s.custom), meta: cleanMeta(s.meta), notes: cleanNotes(s.notes), reads: cleanReads(s.reads), settings: cleanSettings(s.settings) });

  let state;
  try { state = clean(JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { state = empty(); }

  let saveWarned = false;
  const save = () => {
    try { localStorage.setItem(KEY, JSON.stringify(state)); }
    catch { if (!saveWarned) { saveWarned = true; window.UI?.toast?.('Прогресс не сохраняется: в браузере закончилось место или запрещено хранение'); } }
  };
  const today = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD в местном времени

  function get(key) { return state.items[key]; }
  function box(key) { return state.items[key]?.box ?? -1; } // -1 — ещё не встречалось
  function isDue(key, now = Date.now()) { const it = state.items[key]; return !!it && it.due <= now; }

  // Отмена последнего ответа («Я промахнулся»): запоминаем задание и счётчики дня как были до него
  let undo = null;
  function remember(key) { const d = today(); undo = { key, item: key && state.items[key] ? { ...state.items[key] } : null, d, day: state.days[d] ? { ...state.days[d] } : null }; }
  function undoLast() {
    if (!undo) return false;
    const u = undo; undo = null;
    if (u.key) { if (u.item) state.items[u.key] = u.item; else delete state.items[u.key]; }
    if (u.day) state.days[u.d] = u.day; else delete state.days[u.d];
    save(); return true;
  }
  // fresh: первый ответ на новое слово (w:…) — для лимита новых слов в день
  function countDay(correct, fresh) {
    const d = today();
    const day = state.days[d] || { n: 0, ok: 0, nw: 0 };
    day.n++; if (correct) day.ok++; if (fresh) day.nw = (day.nw || 0) + 1;
    state.days[d] = day;
  }
  function answer(key, correct) {
    const now = Date.now();
    remember(key);
    const fresh = !state.items[key] && key.startsWith('w:');
    const it = state.items[key] || { box: 0, due: now, right: 0, wrong: 0 };
    // верный ответ раньше срока коробку не двигает: иначе пять тренировок за вечер дают интервал в неделю
    if (correct && it.due > now) { it.right++; it.last = now; state.items[key] = it; countDay(true); save(); return it; }
    if (correct) { it.right++; it.box = Math.min(MAX_BOX, it.box + 1); }
    else { it.wrong++; it.box = Math.max(0, it.box - 2); }
    it.due = now + INTERVALS[it.box];
    it.last = now;
    state.items[key] = it;
    countDay(correct, fresh); save();
    return it;
  }
  // Ответ засчитывается в цель дня, но коробку не двигает (повтор того же задания в одной сессии)
  function tally(correct) { remember(null); countDay(correct); save(); }
  // Оценка карточки как в Anki: 0 снова, 1 трудно, 2 хорошо, 3 легко
  function grade(key, g) {
    remember(key); const now = Date.now(); const fresh = !state.items[key] && key.startsWith('w:');
    const it = state.items[key] || { box: 0, due: now, right: 0, wrong: 0 };
    if (g === 0) { it.wrong++; it.box = 0; it.due = now; }
    else if (it.due > now) it.right++; // раньше срока: как в answer, коробка и срок не меняются
    else {
      it.right++;
      it.box = g === 1 ? Math.max(1, it.box) : Math.min(MAX_BOX, it.box + (g === 3 ? 2 : 1));
      it.due = now + INTERVALS[it.box] * (g === 1 ? 0.5 : 1);
    }
    it.last = now; state.items[key] = it;
    countDay(g > 0, fresh); save();
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
    get, box, isDue, answer, tally, grade, undoLast, forecastTomorrow, streak, lastDays, MAX_BOX,
    todayStats: () => state.days[today()] || { n: 0, ok: 0, nw: 0 },
    newToday: () => state.days[today()]?.nw || 0,
    settings: () => state.settings,
    // через cleanSettings: пустое поле цели не превратится в 0, скорость речи останется в пределах
    setSetting(k, v) { state.settings = cleanSettings({ ...state.settings, [k]: v }); save(); },
    getTest: (n) => state.tests?.[n] || null,
    setTest(n, pct) {
      const prev = state.tests[n];
      state.tests[n] = { best: Math.max(pct, prev?.best || 0), last: pct, date: today() }; save();
    },
    // Трудное: ошибок много и не меньше половины верных ответов (3 ошибки на 6 верных — трудное, на 10 — уже нет)
    isHard: (key) => { const s = state.items[key]; return !!s && s.wrong >= 3 && s.wrong * 2 >= s.right; },
    note: (ko) => state.notes?.[ko] || '',
    setNote(ko, text) { state.notes = state.notes || {}; const t = str(text, 200).trim(); if (t) state.notes[ko] = t; else delete state.notes[ko]; save(); },
    // свои слова
    custom: () => state.custom || [],
    // обрезаем так же, как при загрузке: иначе после перезагрузки слово и ключ его прогресса изменятся
    addCustom(w) { const c = cleanCustom([{ ...w, added: today() }])[0]; if (!c) return null; state.custom = (state.custom || []).filter((x) => x.ko !== c.ko); state.custom.push(c); save(); return c; },
    removeCustom(ko) { state.custom = (state.custom || []).filter((x) => x.ko !== ko); save(); },
    meta: (k) => state.meta?.[k],
    setMeta(k, v) { state.meta = state.meta || {}; state.meta[k] = v; save(); },
    intro: () => state.meta?.intro || null,
    setIntro(v) { state.meta = state.meta || {}; state.meta.intro = cleanIntro(v); save(); return state.meta.intro; },
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
      for (const [k, v] of Object.entries(other.notes)) if (!state.notes[k]) state.notes[k] = v;
      const seen = new Set(state.reads.map((r) => r.t + r.at)); state.reads = state.reads.concat(other.reads.filter((r) => !seen.has(r.t + r.at)));
      if (other.meta.intro?.name && !state.meta?.intro?.name) { state.meta = state.meta || {}; state.meta.intro = other.meta.intro; }
      state = clean(state); // общие пределы (число своих слов, подсказок) и после объединения
      // рекорды: в «Найди пары» лучше меньшее время, в «5 минутах» — больше ответов
      const om = other.meta; state.meta = state.meta || {};
      if (om.matchBest && (!state.meta.matchBest || om.matchBest < state.meta.matchBest)) state.meta.matchBest = om.matchBest;
      if (om.timedBest && om.timedBest > (state.meta.timedBest || 0)) state.meta.timedBest = om.timedBest;
      save();
    },
    reads: (t) => (t ? state.reads.filter((r) => r.t === t) : state.reads),
    // прочитал текст: в журнал скорости и в повторение (ключ txt:<id>, перечитать по интервалам; плохо расслышано — раньше)
    addRead(t, spm, acc) {
      const r = cleanReads([{ t, spm, acc, at: Date.now() }])[0]; if (!r) return null;
      state.reads.push(r); state.reads = cleanReads(state.reads);
      answer('txt:' + r.t, r.acc < 0 || r.acc >= 80);
      return r;
    },
    keys: () => Object.keys(state.items),
    // Компактная строка для ссылки переноса (без настроек)
    async pack() {
      const json = JSON.stringify({ items: state.items, days: state.days, tests: state.tests || {}, custom: state.custom || [], notes: state.notes || {}, reads: state.reads || [], meta: { matchBest: state.meta?.matchBest, timedBest: state.meta?.timedBest, intro: state.meta?.intro } });
      let bytes = new TextEncoder().encode(json), z = '0';
      if (window.CompressionStream) { bytes = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); z = '1'; }
      let bin = ''; bytes.forEach((b) => (bin += String.fromCharCode(b)));
      return z + btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    },
    async unpack(str) {
      const LIMIT = 4e6; // настоящий прогресс — десятки КБ; больше — испорченная или подделанная ссылка
      if (str.length > LIMIT) throw new Error('Слишком длинная ссылка');
      const z = str[0], b64 = str.slice(1).replace(/-/g, '+').replace(/_/g, '/');
      let bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      if (z === '1') {
        // распаковка по кускам с отсечкой: маленькая ссылка не должна развернуться в гигабайты
        const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')).getReader();
        const parts = []; let size = 0;
        for (;;) {
          const { done, value } = await reader.read(); if (done) break;
          size += value.length; if (size > LIMIT) { reader.cancel(); throw new Error('Слишком большой прогресс'); }
          parts.push(value);
        }
        bytes = new Uint8Array(size); let o = 0; parts.forEach((p) => { bytes.set(p, o); o += p.length; });
      }
      return JSON.parse(new TextDecoder().decode(bytes));
    },
    reset() { state = empty(); save(); },
  };
})();
