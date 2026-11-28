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

  const ENDINGS = new Set(['', '은', '는', '이', '가', '을', '를', '의', '도', '에', '에서', '에게', '한테', '하고', '이랑', '랑', '과', '와', '만', '로', '으로', '요', '이요',
    '이에요', '예요', '이에요?', '예요?', '이세요', '세요', '입니다', '입니까', '이야', '야', '이고', '고', '이지만', '지만', '씨', '씨는', '씨가', '씨도', '씨예요', '씨의']);

  // Окончания в текстах для чтения: что показать при нажатии на слово (длинные раньше коротких)
  const SUFFIX = [['이에요', 'связка «есть, это» (после согласной)'], ['예요', 'связка «есть, это» (после гласной)'], ['은요', '«а …?» — встречный вопрос'], ['는요', '«а …?» — встречный вопрос'],
    ['은', 'частица темы: о ком или о чём речь (после согласной)'], ['는', 'частица темы: о ком или о чём речь (после гласной)'], ['이', 'частица подлежащего (после согласной)'], ['가', 'частица подлежащего (после гласной)']];

  const DB = {
    lessons, entries: [], byKo: new Map(),
    async load() {
      for (const id of window.LESSON_FILES) await loadScript(`data/lessons/${id}.js`);
      lessons.sort((a, b) => a.number - b.number);
      for (const l of lessons) {
        l.words = l.words || []; l.phrases = l.phrases || []; l.grammar = l.grammar || []; l.dialogues = l.dialogues || []; l.hangul = l.hangul || []; l.texts = l.texts || [];
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
      if (f.hard && !Store.isHard(e.key)) return false;
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
    // Тексты для чтения: написанные к уроку (texts) и «Слова урока N» на скорость — новые слова урока строками по 6
    texts(nums) {
      return lessons.filter((l) => nums.includes(l.number)).flatMap((l) => {
        const own = l.texts.map((t) => ({ ...t, lesson: l.number }));
        const words = DB.entries.filter((e) => e.lesson === l.number && e.kind === 'word' && /^[가-힣]+$/.test(e.ko)).slice(0, 30);
        if (words.length < 8) return own;
        const lines = [];
        for (let i = 0; i < words.length; i += 6) { const ch = words.slice(i, i + 6); lines.push({ ko: ch.map((e) => e.ko).join(' '), ru: ch.map((e) => e.ru.split(/[,;(]/)[0].trim()).join(', ') }); }
        return [...own, { id: 'words-' + l.number, title: 'Слова урока ' + l.number, words: true, lesson: l.number, lines }];
      });
    },
    text: (id) => DB.texts(DB.allNums()).find((t) => t.id === id) || null,
    // Строка текста по словам для чтения с подсказками: основа из словаря + окончание (사람이에요 → 사람 + 이에요).
    // Два слова подряд, если это одно слово словаря (이 사람은 → 이 사람 + 은). names — имена из текста.
    parseLine(ko, names = {}) {
      const raw = ko.split(/\s+/).filter(Boolean), out = [];
      const word = (b) => { const e = DB.byKo.get(b); return e && e.kind === 'word' ? e : null; };
      const find = (r, span) => {
        const bare = r.replace(/[.,!?…«»"]/g, '');
        if (names[bare]) return { base: bare, ru: names[bare] + ' (имя)', name: true };
        if (word(bare)) return { base: bare, ru: word(bare).ru, entry: word(bare) };
        // число хангылем (사천, 오천오백): слова такого в словаре нет, показываем значение
        const num = (b) => { const v = window.Numbers && Numbers.parseSino(b); return v && [...b].length > 1 ? { base: b, ru: 'число ' + v, num: true } : null; };
        if (num(bare)) return num(bare);
        for (const [suf, about] of SUFFIX) {
          if (!bare.endsWith(suf) || bare.length <= suf.length) continue;
          const b = bare.slice(0, -suf.length);
          if (names[b]) return { base: b, ru: names[b] + ' (имя)', name: true, suf, sufRu: about };
          if (word(b)) return { base: b, ru: word(b).ru, entry: word(b), suf, sufRu: about };
          if (num(b)) return { ...num(b), suf, sufRu: about };
        }
        if (span) return null;
        const p = DB.byKo.get(r) || DB.byKo.get(bare);
        return p ? { base: p.ko, ru: p.ru, entry: p } : null;
      };
      for (let i = 0; i < raw.length; i++) {
        const two = i + 1 < raw.length && find(raw[i] + ' ' + raw[i + 1], true);
        if (two) { out.push({ text: raw[i] + ' ' + raw[i + 1], ...two }); i++; continue; }
        out.push({ text: raw[i], ...(find(raw[i]) || { base: raw[i].replace(/[.,!?…«»"]/g, ''), ru: '' }) });
      }
      return out;
    },
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
      // своё слово, которое есть и в позднем уроке (학생 из урока 4), этот урок не начинает
      const mine = new Set(DB.entries.filter((e) => e.mine).map((e) => e.key));
      const started = nums.filter((n) => Store.getTest(n) || DB.lessonKeys(n).some((k) => !mine.has(k) && Store.get(k)));
      const current = started.length ? Math.max(...started) : nums[0];
      const next = DB.passed(current) ? nums[nums.indexOf(current) + 1] ?? null : null;
      return { current, next, fresh: !started.length };
    },
    // Уроки, открытые на пути (до текущего включительно) и свои слова: по ним идёт тренировка без выбора уроков
    openNums() {
      const { current } = DB.path();
      return [...lessons.filter((l) => l.number <= current).map((l) => l.number), ...(Store.custom().length ? [0] : [])];
    },
    // Слово встречается в предложении: целым словом или с частицей/связкой (이 «два» не находится в 이름이 뭐예요?)
    inSentence(ko, sentence) {
      const toks = sentence.replace(/[.,!?…«»"]/g, ' ').split(/\s+/).filter(Boolean), w = ko.replace(/[.,!?]/g, '').split(/\s+/).filter(Boolean);
      if (!w.length) return false;
      const last = w[w.length - 1];
      for (let i = 0; i + w.length <= toks.length; i++) {
        if (!w.slice(0, -1).every((x, k) => toks[i + k] === x)) continue;
        const t = toks[i + w.length - 1];
        if (t.startsWith(last) && ENDINGS.has(t.slice(last.length))) return true;
      }
      return false;
    },
    categories: () => [...new Set(DB.entries.map((e) => e.c))].sort((a, b) => a.localeCompare(b, 'ru')),
  };
  window.DB = DB;
})();
