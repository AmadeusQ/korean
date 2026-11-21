// Загрузка уроков и сборка общего словаря.
(function () {
  const lessons = [];
  window.registerLesson = (l) => lessons.push(l);

  function loadScript(src) {
    return new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = src; s.onload = res; s.onerror = () => rej(new Error('Не загрузился ' + src));
      document.head.appendChild(s);
    });
  }

  const DB = {
    lessons, entries: [], byKo: new Map(),
    async load() {
      for (const id of window.LESSON_FILES) await loadScript(`data/lessons/${id}.js`);
      lessons.sort((a, b) => a.number - b.number);
      for (const l of lessons) {
        l.words = l.words || []; l.phrases = l.phrases || []; l.grammar = l.grammar || []; l.dialogues = l.dialogues || []; l.hangul = l.hangul || [];
        const add = (w, kind) => {
          const prev = DB.byKo.get(w.ko);
          if (prev) { if (!prev.lessons.includes(l.number)) prev.lessons.push(l.number); return; }
          const e = { ...w, kind, key: 'w:' + w.ko, lesson: l.number, lessons: [l.number], c: w.c || (kind === 'phrase' ? 'Фразы' : 'Другое') };
          DB.byKo.set(w.ko, e); DB.entries.push(e);
        };
        l.words.forEach((w) => add(w, 'word'));
        l.phrases.forEach((w) => add(w, 'phrase'));
      }
      Store.custom().forEach((w) => DB.addCustom(w, false));
    },
    // Свои слова живут как «урок 0»
    addCustom(w, persist = true) {
      if (persist) { w = Store.addCustom(w); if (!w) return null; }
      const prev = DB.byKo.get(w.ko);
      if (prev) { if (!prev.lessons.includes(0)) prev.lessons.push(0); prev.mine = true; return prev; }
      const e = { ...w, kind: /\s/.test(w.ko) ? 'phrase' : 'word', key: 'w:' + w.ko, lesson: 0, lessons: [0], c: w.c || 'Мои слова', mine: true, t: w.t || (/다$/.test(w.ko) ? 'v' : undefined) };
      DB.byKo.set(w.ko, e); DB.entries.push(e); return e;
    },
    removeCustom(ko) {
      Store.removeCustom(ko);
      const e = DB.byKo.get(ko); if (!e) return;
      e.lessons = e.lessons.filter((n) => n !== 0); e.mine = false;
      if (!e.lessons.length) { DB.byKo.delete(ko); DB.entries.splice(DB.entries.indexOf(e), 1); }
    },
    // фильтр словаря: тема c и поиск q (по-корейски, по-русски или латиницей)
    matches(e, f = {}) {
      if (f.c && e.c !== f.c) return false;
      const q = (f.q || '').trim().toLowerCase();
      return !q || e.ko.includes(q) || e.ru.toLowerCase().includes(q) || Hangul.romanize(e.ko).includes(q.replace(/[\s-]/g, ''));
    },
    allNums: () => [...DB.lessons.map((l) => l.number), ...(Store.custom().length ? [0] : [])],
    lesson: (n) => lessons.find((l) => l.number === +n),
    photos: (l) => Array.from({ length: l.photos || 0 }, (_, i) => `materials/${l.id}/${String(i + 1).padStart(2, '0')}.jpg`),
    entriesFor: (nums) => DB.entries.filter((e) => e.lessons.some((n) => nums.includes(n))),
    hangulUnits(nums) {
      const set = new Set();
      lessons.filter((l) => nums.includes(l.number)).forEach((l) => l.hangul.forEach((u) => set.add(u)));
      return [...set];
    },
    grammar(nums) { return lessons.filter((l) => nums.includes(l.number)).flatMap((l) => l.grammar.map((g) => ({ ...g, lesson: l.number }))); },
    dialogues(nums) { return lessons.filter((l) => nums.includes(l.number)).flatMap((l) => l.dialogues.map((d) => ({ ...d, lesson: l.number }))); },
    // Задания, которые урок открывает впервые: его новые слова и фразы, новые буквы хангыля
    lessonKeys(n) {
      const l = DB.lesson(n); if (!l) return [];
      const before = new Set(DB.hangulUnits(lessons.filter((x) => x.number < n).map((x) => x.number)));
      const keys = DB.entries.filter((e) => e.lesson === l.number).map((e) => e.key);
      l.hangul.filter((u) => !before.has(u)).forEach((u) => (Hangul.UNITS[u]?.items || []).forEach((it) => keys.push('j:' + it[0])));
      // урок-повторение без нового материала: считаем все его слова и фразы
      if (!keys.length) DB.entries.filter((e) => e.lessons.includes(l.number)).forEach((e) => keys.push(e.key));
      return [...new Set(keys)];
    },
    mastery: (keys) => (keys.length ? keys.reduce((s, k) => s + Math.max(0, Store.box(k)), 0) / (keys.length * Store.MAX_BOX) : 0),
    // Урок освоен: контрольная от 80% или задания урока в среднем во 2–3 коробке
    passed(n) { const t = Store.getTest(n); return (!!t && t.best >= 80) || DB.mastery(DB.lessonKeys(n)) >= 0.4; },
    // Путь по урокам: текущий — последний начатый (новичку первый), следующий — когда текущий освоен
    path() {
      const nums = lessons.map((l) => l.number);
      const started = nums.filter((n) => Store.getTest(n) || DB.lessonKeys(n).some((k) => Store.get(k)));
      const current = started.length ? Math.max(...started) : nums[0];
      const next = DB.passed(current) ? nums[nums.indexOf(current) + 1] ?? null : null;
      return { current, next, fresh: !started.length };
    },
    // Уроки, открытые на пути (до текущего включительно) и свои слова: по ним идёт тренировка без выбора уроков
    openNums() {
      const { current } = DB.path();
      return [...lessons.filter((l) => l.number <= current).map((l) => l.number), ...(Store.custom().length ? [0] : [])];
    },
    categories: () => [...new Set(DB.entries.map((e) => e.c))].sort((a, b) => a.localeCompare(b, 'ru')),
  };
  window.DB = DB;
})();
