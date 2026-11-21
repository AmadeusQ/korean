// Упражнения: генерация вопросов и экран тренировки.
(function () {
  const { esc, shuffle, pick, uniqBy, icon, sayBtn } = UI;
  const H = Hangul;

  const MODES = {
    mix: { title: 'Всё вперемешку', desc: 'Слова, хангыль, грамматика и фразы', ex: '섞기' },
    words: { title: 'Слова', desc: 'Перевод в обе стороны и набор', ex: '책' },
    cards: { title: 'Карточки', desc: 'Вспомни перевод и оцени себя', ex: '카드' },
    listen: { title: 'Аудирование', desc: 'Услышь и выбери, что прозвучало', ex: '듣기', tts: true },
    sounds: { title: 'Похожие звуки', desc: 'Различай на слух 가/카/까 и 부리/뿌리', ex: '불·뿔', tts: true },
    hangul: { title: 'Хангыль', desc: 'Буквы, слоги и патчим', ex: 'ㄱ+ㅏ' },
    grammar: { title: 'Грамматика', desc: '이에요 / 예요, 은 / 는, ответ 네 / 아니요', ex: '-예요' },
    build: { title: 'Фразы', desc: 'Собери фразу и вставь пропущенное слово', ex: '저는…' },
    translate: { title: 'Составь предложение', desc: 'Переведи с русского: слова и частицы по отдельности', ex: '은/는' },
    read: { title: 'Прочитай и ответь', desc: 'Короткий текст или диалог и вопрос по нему', ex: '읽기' },
    match: { title: 'Найди пары', desc: 'Соедини слова с переводом на время', ex: '짝' },
    timed: { title: '5 минут', desc: 'Сколько успеешь за пять минут', ex: '5분' },
    numbers: { title: 'Числа', desc: '일, 이, 삼 и 하나, 둘, 셋', ex: '123' },
    shadow: { title: 'Повтори за диктором', desc: 'Послушай фразу и скажи её вслух', ex: '따라', mic: true },
    dialog: { title: 'Ролевой диалог', desc: 'Отвечай за собеседника по ходу разговора', ex: '대화' },
    write: { title: 'Прописи', desc: 'Пиши буквы и слова в клетках', ex: '쓰기' },
    speak: { title: 'Произношение', desc: 'Скажи слово вслух в микрофон', ex: '말하기', mic: true },
    mistakes: { title: 'Мои ошибки', desc: 'Только то, в чём ошибаешься', ex: '오답', hidden: true },
    test: { title: 'Контрольная', desc: '20 вопросов по уроку без повторов', ex: '시험', hidden: true },
  };
  // «Перед тобой: …» — только то, что можно показать (не «низ» или «причина»)
  const YESNO_C = ['Вещи', 'Еда', 'Животные', 'Природа', 'Профессии', 'Люди', 'Тело'];
  const showable = (e) => e.kind === 'word' && !e.t && !/\s/.test(e.ko) && YESNO_C.includes(e.c) && (e.c !== 'Люди' || e.p);
  const SESSION_LEN = 15, TEST_LEN = 20, FILTER_LEN = 30; // выборка из словаря: до 30 слов за раз
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micSupported = () => !!SR;

  // ---------- пул заданий ----------
  function unlocked(nums) {
    const units = DB.hangulUnits(nums); const vowels = [], cons = [];
    units.forEach((u) => { const U = H.UNITS[u]; (U.items || []).forEach((it) => (U.kind === 'vowel' ? vowels : cons).push(it[0])); });
    return { units, vowels, cons };
  }

  // слабые места: были ошибки и слово ещё плохо закреплено
  const isMistake = (key) => { const s = Store.get(key); return !!s && s.wrong > 0 && s.box <= 2; };

  function buildPool(mode, nums) {
    if (mode === 'mistakes') return Store.keys().filter(isMistake).map((k) => resolveKey(k, nums)).filter(Boolean);
    if (mode === 'test') return buildPool('mix', nums);
    if (mode === 'write') {
      const J = unlocked(nums); const out = [];
      [...J.vowels, ...J.cons].forEach((j) => out.push({ group: 'write', key: 'write:j:' + j, types: ['write'], target: j, jamo: true }));
      DB.entriesFor(nums).filter((e) => e.kind === 'word' && /^[가-힣]{1,3}$/.test(e.ko))
        .forEach((e) => out.push({ group: 'write', key: 'write:' + e.ko, types: ['write'], target: e.ko, entry: e }));
      return out;
    }
    if (mode === 'speak') {
      return micSupported() ? DB.entriesFor(nums).filter((e) => [...e.ko].length <= 12)
        .map((e) => ({ group: 'speak', key: 'speak:' + e.ko, types: ['speak'], entry: e })) : [];
    }
    if (mode === 'sounds') {
      if (!TTS.available()) return [];
      const J = unlocked(nums);
      return [
        ...DB.entriesFor(nums).filter((e) => e.kind === 'word' && soundAlikes(e.ko).length >= 2).map((e) => ({ group: 'words', key: e.key, types: ['listen-pair'], entry: e })),
        ...[...J.cons, ...J.vowels].map((j) => ({ group: 'hangul', key: 'j:' + j, types: ['listen-syll'], jamo: j, J })),
      ];
    }
    if (mode === 'dialog') return dialogLines(nums);
    if (mode === 'read') return readItems(nums);
    if (mode === 'timed') return buildPool('mix', nums);
    if (mode === 'match') return buildPool('words', nums).filter((it) => it.entry.kind === 'word' && [...it.entry.ko].length <= 6);
    if (mode === 'numbers') return ['s', 'n'].flatMap((sys) => Numbers.sample(sys, 12).map((n) => numItem(sys, n)));
    if (mode === 'shadow') return micSupported() ? sentenceLines(nums).map((l) => ({ group: 'build', key: 'shadow:' + l.ko, types: ['shadow'], line: l })) : [];
    const tts = TTS.available();
    const typing = Store.settings().typing;
    const entries = DB.entriesFor(nums);
    const pool = [];
    const add = (group, key, types, extra) => { if (types.length) pool.push({ group, key, types, ...extra }); };

    if (['mix', 'words', 'listen', 'cards'].includes(mode)) {
      for (const e of entries) {
        let t;
        if (mode === 'cards') t = ['card'];
        else if (mode === 'listen') t = tts ? ['listen-word'] : [];
        else {
          t = ['ko-ru', 'ru-ko'];
          if (typing && e.kind === 'word' && [...e.ko].length <= 5) t.push('type');
          if (mode === 'mix' && tts) t.push('listen-word');
        }
        if (tts && mode !== 'cards' && mode !== 'words' && e.kind === 'word' && soundAlikes(e.ko).length >= 2) t.push('listen-pair');
        add('words', e.key, t, { entry: e });
      }
    }
    const J = unlocked(nums);
    if (['mix', 'hangul', 'listen'].includes(mode)) {
      for (const j of [...J.vowels, ...J.cons]) {
        let t = mode === 'listen' ? [] : ['jamo-read', 'syll-read', 'compose'];
        if (mode !== 'listen' && J.units.includes('names') && H.NAMES[j]) t.push('jamo-name');
        if (tts) t.push('listen-syll');
        add('hangul', 'j:' + j, t, { jamo: j, J });
      }
      if (mode !== 'listen' && J.units.includes('batchim')) {
        entries.filter((e) => e.kind === 'word' && /^[가-힣]{1,2}$/.test(e.ko) && H.hasBatchim(e.ko))
          .forEach((e) => add('hangul', 'b:' + e.ko, ['batchim'], { entry: e }));
      }
    }
    if (['mix', 'grammar'].includes(mode)) {
      const gids = DB.grammar(nums).map((g) => g.id);
      const nouns = entries.filter((e) => e.kind === 'word' && !e.t);
      const persons = entries.filter((e) => e.p), jobs = entries.filter((e) => e.job);
      if (gids.includes('copula')) shuffle(nouns).slice(0, 25).forEach((e) => add('grammar', 'g:copula:' + e.ko, ['copula'], { entry: e }));
      if (gids.includes('yesno')) shuffle(nouns.filter(showable)).slice(0, 20).forEach((e) => add('grammar', 'g:yesno:' + e.ko, ['yesno'], { entry: e }));
      if (gids.includes('topic')) {
        shuffle([...persons, ...nouns]).slice(0, 20).forEach((e) => add('grammar', 'g:topic:' + e.ko, ['topic'], { entry: e }));
        for (let i = 0; i < 12 && persons.length && jobs.length; i++) {
          const p = pick(persons), jb = pick(jobs);
          add('grammar', 'g:sent:' + p.ko + '|' + jb.ko, ['sentence'], { p, jb });
        }
      }
    }
    if (['mix', 'build'].includes(mode)) {
      const lines = sentenceLines(nums, true);
      lines.forEach((l) => add('build', 'build:' + l.ko, ['build'], { line: l }));
      lines.forEach((l) => { const c = clozeTarget(l); if (c) add('build', 'cloze:' + l.ko, ['cloze'], { line: l, ...c }); });
      if (mode === 'mix') pool.push(...dialogLines(nums), ...readItems(nums));
    }
    if (['mix', 'translate'].includes(mode)) {
      translateLines(nums).forEach((l) => add('build', 'tr:' + l.ko, ['translate'], { line: l, toks: l.toks }));
      if (DB.grammar(nums).some((g) => g.id === 'topic')) {
        const persons = entries.filter((e) => e.p), jobs = entries.filter((e) => e.job);
        for (let i = 0; i < 10 && persons.length && jobs.length; i++) {
          const l = pairLine(pick(persons), pick(jobs));
          add('build', 'tr:' + l.ko, ['translate'], { line: l, toks: l.toks });
        }
      }
    }
    return uniqBy(pool, (p) => p.key);
  }

  // Числа помним по диапазонам, а не по каждому числу: иначе хранилище и ссылка переноса разрастаются
  const numBucket = (n) => (n <= 10 ? 'small' : n < 100 ? 'mid' : 'big');
  const numItem = (sys, n) => ({ group: 'numbers', key: `num:${sys}:${numBucket(n)}`, uid: `num:${sys}:${n}`, types: TTS.available() ? ['num-read', 'num-value', 'num-listen'] : ['num-read', 'num-value'], sys, n });

  // Ключ из хранилища → задание (для «Моих ошибок»). null, если материала уже нет или он вне выбранных уроков.
  function resolveKey(key, nums) {
    const inLessons = (e) => e && e.lessons.some((n) => nums.includes(n));
    const J = unlocked(nums); const tts = TTS.available();
    const [kind, ...rest] = key.split(':'); const arg = rest.join(':');
    const word = (ko) => { const e = DB.byKo.get(ko); return inLessons(e) ? e : null; };
    switch (kind) {
      case 'w': { const e = word(arg); if (!e) return null;
        const t = ['ko-ru', 'ru-ko']; if (Store.settings().typing && e.kind === 'word' && [...e.ko].length <= 5) t.push('type'); if (tts) t.push('listen-word');
        if (tts && e.kind === 'word' && soundAlikes(e.ko).length >= 2) t.push('listen-pair');
        return { group: 'words', key, types: t, entry: e }; }
      case 'j': return J.vowels.concat(J.cons).includes(arg) ? { group: 'hangul', key, types: ['jamo-read', 'syll-read', 'compose'].concat(H.NAMES[arg] && J.units.includes('names') ? ['jamo-name'] : []), jamo: arg, J } : null;
      case 'b': { const e = word(arg); return e ? { group: 'hangul', key, types: ['batchim'], entry: e } : null; }
      case 'g': {
        const [gid, ...g] = rest; const val = g.join(':');
        if (gid === 'copula' || gid === 'topic' || gid === 'yesno') { const e = word(val); return e ? { group: 'grammar', key, types: [gid], entry: e } : null; }
        if (gid === 'sent') { const [pk, jk] = val.split('|'); const p = word(pk), jb = word(jk); return p?.p && jb?.job ? { group: 'grammar', key, types: ['sentence'], p, jb } : null; }
        return null;
      }
      case 'build': { const l = sentenceLines(nums, true).find((x) => x.ko === arg); return l ? { group: 'build', key, types: ['build'], line: l } : null; }
      case 'cloze': { const l = sentenceLines(nums, true).find((x) => x.ko === arg); const c = l && clozeTarget(l); return c ? { group: 'build', key, types: ['cloze'], line: l, ...c } : null; }
      case 'tr': {
        const l = translateLines(nums).find((x) => x.ko === arg);
        if (l) return { group: 'build', key, types: ['translate'], line: l, toks: l.toks };
        // предложение «X은/는 Y이에요» собиралось из слов урока, а не из готовых фраз
        const m = arg.match(/^(.+?)(은|는) (.+)(이에요|예요)\.$/); const p = m && word(m[1]), jb = m && word(m[3]);
        if (!p || !jb || !p.p || !jb.job) return null;
        const pl = pairLine(p, jb); return { group: 'build', key, types: ['translate'], line: pl, toks: pl.toks };
      }
      case 'rd': return readItems(nums).find((x) => x.key === key) || null;
      case 'dl': { for (const d of DB.dialogues(nums)) { const i = d.lines.findIndex((l, k) => k > 0 && l.ko === arg); if (i > 0) return { group: 'build', key, types: ['dialog-line'], dlg: d, i }; } return null; }
      case 'write': {
        if (rest[0] === 'j') { const j = rest.slice(1).join(':'); return J.vowels.concat(J.cons).includes(j) ? { group: 'write', key, types: ['write'], target: j, jamo: true } : null; }
        const e = word(arg); return e ? { group: 'write', key, types: ['write'], target: e.ko, entry: e } : null;
      }
      case 'speak': { const e = word(arg); return e && micSupported() ? { group: 'speak', key, types: ['speak'], entry: e } : null; }
      case 'shadow': { const l = sentenceLines(nums).find((x) => x.ko === arg); return l && micSupported() ? { group: 'build', key, types: ['shadow'], line: l } : null; }
      case 'num': {
        const [sys, b] = rest; if (!Numbers.SYSTEMS[sys]) return null;
        const max = sys === 'n' ? 99 : 9999; const r = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
        const n = b === 'small' ? r(1, 10) : b === 'mid' ? r(11, 99) : b === 'big' && max > 99 ? r(100, 2000) : null;
        return n ? numItem(sys, n) : null;
      }
      default: return null;
    }
  }

  // фразы из уроков, диалогов и примеров грамматики (от двух слов)
  // «안녕하세요? 저는 안나예요.» → два предложения, если русский перевод делится так же
  const sentences = (s) => (s.match(/[^.?!]+[.?!]*/g) || []).map((x) => x.trim()).filter(Boolean);
  function splitLine(l) {
    const k = sentences(l.ko), r = sentences(l.ru);
    return k.length > 1 && k.length === r.length ? k.map((ko, i) => ({ ko, ru: r[i] })) : [l];
  }
  // split: для сборки фраз — каждое предложение отдельным заданием (без знаков на плашках граница между ними терялась)
  function sentenceLines(nums, split = false) {
    let lines = [
      ...DB.entriesFor(nums).filter((e) => e.kind === 'phrase').map((e) => ({ ko: e.ko, ru: e.ru })),
      ...DB.dialogues(nums).flatMap((d) => d.lines.map((l) => ({ ko: l.ko, ru: l.ru }))),
      ...DB.grammar(nums).flatMap((g) => g.examples.map((x) => ({ ko: x.ko, ru: x.ru }))),
    ];
    if (split) lines = lines.flatMap(splitLine);
    return uniqBy(lines, (l) => l.ko).filter((l) => l.ko.trim().split(/\s+/).length >= 2);
  }
  // «Составь предложение»: частицы 은/는 и связка 이에요/예요 отдельными плашками, к ним пара-обманка
  const PAIR = { 은: '는', 는: '은', 이에요: '예요', 예요: '이에요' };
  function splitParticles(ko) {
    const out = []; let n = 0;
    for (const raw of ko.trim().split(/\s+/)) {
      const t = raw.replace(/[.,!?]/g, ''); if (!t) continue;
      const cop = t.match(/^(.+?)(이에요|예요)$/), top = t.match(/^(.+)(은|는)$/);
      if (cop && /[가-힣]$/.test(cop[1])) { out.push(cop[1], cop[2]); n++; }
      else if (top && DB.byKo.has(top[1])) { out.push(top[1], top[2]); n++; }
      else out.push(t);
    }
    return n ? out : null;
  }
  function translateLines(nums) {
    if (!DB.grammar(nums).some((g) => g.id === 'copula' || g.id === 'topic')) return [];
    return sentenceLines(nums, true).map((l) => ({ ...l, toks: splitParticles(l.ko) })).filter((l) => l.toks && l.toks.length <= 8);
  }
  // «младший брат / сестра» → «младший брат», «я (вежливо)» → «я»
  const shortRu = (s) => s.replace(/\s*\(.*?\)/g, '').split(/\s*[/,]\s*/)[0].trim();
  function pairLine(p, jb) {
    const ko = `${p.ko}${H.topic(p.ko)} ${jb.ko}${H.copula(jb.ko)}.`, a = shortRu(p.ru);
    return { ko, ru: `${a[0].toUpperCase()}${a.slice(1)}${p.t === 'pron' ? '' : ' —'} ${shortRu(jb.ru)}.`, toks: splitParticles(ko) };
  }

  // какое слово из словаря можно убрать из фразы: 학생이에요 → ＿＿이에요 (학생)
  function clozeTarget(l) {
    const tokens = l.ko.split(/\s+/); let best = null;
    tokens.forEach((t, i) => {
      const bare = t.replace(/[.,!?]/g, '');
      DB.entries.forEach((e) => {
        // служебные слова не убираем: 마리 «штук» совпадало с именем Мари
        if (e.kind !== 'word' || ['cnt', 'suf', 'num'].includes(e.t) || !bare.startsWith(e.ko) || [...e.ko].length < (bare === e.ko ? 1 : 2)) return;
        if (!best || e.ko.length > best.entry.ko.length) best = { entry: e, ti: i };
      });
    });
    return best;
  }

  // реплики диалогов (кроме первой): ответить за собеседника
  function dialogLines(nums) {
    return DB.dialogues(nums).flatMap((d) => d.lines.slice(1).map((l, k) => ({ group: 'build', key: 'dl:' + l.ko, types: ['dialog-line'], dlg: d, i: k + 1 })));
  }
  // для режима диалога: 1–2 случайных диалога целиком, по порядку реплик
  // «Прочитай и ответь»: вопросы на понимание из dialogues[].questions
  function readItems(nums) {
    return DB.dialogues(nums).flatMap((d) => (d.questions || []).map((q) => ({ group: 'build', key: 'rd:' + q.q, types: ['read'], dlg: d, rq: q })));
  }
  function dialogQueue(nums) {
    const ds = shuffle(DB.dialogues(nums).filter((d) => d.lines.length > 1)).slice(0, 2); // из одной реплики вопроса не выйдет
    return ds.flatMap((d) => d.lines.slice(1).map((l, k) => ({ group: 'build', key: 'dl:' + l.ko, types: ['dialog-line'], dlg: d, i: k + 1 })));
  }

  function choose(pool, n, mode) {
    const now = Date.now();
    const score = (it) => {
      const s = Store.get(it.key);
      if (!s) return 1 + Math.random() * 1.5;
      if (s.due <= now) return 2 + (Store.MAX_BOX - s.box) * 0.3 + Math.random();
      return Math.random() * 0.8;
    };
    const ranked = pool.map((it) => ({ it, s: score(it) })).sort((a, b) => b.s - a.s).map((x) => x.it);
    const quotas = mode === 'mix' ? { words: 0.45, hangul: 0.25, grammar: 0.15, build: 0.15 } : null;
    const out = [];
    if (quotas) {
      for (const [g, q] of Object.entries(quotas)) out.push(...ranked.filter((it) => it.group === g).slice(0, Math.round(n * q)));
    }
    for (const it of ranked) { if (out.length >= n) break; if (!out.includes(it)) out.push(it); }
    return shuffle(out.slice(0, n));
  }

  // ---------- генераторы вопросов ----------
  function fillDistractors(correct, prefer, all, n, keyFn) {
    const k = keyFn(correct); const seen = new Set([k]); const out = [];
    const kind = correct.kind ? DB.entries.filter((x) => x.kind === correct.kind) : [];
    for (const src of [shuffle(prefer), shuffle(all), shuffle(kind), shuffle(DB.entries)]) for (const x of src) {
      if (out.length >= n) break; const kx = keyFn(x); if (seen.has(kx)) continue;
      if (x.ru === correct.ru || x.ko === correct.ko) continue; // синоним с тем же переводом был бы вторым верным ответом
      seen.add(kx); out.push(x);
    }
    return out;
  }
  const numExplain = (it) => { const S = Numbers.SYSTEMS[it.sys]; const r = S.read(it.n); return `<div class="ex-line"><b>${it.n}</b> = <span class="ko">${r}</span>${sayBtn(r, 'sm')}</div><div class="ex-ru">${S.title}: ${S.use}</div><div class="ex-rule"><button type="button" class="link" data-rule="numbers">Как устроены числа →</button></div>`; };
  const ruleBtn = (id) => `<button type="button" class="link" data-rule="${id}">Правило →</button>`;
  const entryExplain = (e) => `<div class="ex-line"><span class="ko">${esc(e.ko)}</span>${UI.rr(e.ko)}${sayBtn(e.ko, 'sm')}</div><div class="ex-ru">${esc(e.ru)}</div>`;
  // Знаки препинания в вариантах и плашках подсказывали ответ (вопрос — тот, что с «?», плашка с точкой — последняя)
  const bare = (s) => s.replace(/[.,!?…]/g, '').replace(/\s+/g, ' ').trim();
  const tail = (s) => s.replace(/[.?!…]+$/, '');
  // большая кнопка «послушать» и под ней «медленнее»
  const listenBtns = (ko, hint) => `<button class="big-say" data-say="${esc(ko)}">${icon('speaker')}</button><button type="button" class="link slow-say" data-say="${esc(ko)}" data-slow="1">Медленнее</button><div class="hint">${hint}</div>`;
  const sameKind = (e) => DB.entries.filter((x) => x.kind === e.kind);
  const lenNear = (e) => sameKind(e).filter((x) => Math.abs([...x.ko].length - [...e.ko].length) <= 1);

  function variants(j, J, n = 3) {
    const info = H.jamoInfo(j); const same = info.kind === 'vowel' ? J.vowels : J.cons;
    const sim = H.similarTo(j).filter((x) => same.includes(x));
    return uniqBy([...shuffle(sim), ...shuffle(same)].filter((x) => x !== j), (x) => x).slice(0, n);
  }
  const HOMOPHONES = [['ㅙ', 'ㅚ', 'ㅞ'], ['ㅐ', 'ㅔ'], ['ㅒ', 'ㅖ']];
  const soundsSame = (a, b, cons) => HOMOPHONES.some((g) => g.includes(a) && g.includes(b))
    || (cons !== 'ㅇ' && [a, b].includes('ㅢ') && [a, b].includes('ㅣ'))
    || (cons !== 'ㅇ' && cons !== 'ㄹ' && [a, b].every((x) => ['ㅐ', 'ㅔ', 'ㅒ', 'ㅖ'].includes(x))); // 계 звучит как 게
  // Похожие на слух слова: в одном слоге согласная заменена на парную (부리 → 뿌리, 푸리) или гласная на близкую (나무 → 너무).
  // Согласную после патчима не меняем: там ㄱ и ㄲ звучат одинаково (학교 [학꾜]). Настоящие слова из словаря — первыми.
  function soundAlikes(ko) {
    const s = [...ko];
    if (s.length > 4 || !s.every(H.isSyllable)) return [];
    const out = [];
    const swap = (i, ch) => s.slice(0, i).join('') + ch + s.slice(i + 1).join('');
    s.forEach((ch, i) => {
      const d = H.decompose(ch), afterJong = i > 0 && H.decompose(s[i - 1]).jong;
      if (d.cho !== 'ㅇ' && !afterJong) H.similarTo(d.cho).forEach((c) => out.push({ ko: swap(i, H.compose(c, d.jung, d.jong)), a: d.cho, b: c }));
      // не первый слог: 의 читается [이] (오이 = 오의), такие варианты на слух не различить
      H.similarTo(d.jung).filter((v) => !soundsSame(v, d.jung, i ? 'ㄱ' : d.cho)).forEach((v) => out.push({ ko: swap(i, H.compose(d.cho, v, d.jong)), a: d.jung, b: v }));
    });
    const alts = uniqBy(out.filter((x) => x.ko && x.ko !== ko), (x) => x.ko);
    return [...alts.filter((x) => DB.byKo.has(x.ko)), ...alts.filter((x) => !DB.byKo.has(x.ko))];
  }
  function syllFor(j, J) {
    const info = H.jamoInfo(j);
    if (info.kind === 'vowel') { const c = J.cons.length ? pick(J.cons.filter((x) => x !== 'ㅇ').concat('ㅇ')) : 'ㅇ'; return { c, v: j, target: 'v' }; }
    return { c: j, v: J.vowels.length ? pick(J.vowels) : 'ㅏ', target: 'c' };
  }

  const GEN = {
    'ko-ru'(it) {
      const e = it.entry;
      const ds = fillDistractors(e, sameKind(e).filter((x) => x.c === e.c), sameKind(e), 3, (x) => tail(x.ru));
      return { kind: 'choice', label: 'Что это значит?', prompt: `${UI.cells(e.ko, 'big')}${sayBtn(e.ko)}`,
        options: shuffle([e, ...ds]).map((x) => ({ text: tail(x.ru), ok: x === e })), say: e.ko, explain: entryExplain(e) };
    },
    'ru-ko'(it) {
      const e = it.entry;
      const ds = fillDistractors(e, lenNear(e).filter((x) => x.c === e.c), lenNear(e), 3, (x) => bare(x.ko));
      return { kind: 'choice', label: 'Как сказать по-корейски?', prompt: `<div class="q-ru">${esc(e.ru)}</div>`,
        options: shuffle([e, ...ds]).map((x) => ({ text: bare(x.ko), ok: x === e, ko: true })), sayAfter: e.ko, explain: entryExplain(e) };
    },
    'listen-word'(it) {
      const e = it.entry;
      const ds = fillDistractors(e, lenNear(e), sameKind(e), 3, (x) => bare(x.ko));
      return { kind: 'choice', label: 'Что прозвучало?', autoplay: e.ko,
        prompt: listenBtns(e.ko, 'Нажми, чтобы послушать ещё раз'),
        options: shuffle([e, ...ds]).map((x) => ({ text: bare(x.ko), ok: x === e, ko: true })), explain: entryExplain(e) };
    },
    'listen-pair'(it) {
      const e = it.entry; const alts = soundAlikes(e.ko);
      // одна обманка — настоящее слово, если есть, вторая случайная: как тройки 가/카/까 в учебнике
      const ds = uniqBy([...alts.slice(0, 1).filter((x) => DB.byKo.has(x.ko)), ...shuffle(alts)], (x) => x.ko).slice(0, 2);
      const diff = (x) => `<div class="ex-ru"><span class="ko">${esc(x.ko)}</span>${sayBtn(x.ko, 'sm')} — <span class="ko">${esc(x.b)}</span> вместо <span class="ko">${esc(x.a)}</span>${DB.byKo.has(x.ko) ? ` · ${esc(DB.byKo.get(x.ko).ru)}` : ''}</div>`;
      return { kind: 'choice', label: 'Что прозвучало? Звуки похожи', autoplay: e.ko,
        prompt: listenBtns(e.ko, 'Варианты отличаются одним звуком'),
        options: shuffle([e.ko, ...ds.map((x) => x.ko)]).map((x) => ({ text: x, ok: x === e.ko, ko: true })),
        explain: entryExplain(e) + ds.map(diff).join('') };
    },
    yesno(it) {
      // «Перед тобой шапка. 책이에요?» — 아니요, 모자예요.
      const e = it.entry;
      // 학생 и 대학생 не противопоставляем: студент университета — тоже студент
      const same = DB.entries.filter((x) => showable(x) && !x.ko.includes(e.ko) && !e.ko.includes(x.ko) && shortRu(x.ru) !== shortRu(e.ru) && (e.job ? x.job : !x.job && x.c === e.c));
      const asked = same.length && Math.random() < 0.6 ? pick(same) : e;
      const yes = asked === e;
      const cop = (w) => w + H.copula(w), badCop = (w) => w + (H.copula(w) === '이에요' ? '예요' : '이에요');
      const right = `${yes ? '네' : '아니요'}, ${cop(e.ko)}`;
      const other = same.filter((x) => x !== asked);
      const opts = uniqBy([right, `${yes ? '아니요' : '네'}, ${cop(e.ko)}`, `${yes ? '네' : '아니요'}, ${badCop(e.ko)}`,
        yes ? (other.length ? `아니요, ${cop(pick(other).ko)}` : '') : `네, ${cop(asked.ko)}`].filter(Boolean), (x) => x);
      const question = cop(asked.ko) + '?';
      return { kind: 'choice', label: 'Ответь на вопрос', autoplay: question,
        prompt: `<div class="hint">Перед тобой: <b>${esc(shortRu(e.ru))}</b></div><div class="q-ko md">${esc(question)}</div>${sayBtn(question)}`,
        options: shuffle(opts).map((x) => ({ text: x, ok: x === right, ko: true })), sayAfter: right + '.',
        explain: `<div class="ex-line">${yes ? `Да, это ${esc(shortRu(e.ru))}` : `Это не ${esc(shortRu(asked.ru))}, а ${esc(shortRu(e.ru))}`} → <span class="ko">${esc(right)}.</span>${sayBtn(right, 'sm')}</div>
          <div class="ex-ru"><span class="ko">${esc(e.ko)}</span> кончается на ${H.hasBatchim(e.ko) ? 'согласную → 이에요' : 'гласную → 예요'}</div><div class="row"><button type="button" class="link" data-rule="yesno">Правило 네/아니요 →</button><button type="button" class="link" data-rule="copula">Правило 이에요/예요 →</button></div>` };
    },
    type(it) {
      const e = it.entry;
      return { kind: 'type', label: 'Напиши по-корейски', prompt: `<div class="q-ru">${esc(e.ru)}</div>`, answer: e.ko, sayAfter: e.ko, explain: entryExplain(e) };
    },
    card(it) { const e = it.entry; return { kind: 'card', entry: e, front: Math.random() < 0.7 ? 'ko' : 'ru' }; },
    'jamo-read'(it) {
      const j = it.jamo, info = H.jamoInfo(j);
      const opts = [j, ...variants(j, it.J)].map((x) => { const i = H.jamoInfo(x); return { text: `${i.rr} · ${i.ru}`, ok: x === j }; });
      const ex = info.kind === 'vowel' ? H.compose('ㅇ', j) : H.compose(j, 'ㅏ');
      return { kind: 'choice', label: 'Как читается буква?', prompt: `<div class="q-jamo">${j}</div>`, options: shuffle(opts), sayAfter: ex,
        explain: `<div class="ex-line"><span class="ko">${j}</span> — ${esc(info.rr)} (${esc(info.ru)}). Например: <span class="ko">${ex}</span>${sayBtn(ex, 'sm')}</div>` };
    },
    'jamo-name'(it) {
      const j = it.jamo, name = H.NAMES[j];
      const others = shuffle([...variants(j, it.J, 6), ...it.J.cons].filter((x) => x !== j && H.NAMES[x]));
      const ds = uniqBy(others, (x) => x).slice(0, 3);
      const toName = Math.random() < 0.6;
      return { kind: 'choice', label: toName ? 'Как называется буква?' : 'Какая буква так называется?',
        prompt: toName ? `<div class="q-jamo">${j}</div>` : UI.cells(name, 'big'), sayAfter: name,
        options: shuffle([j, ...ds]).map((x) => ({ text: toName ? H.NAMES[x] : x, ok: x === j, ko: true })),
        explain: `<div class="ex-line"><span class="ko">${j} — ${name}</span>${sayBtn(name, 'sm')}</div>` };
    },
    'syll-read'(it) {
      const { c, v, target } = syllFor(it.jamo, it.J); const s = H.compose(c, v);
      const vs = variants(it.jamo, it.J).map((x) => (target === 'v' ? H.compose(c, x) : H.compose(x, v)));
      const all = uniqBy([s, ...vs], (x) => H.romanize(x));
      return { kind: 'choice', label: 'Как читается слог?', prompt: `<div class="q-ko xl">${s}</div>`, sayAfter: s,
        options: shuffle(all.map((x) => ({ text: H.romanize(x) || '—', ok: x === s }))),
        explain: `<div class="ex-line"><span class="ko">${c} + ${v} = ${s}</span> <span class="rr">${H.romanize(s)}</span>${sayBtn(s, 'sm')}</div>` };
    },
    compose(it) {
      const { c, v, target } = syllFor(it.jamo, it.J); const s = H.compose(c, v);
      const vs = variants(it.jamo, it.J).map((x) => (target === 'v' ? H.compose(c, x) : H.compose(x, v)));
      return { kind: 'choice', label: 'Собери слог', prompt: `<div class="q-compose"><span>${c}</span>+<span>${v}</span>=<span class="q-mark">?</span></div>`, sayAfter: s,
        options: shuffle(uniqBy([s, ...vs], (x) => x).map((x) => ({ text: x, ok: x === s, ko: true }))),
        explain: `<div class="ex-line"><span class="ko">${c} + ${v} = ${s}</span> <span class="rr">${H.romanize(s)}</span>${sayBtn(s, 'sm')}</div>` };
    },
    'listen-syll'(it) {
      const { c, v, target } = syllFor(it.jamo, it.J); const s = H.compose(c, v);
      // на слух не различить: ㅙ/ㅚ/ㅞ, ㅐ/ㅔ, ㅒ/ㅖ, а после согласной ещё ㅢ/ㅣ (희 = 히) — такие варианты не даём
      const vs = variants(it.jamo, it.J, 10).filter((x) => target !== 'v' || !soundsSame(x, it.jamo, c)).slice(0, 3)
        .map((x) => (target === 'v' ? H.compose(c, x) : H.compose(x, v)));
      return { kind: 'choice', label: 'Какой слог прозвучал?', autoplay: s,
        prompt: listenBtns(s, 'Нажми, чтобы послушать ещё раз'),
        options: shuffle(uniqBy([s, ...vs], (x) => x).map((x) => ({ text: x, ok: x === s, ko: true }))),
        explain: `<div class="ex-line"><span class="ko">${s}</span> <span class="rr">${H.romanize(s)}</span>${sayBtn(s, 'sm')}</div>` };
    },
    batchim(it) {
      const e = it.entry; const last = [...e.ko].pop(); const d = H.decompose(last); const snd = H.JONG_SOUND[d.jong];
      const sounds = Object.keys(H.SOUND_RR);
      const opts = shuffle([snd, ...shuffle(sounds.filter((x) => x !== snd)).slice(0, 3)]).map((x) => ({ text: `[${x}] ${H.SOUND_RR[x]}`, ok: x === snd }));
      return { kind: 'choice', label: 'Как звучит патчим?', prompt: `${UI.cells(e.ko, 'big')}<div class="hint">последняя согласная: <b class="ko">${d.jong}</b></div>`,
        options: opts, sayAfter: e.ko,
        explain: `<div class="ex-line">Патчим <b class="ko">${d.jong}</b> на конце звучит как <b class="ko">[${snd}]</b></div>${entryExplain(e)}` };
    },
    copula(it) {
      const e = it.entry; const ok = H.copula(e.ko);
      return { kind: 'choice', label: 'Выбери окончание', prompt: `<span class="cells big">${[...e.ko].map((c) => `<span class="cell">${esc(c)}</span>`).join('')}<span class="cell blank-cell">?</span></span><div class="hint">«это ${esc(e.ru)}»</div>`,
        options: ['이에요', '예요'].map((x) => ({ text: x, ok: x === ok, ko: true })), sayAfter: e.ko + ok,
        explain: `<div class="ex-line">${esc(e.ko)} кончается на ${H.hasBatchim(e.ko) ? 'согласную → <b>이에요</b>' : 'гласную → <b>예요</b>'}</div><div class="ex-line"><span class="ko">${esc(e.ko + ok)}</span>${sayBtn(e.ko + ok, 'sm')}</div>${ruleBtn('copula')}` };
    },
    topic(it) {
      const e = it.entry; const ok = H.topic(e.ko);
      return { kind: 'choice', label: 'Выбери частицу темы', prompt: `<span class="cells big">${[...e.ko].map((c) => `<span class="cell">${esc(c)}</span>`).join('')}<span class="cell blank-cell">?</span></span><div class="hint">${esc(e.ru)}</div>`,
        options: ['은', '는'].map((x) => ({ text: x, ok: x === ok, ko: true })), sayAfter: e.ko + ok,
        explain: `<div class="ex-line">${esc(e.ko)} кончается на ${H.hasBatchim(e.ko) ? 'согласную → <b>은</b>' : 'гласную → <b>는</b>'}</div>${ruleBtn('topic')}` };
    },
    sentence(it) {
      const { p, jb } = it; const a = H.topic(p.ko), b = H.copula(jb.ko);
      const full = `${p.ko}${a} ${jb.ko}${b}.`;
      const combos = [['은', '이에요'], ['은', '예요'], ['는', '이에요'], ['는', '예요']];
      return { kind: 'choice', label: 'Заполни пропуски', prompt: `<div class="q-ko md">${esc(p.ko)}<span class="blank">__</span> ${esc(jb.ko)}<span class="blank">__</span>.</div><div class="hint">${esc(p.ru)} — ${esc(jb.ru)}</div>`,
        options: combos.map(([x, y]) => ({ text: `${x} … ${y}`, ok: x === a && y === b, ko: true })), sayAfter: full,
        explain: `<div class="ex-line"><span class="ko">${esc(full)}</span>${sayBtn(full, 'sm')}</div><div class="row">${ruleBtn('topic')}${ruleBtn('copula')}</div>` };
    },
    cloze(it) {
      const l = it.line, e = it.entry; const tokens = l.ko.split(/\s+/);
      const shown = tokens.map((t, i) => i === it.ti ? `<span class="slot">＿＿＿</span>${esc(t.slice(e.ko.length))}` : esc(t)).join(' ');
      const rest = tokens[it.ti].replace(/[.,!?]/g, '').slice(e.ko.length);
      const fits = (x) => !rest || H.hasBatchim(x.ko) === H.hasBatchim(e.ko); // по видимой частице не отсеять варианты
      const ds = fillDistractors(e, sameKind(e).filter((x) => x.c === e.c && fits(x)), lenNear(e).filter(fits), 3, (x) => x.ko);
      return { kind: 'choice', label: 'Вставь пропущенное слово', prompt: `<div class="q-ko md">${shown}</div><div class="hint">${esc(l.ru)}</div>`,
        options: shuffle([e, ...ds]).map((x) => ({ text: x.ko, ok: x === e, ko: true })), sayAfter: l.ko,
        explain: `<div class="ex-line"><span class="ko">${esc(l.ko)}</span>${sayBtn(l.ko, 'sm')}</div><div class="ex-ru"><span class="ko">${esc(e.ko)}</span> — ${esc(e.ru)}</div>` };
    },
    shadow(it) {
      const l = it.line;
      return { kind: 'speak', label: 'Послушай и повтори', autoplay: l.ko, fuzzy: true, answer: l.ko,
        prompt: `<div class="q-ko md">${esc(l.ko)}</div><div class="hint">${esc(l.ru)}</div><div class="row">${sayBtn(l.ko)}<button type="button" class="link slow-say" data-say="${esc(l.ko)}" data-slow="1">Медленнее</button></div>`,
        explain: `<div class="ex-line"><span class="ko">${esc(l.ko)}</span>${sayBtn(l.ko, 'sm')}</div><div class="ex-ru">${esc(l.ru)}</div>` };
    },
    'num-read'(it) {
      const S = Numbers.SYSTEMS[it.sys]; const ds = shuffle(Numbers.near(it.n, it.sys)).slice(0, 3);
      return { kind: 'choice', label: `Как прочитать (${S.title})?`, prompt: `<div class="q-num">${it.n}</div><div class="hint">${S.use}</div>`,
        options: shuffle([it.n, ...ds]).map((x) => ({ text: S.read(x), ok: x === it.n, ko: true })), sayAfter: S.read(it.n), explain: numExplain(it) };
    },
    'num-value'(it) {
      const S = Numbers.SYSTEMS[it.sys]; const ds = shuffle(Numbers.near(it.n, it.sys)).slice(0, 3);
      return { kind: 'choice', label: 'Какое это число?', prompt: `<div class="q-ko md">${S.read(it.n)}</div><div class="hint">${S.title}</div>`,
        options: shuffle([it.n, ...ds]).map((x) => ({ text: String(x), ok: x === it.n })), sayAfter: S.read(it.n), explain: numExplain(it) };
    },
    'num-listen'(it) {
      const S = Numbers.SYSTEMS[it.sys]; const ds = shuffle(Numbers.near(it.n, it.sys)).slice(0, 3);
      return { kind: 'choice', label: 'Какое число прозвучало?', autoplay: S.read(it.n),
        prompt: listenBtns(S.read(it.n), S.title),
        options: shuffle([it.n, ...ds]).map((x) => ({ text: String(x), ok: x === it.n })), explain: numExplain(it) };
    },
    write(it) {
      const t = it.target; const trace = Math.random() < 0.5;
      let task;
      if (it.jamo) { const i = H.jamoInfo(t); task = `<div class="q-ru">${esc(i.rr)} · ${esc(i.ru)}</div>${H.NAMES[t] ? `<div class="hint">буква <span class="ko">${H.NAMES[t]}</span></div>` : ''}`; }
      else task = `<div class="q-ru">${esc(it.entry.ru)}</div>${Store.settings().romanize ? `<div class="hint">${esc(H.romanize(t))}</div>` : ''}`;
      return { kind: 'write', label: trace ? 'Обведи по образцу' : 'Напиши по памяти', prompt: task, target: t, trace, sayAfter: it.jamo ? (H.NAMES[t] || H.compose('ㅇ', t)) : t,
        explain: `<div class="ex-line"><span class="ko serif">${esc(t)}</span>${it.entry ? ` — ${esc(it.entry.ru)}` : ''}</div>` };
    },
    speak(it) {
      const e = it.entry;
      return { kind: 'speak', label: 'Скажи вслух', prompt: `${UI.cells(e.ko, 'big')}<div class="hint">${esc(e.ru)}${Store.settings().romanize ? ' · ' + esc(H.romanize(e.ko)) : ''}</div>${sayBtn(e.ko)}`,
        answer: e.ko, explain: entryExplain(e) };
    },
    read(it) {
      const d = it.dlg, q = it.rq, at = d.lines[q.at];
      const text = d.lines.map((l) => l.ko).join(' ');
      return { kind: 'choice', label: 'Прочитай и ответь',
        prompt: `<div class="chat reading">${d.lines.map((l) => `<div class="msg">${l.who ? `<span class="who">${esc(l.who)}</span>` : ''}<span class="ko">${esc(l.ko)}</span></div>`).join('')}</div>
          <div class="row">${sayBtn(text)}<button type="button" class="link slow-say" data-say="${esc(text)}" data-slow="1">Медленнее</button></div><div class="q-ru sm">${esc(q.q)}</div>`,
        options: shuffle([q.a, ...q.wrong]).map((x) => ({ text: x, ok: x === q.a })),
        explain: at ? `<div class="ex-line"><span class="ko">${esc(at.ko)}</span>${sayBtn(at.ko, 'sm')}</div><div class="ex-ru">${esc(at.ru)}</div>` : '' };
    },
    'dialog-line'(it) {
      const d = it.dlg, line = d.lines[it.i];
      const prev = d.lines.slice(Math.max(0, it.i - 3), it.i);
      // обманки только из уроков до этого диалога: реплики будущих уроков ученик ещё не видел
      const upTo = DB.allNums().filter((n) => n > 0 && n <= d.lesson);
      const pool = uniqBy([...DB.dialogues(upTo).flatMap((x) => x.lines), ...DB.entriesFor(upTo).filter((e) => e.kind === 'phrase')], (x) => bare(x.ko))
        .filter((x) => bare(x.ko) !== bare(line.ko));
      const near = pool.filter((x) => Math.abs(x.ko.length - line.ko.length) <= 8);
      const ds = shuffle(near.length >= 3 ? near : pool).slice(0, 3);
      return { kind: 'choice', label: `${d.title}`, autoplay: prev[prev.length - 1]?.ko,
        prompt: `<div class="chat">${prev.map((l) => `<div class="msg"><span class="who">${esc(l.who || '')}</span><span class="ko">${esc(l.ko)}</span></div>`).join('')}
          <div class="msg me"><span class="who">${esc(line.who || '')}</span><span class="dots-typing">…</span></div></div>
          <div class="hint">Что ответит ${esc(line.who || 'собеседник')}? По смыслу: «${esc(line.ru)}»</div>`,
        options: shuffle([line, ...ds]).map((x) => ({ text: bare(x.ko), ok: x === line, ko: true })), sayAfter: line.ko,
        explain: `<div class="ex-line"><span class="ko">${esc(line.ko)}</span>${sayBtn(line.ko, 'sm')}</div><div class="ex-ru">${esc(line.ru)}</div>` };
    },
    translate(it) {
      const l = it.line, toks = it.toks;
      const extra = [...new Set(toks.filter((t) => PAIR[t]).map((t) => PAIR[t]))].filter((x) => !toks.includes(x));
      const tokens = [...toks, ...extra];
      const order = shuffle(tokens.map((t, i) => i));
      const why = toks.map((t, i) => PAIR[t] && i ? `<div class="ex-ru"><span class="ko">${esc(toks[i - 1])}</span> кончается на ${H.hasBatchim(toks[i - 1]) ? 'согласную' : 'гласную'} → <b class="ko">${esc(t)}</b></div>` : '').join('');
      const rules = [toks.some((t) => t === '은' || t === '는') && '<button type="button" class="link" data-rule="topic">Правило 은/는 →</button>', toks.some((t) => t === '이에요' || t === '예요') && '<button type="button" class="link" data-rule="copula">Правило 이에요/예요 →</button>'].filter(Boolean).join('');
      return { kind: 'build', label: 'Составь предложение', prompt: `<div class="q-ru">${esc(l.ru)}</div><div class="hint">Частицы отдельно.${extra.length ? " Лишние плашки останутся внизу." : ""}</div>`,
        tokens, need: toks.length, answerToks: toks, order, answer: l.ko, sayAfter: l.ko,
        explain: `<div class="ex-line"><span class="ko">${esc(l.ko)}</span>${sayBtn(l.ko, 'sm')}</div>${why}<div class="row">${rules}</div>` };
    },
    build(it) {
      const l = it.line; const tokens = l.ko.trim().split(/\s+/).map((t) => t.replace(/[.,!?…]/g, '')).filter(Boolean);
      let order = shuffle(tokens.map((t, i) => i));
      if (tokens.length > 1 && order.every((x, i) => x === i)) order = order.reverse();
      return { kind: 'build', label: 'Собери фразу', prompt: `<div class="q-ru">${esc(l.ru)}</div>`, tokens, order, answer: l.ko, sayAfter: l.ko,
        explain: `<div class="ex-line"><span class="ko">${esc(l.ko)}</span>${sayBtn(l.ko, 'sm')}</div>` };
    },
  };

  const norm = (s) => s.replace(/[\s.,!?·…'"]/g, '');
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return n + ' ' + (m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c); };
  // похожесть строк 0..1 (по расстоянию Левенштейна)
  function similar(a, b) {
    const m = [...a], n = [...b]; let prev = Array.from({ length: n.length + 1 }, (_, j) => j);
    for (let i = 1; i <= m.length; i++) {
      const cur = [i];
      for (let j = 1; j <= n.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (m[i - 1] === n[j - 1] ? 0 : 1));
      prev = cur;
    }
    return 1 - prev[n.length] / Math.max(1, m.length, n.length);
  }

  // Слоги ответа по позициям: где ошибся — красным, чего не хватает — пустой клеткой
  function diffHtml(typed, answer) {
    const a = [...norm(typed)], b = [...norm(answer)];
    const n = Math.max(a.length, b.length);
    const mine = Array.from({ length: n }, (_, i) => a[i] === undefined ? '<span class="cell miss">·</span>'
      : `<span class="cell ${a[i] === b[i] ? '' : 'bad'}">${esc(a[i])}</span>`).join('');
    const right = b.map((c, i) => `<span class="cell ${a[i] === c ? '' : 'bad'}">${esc(c)}</span>`).join('');
    return `<div class="diff"><div class="diff-row"><span>ты написал</span><span class="cells">${mine}</span></div><div class="diff-row"><span>правильно</span><span class="cells">${right}</span></div></div>`;
  }

  // ---------- экран тренировки ----------
  function start(root, mode, nums, filter = {}) {
    const filtered = !!(filter.c || filter.q);
    // выборка из словаря: оставляем только слова, подходящие под тему и поиск
    const pool = filtered ? buildPool(mode, nums).filter((it) => it.entry && DB.matches(it.entry, filter)) : buildPool(mode, nums);
    const again = `#/practice/${mode}?l=${nums.join(',')}${filter.c ? '&c=' + encodeURIComponent(filter.c) : ''}${filter.q ? '&q=' + encodeURIComponent(filter.q) : ''}`;
    if (!pool.length) {
      const why = mode === 'mistakes' ? 'Ошибок пока нет — сначала потренируйся в других режимах.'
        : mode === 'speak' && !micSupported() ? 'Этот браузер не умеет распознавать речь. Попробуй Chrome на компьютере или Android.'
        : MODES[mode].tts && !TTS.available() ? 'Для аудирования нужен корейский голос. Как его включить — в «Настройках».'
        : 'Для этого режима пока нет материала в выбранных уроках.';
      root.innerHTML = `<section class="empty">${why}<br><a class="btn" href="#/practice">Назад</a></section>`;
      return;
    }
    if (mode === 'match') return startMatch(root, nums, pool);
    const isTest = mode === 'test', isTimed = mode === 'timed';
    const TIME = 5 * 60 * 1000; const t0 = Date.now(); let timeUp = false, timer = null;
    const queue = mode === 'dialog' ? dialogQueue(nums) : choose(pool, isTest ? TEST_LEN : isTimed ? 80 : filtered ? Math.min(pool.length, FILTER_LEN) : SESSION_LEN, isTimed ? 'mix' : mode);
    const introduced = new Set(); let introCount = 0;
    const introOk = !['cards', 'test', 'mistakes', 'timed'].includes(mode);
    const retried = new Set(), stored = new Set();
    const qid = (it) => it.uid || it.key; // у чисел один ключ хранилища на диапазон, но вопросы в сессии разные
    const results = [];
    const marks = [];
    let idx = 0, q = null, answered = false;
    // alive: сессия ещё на экране; stepping: переход к следующему вопросу уже запущен (защита от двойного нажатия)
    let alive = true, stepping = false, activeRec = null;
    const later = (fn, ms) => setTimeout(() => { if (alive) fn(); }, ms);
    // tok — номер вопроса, к которому относится кнопка: клик по устаревшей кнопке ничего не делает
    function step(fn, tok) {
      if (stepping || !alive || (tok !== undefined && tok !== idx)) return;
      stepping = true;
      if (fn) fn();
      idx++; next();
    }
    document.body.classList.add('in-session');

    root.innerHTML = `
      <section class="session">
        <header class="s-top">
          <button class="icon-btn quit" type="button" aria-label="Выйти">${icon('close')}</button>
          ${isTimed ? '<div class="tbar"><i></i></div>' : '<div class="segs"></div>'}
          <span class="s-count"></span>
        </header>
        <div class="s-body"></div>
        <footer class="s-foot"></footer>
      </section>`;
    const $body = root.querySelector('.s-body'), $foot = root.querySelector('.s-foot');
    const quit = () => {
      if (results.length && idx < queue.length && !confirm('Выйти из тренировки? Уже данные ответы сохранены.')) return;
      location.hash = '#/practice';
    };
    root.querySelector('.quit').addEventListener('click', quit);

    function progress() {
      if (isTimed) return;
      root.querySelector('.segs').innerHTML = queue.map((_, i) => `<i class="${i < idx ? (marks[i] === 'intro' ? 'intro' : marks[i] ? 'ok' : 'bad') : i === idx ? 'cur' : ''}"></i>`).join('');
      root.querySelector('.s-count').textContent = `${Math.min(idx + 1, queue.length)} / ${queue.length}`;
    }
    if (isTimed) {
      const tick = () => {
        const left = Math.max(0, TIME - (Date.now() - t0));
        root.querySelector('.tbar i').style.width = (left / TIME) * 100 + '%';
        root.querySelector('.s-count').textContent = `${Math.floor(left / 60000)}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
        if (!left) { timeUp = true; clearInterval(timer); root.querySelector('.s-count').textContent = 'время!'; }
      };
      tick(); timer = setInterval(tick, 500);
    }

    // Знакомство с новым словом: показать карточку, а проверить чуть позже
    function renderIntro(it) {
      const e = it.entry;
      // пример из уроков, где слово уже встретилось (свои слова — из любых)
      const upTo = Math.max(...e.lessons) || Infinity;
      const ex = sentenceLines(DB.allNums().filter((n) => n > 0 && n <= upTo)).find((l) => l.ko.split(/\s+/).some((t) => t.startsWith(e.ko)) && l.ko !== e.ko);
      $body.innerHTML = `<div class="q-label">Новое слово</div><div class="q-prompt intro">${UI.cells(e.ko, 'big')}${sayBtn(e.ko)}
        ${UI.rr(e.ko)}<div class="q-ru">${esc(e.ru)}</div>
        ${ex ? `<div class="intro-ex"><span class="ko">${esc(ex.ko)}</span><span class="muted sm">${esc(ex.ru)}</span></div>` : ''}</div>`;
      $foot.innerHTML = '<button class="btn wide next">Запомнил</button>';
      later(() => TTS.speak(e.ko), 250);
      answered = true; q = { kind: 'intro', item: it };
      const tok = idx; $foot.querySelector('.next').addEventListener('click', () => step(() => { marks[idx] = 'intro'; }, tok));
    }

    // Правило перед первой встречей с темой (сейчас — числа): показывается один раз, пока по теме нет прогресса
    let ruleShown = false;
    function renderRule(g) {
      ruleShown = true;
      $body.innerHTML = `<div class="q-label">Как это устроено</div><div class="q-prompt rule-intro grammar"><h3 class="serif">${esc(g.title)}</h3>
        ${g.body.map((p) => `<p>${p}</p>`).join('')}
        <div class="examples">${g.examples.map((x) => `<div class="exm"><div><span class="ko">${esc(x.ko)}</span><div class="muted sm">${esc(x.ru)}</div></div>${sayBtn(x.ko, 'sm')}</div>`).join('')}</div></div>`;
      $foot.className = 's-foot'; $foot.innerHTML = '<button class="btn wide next">Понятно, начнём</button>';
      answered = true; q = { kind: 'intro' };
      $foot.querySelector('.next').addEventListener('click', () => { if (alive) next(); });
    }
    const numFresh = () => !['s', 'n'].some((s) => ['small', 'mid', 'big'].some((b) => Store.get(`num:${s}:${b}`)));

    // Перелистывание: текущая страница уходит влево, новая въезжает справа
    let turning = false;
    function next() {
      if (turning) return;
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (!$body.firstChild || reduce) return show();
      turning = true;
      $body.classList.add('leave'); $foot.classList.add('leave');
      later(() => {
        turning = false; $body.classList.remove('leave'); $foot.classList.remove('leave');
        show();
        $body.classList.remove('enter'); void $body.offsetWidth; $body.classList.add('enter');
      }, 140);
    }
    function show() {
      stepping = false;
      if (idx >= queue.length || timeUp) return finish();
      const it = queue[idx];
      if (!ruleShown && it.group === 'numbers' && introOk && numFresh()) { progress(); return renderRule(Numbers.RULE); }
      if (introOk && it.entry && it.group === 'words' && !Store.get(it.key) && !introduced.has(it.key) && introCount < 5) {
        introduced.add(it.key); introCount++;
        queue.splice(Math.min(queue.length, idx + 3), 0, it); // проверим через пару вопросов
        progress(); $foot.className = 's-foot'; return renderIntro(it);
      }
      q = GEN[pick(it.types)](it); q.item = it; answered = false;
      progress();
      $foot.className = 's-foot'; $foot.innerHTML = '';
      if (q.kind === 'choice') renderChoice();
      else if (q.kind === 'type') renderType();
      else if (q.kind === 'build') renderBuild();
      else if (q.kind === 'card') renderCard();
      else if (q.kind === 'write') renderWrite();
      else if (q.kind === 'speak') renderSpeak();
      if (q.autoplay) later(() => TTS.speak(q.autoplay), 250);
    }

    function head() { return `<div class="q-label">${esc(q.label)}</div><div class="q-prompt">${q.prompt}</div>`; }

    function renderChoice() {
      $body.innerHTML = head() + `<div class="opts ${q.options.length <= 2 ? 'two' : ''}">${q.options.map((o, i) =>
        `<button class="opt ${o.ko ? 'ko' : ''}" data-i="${i}"><kbd>${i + 1}</kbd><span>${esc(o.text)}</span></button>`).join('')}</div>`;
      $body.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => choose_(+b.dataset.i)));
    }
    function choose_(i) {
      if (answered) return;
      const btns = $body.querySelectorAll('.opt');
      const ok = q.options[i].ok;
      btns.forEach((b, k) => { b.disabled = true; if (q.options[k].ok) b.classList.add('right'); });
      if (!ok) btns[i].classList.add('wrong');
      done(ok);
    }

    function renderType() {
      const kbOn = Store.settings().keyboard;
      $body.innerHTML = head() + `<form class="type-form"><input class="type-in" lang="ko" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="한글로…" ${kbOn ? 'inputmode="none"' : ''}>${kbOn ? '' : '<button class="btn">Проверить</button>'}</form>
        <div class="hint"><button type="button" class="link show-hint">Подсказка: первый слог</button>${matchMedia('(pointer: fine)').matches ? ' · можно печатать с клавиатуры: gkrtod → 학생' : ''}</div>`;
      const f = $body.querySelector('form'), inp = $body.querySelector('input');
      Keyboard.attach($body, inp, () => f.requestSubmit(), kbOn);
      setTimeout(() => inp.focus({ preventScroll: true }), 50);
      $body.querySelector('.show-hint').addEventListener('click', (e) => { e.target.textContent = 'Начинается с: ' + [...q.answer][0]; });
      f.addEventListener('submit', (e) => {
        e.preventDefault(); if (answered) return;
        const v = inp.value.trim(); if (!v) return;
        const ok = norm(v) === norm(q.answer);
        inp.disabled = true; inp.classList.add(ok ? 'right' : 'wrong');
        if (!ok) q.explain = diffHtml(v, q.answer) + q.explain;
        done(ok);
      });
    }

    // Прописи: рисуем в клетках, потом сравниваем с образцом и оцениваем себя
    function renderWrite() {
      const tok = idx;
      const chars = [...q.target];
      $body.innerHTML = head() + `<div class="write-cells ${chars.length > 2 ? 'small' : ''}">${chars.map((c) => `<div class="wcell"><span class="wguide ${q.trace ? 'on' : ''}">${esc(c)}</span><canvas></canvas></div>`).join('')}</div>
        <div class="row write-tools"><button type="button" class="btn ghost sm clr">Стереть</button><button type="button" class="btn ghost sm tg">${q.trace ? 'Скрыть образец' : 'Подсказка'}</button></div>`;
      const cells = [...$body.querySelectorAll('.wcell')];
      cells.forEach((cell) => draw(cell.querySelector('canvas')));
      $body.querySelector('.clr').addEventListener('click', () => cells.forEach((c) => { const cv = c.querySelector('canvas'); cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); }));
      $body.querySelector('.tg').addEventListener('click', (e) => {
        const on = !$body.querySelector('.wguide').classList.contains('on');
        $body.querySelectorAll('.wguide').forEach((g) => g.classList.toggle('on', on)); e.target.textContent = on ? 'Скрыть образец' : 'Подсказка';
      });
      $foot.innerHTML = `<button class="btn wide check">Сравнить с образцом</button>`;
      $foot.querySelector('.check').addEventListener('click', () => {
        $body.querySelectorAll('.wguide').forEach((g) => { g.classList.add('reveal'); g.classList.remove('on'); });
        $body.querySelector('.write-tools').remove();
        if (q.sayAfter) TTS.speak(q.sayAfter);
        $foot.innerHTML = `<div class="hint center">Сравни свою букву с образцом (красный контур)</div><div class="grade"><button class="btn bad" data-g="0">Не похоже</button><button class="btn good" data-g="1">Похоже</button></div>`;
        $foot.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => step(() => { answered = true; record(b.dataset.g === '1'); }, tok)));
      });
    }
    function draw(cv) {
      const ctx = cv.getContext('2d'); const dpr = window.devicePixelRatio || 1;
      const size = () => { const r = cv.getBoundingClientRect(); cv.width = r.width * dpr; cv.height = r.height * dpr; ctx.scale(dpr, dpr);
        ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(4, r.width / 22); ctx.strokeStyle = getComputedStyle(cv).color; };
      size();
      let last = null;
      const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
      cv.addEventListener('pointerdown', (e) => { cv.setPointerCapture(e.pointerId); last = pos(e); ctx.beginPath(); ctx.arc(last[0], last[1], ctx.lineWidth / 2, 0, 7); ctx.fillStyle = ctx.strokeStyle; ctx.fill(); });
      cv.addEventListener('pointermove', (e) => { if (!last) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(...last); ctx.lineTo(...p); ctx.stroke(); last = p; });
      const end = () => (last = null); cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    }

    // Произношение: распознавание речи ko-KR
    function renderSpeak() {
      $body.innerHTML = head() + `<div class="speak"><button class="mic" type="button" aria-label="Говорить">${icon('mic')}</button><div class="heard hint">Нажми и ${q.fuzzy ? 'повтори фразу' : 'скажи слово'}</div></div>`;
      const mic = $body.querySelector('.mic'), heard = $body.querySelector('.heard');
      let tries = 0, rec = null;
      $foot.innerHTML = `<button class="btn ghost wide skip">Не получается, пропустить</button>`;
      $foot.querySelector('.skip').addEventListener('click', () => { rec?.abort(); if (!answered) done(false); });
      mic.addEventListener('click', () => {
        if (answered) return;
        if (rec) { rec.stop(); return; }
        rec = activeRec = new SR(); rec.lang = 'ko-KR'; rec.maxAlternatives = 5; rec.interimResults = false;
        mic.classList.add('on'); heard.textContent = 'Слушаю…';
        rec.onresult = (ev) => {
          if (!alive) return;
          const alts = [...ev.results[0]].map((a) => a.transcript.trim());
          const target = norm(q.answer);
          const ok = alts.some((a) => norm(a) === target || norm(a).includes(target) || (q.fuzzy && similar(norm(a), target) >= 0.75));
          tries++;
          heard.innerHTML = `Услышал: <span class="ko">${esc(alts[0] || '—')}</span>`;
          if (ok) { done(true); } else if (tries >= 3) { done(false); } else { heard.innerHTML += ` · попробуй ещё раз (${3 - tries})`; }
        };
        rec.onerror = (ev) => { heard.textContent = ev.error === 'not-allowed' ? 'Нет доступа к микрофону — разреши его в браузере' : ev.error === 'no-speech' ? 'Ничего не услышал, попробуй ещё' : 'Ошибка распознавания: ' + ev.error; };
        rec.onend = () => { mic.classList.remove('on'); rec = null; };
        rec.start();
      });
    }

    function renderBuild() {
      const picked = [];
      $body.innerHTML = head() + `<div class="build-line"></div><div class="build-bank"></div>`;
      const $line = $body.querySelector('.build-line'), $bank = $body.querySelector('.build-bank');
      function draw() {
        $line.innerHTML = picked.map((ti, k) => `<button class="tok ko" data-k="${k}">${esc(q.tokens[ti])}</button>`).join('') || '<span class="hint">Нажимай на слова снизу</span>';
        $bank.innerHTML = q.order.map((ti) => `<button class="tok ko ${picked.includes(ti) ? 'used' : ''}" data-t="${ti}" ${picked.includes(ti) ? 'disabled' : ''}>${esc(q.tokens[ti])}</button>`).join('');
        $line.querySelectorAll('.tok').forEach((b) => b.addEventListener('click', () => { if (answered) return; picked.splice(+b.dataset.k, 1); draw(); }));
        $bank.querySelectorAll('.tok').forEach((b) => b.addEventListener('click', () => {
          if (answered) return; picked.push(+b.dataset.t); draw();
          if (picked.length === (q.need || q.tokens.length)) {
            const ok = picked.map((t) => q.tokens[t]).join(' ') === (q.answerToks || q.tokens).join(' ');
            $line.classList.add(ok ? 'right' : 'wrong'); done(ok);
          }
        }));
      }
      draw();
    }

    // через сколько карточка вернётся при такой оценке (подписи на кнопках)
    function ivl(g) {
      if (Store.get(q.item.key) && !Store.isDue(q.item.key)) return 'срок прежний';
      const b = Math.max(0, Store.box(q.item.key));
      const box = g === 1 ? Math.max(1, b) : Math.min(Store.MAX_BOX, b + (g === 3 ? 2 : 1));
      const days = [0, 1, 2, 4, 8, 16, 32][box] * (g === 1 ? 0.5 : 1);
      return days < 1 ? '½ дня' : `${plural(days, 'день', 'дня', 'дней')}`;
    }
    function renderCard() {
      const tok = idx;
      const e = q.entry; const koFront = q.front === 'ko';
      const front = koFront ? UI.cells(e.ko, 'big') : `<div class="q-ru">${esc(e.ru)}</div>`;
      const back = `<div class="card-back">${UI.cells(e.ko, 'big')}${UI.rr(e.ko)}<div class="q-ru sm">${esc(e.ru)}</div>${sayBtn(e.ko)}</div>`;
      $body.innerHTML = `<div class="q-label">${koFront ? 'Вспомни перевод' : 'Вспомни по-корейски'}</div><div class="flash"><div class="flash-front">${front}${koFront ? sayBtn(e.ko) : ''}</div></div>`;
      if (koFront) later(() => TTS.speak(e.ko), 200);
      $foot.innerHTML = `<button class="btn wide reveal">Показать ответ</button>`;
      $foot.querySelector('.reveal').addEventListener('click', () => {
        $body.querySelector('.flash').innerHTML = back; if (!koFront) TTS.speak(e.ko);
        $foot.innerHTML = `<div class="grade four"><button class="btn bad" data-g="0">Снова<small>сейчас</small></button><button class="btn ghost" data-g="1">Трудно<small>${ivl(1)}</small></button><button class="btn good" data-g="2">Хорошо<small>${ivl(2)}</small></button><button class="btn ghost" data-g="3">Легко<small>${ivl(3)}</small></button></div>`;
        $foot.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => step(() => { answered = true; record(+b.dataset.g > 0, +b.dataset.g); }, tok)));
      });
    }

    function record(ok, g) {
      // верный ответ на тот же диапазон чисел в одной сессии не двигает коробку второй раз
      if (g !== undefined) Store.grade(q.item.key, g); else if (ok && q.item.uid && stored.has(q.item.key)) Store.tally(true); else Store.answer(q.item.key, ok);
      stored.add(q.item.key);
      marks[idx] = ok;
      results.push({ q, ok });
      if (!ok && !isTest && mode !== 'dialog' && !retried.has(qid(q.item))) { retried.add(qid(q.item)); queue.push(q.item); }
    }

    function done(ok) {
      answered = true; record(ok);
      $body.querySelector('.kb')?.remove();
      if (q.sayAfter) TTS.speak(q.sayAfter);
      $foot.className = 's-foot show ' + (ok ? 'ok' : 'bad');
      $foot.innerHTML = `<div class="fb"><div class="fb-title">${ok ? pick(['맞아요', '좋아요', '잘했어요']) + ' <small>верно</small>' : '틀렸어요 <small>правильный ответ</small>'}</div>
        <div class="fb-ex">${q.explain || ''}</div></div><button class="btn wide next">Дальше</button>`;
      const nb = $foot.querySelector('.next');
      const tok = idx; const go = () => step(undefined, tok);
      nb.addEventListener('click', go); nb.focus({ preventScroll: true });
    }

    function finish() {
      if (!alive) return;
      clearInterval(timer);
      document.body.classList.remove('in-session');
      document.removeEventListener('keydown', onKey);
      const first = new Map(); results.forEach((r) => { if (!first.has(qid(r.q.item))) first.set(qid(r.q.item), r.ok); });
      const total = first.size, right = [...first.values()].filter(Boolean).length;
      const pct = total ? Math.round((right / total) * 100) : 0;
      const mistakes = uniqBy(results.filter((r) => !r.ok), (r) => qid(r.q.item));
      const stampText = pct >= 90 ? '참 잘했어요' : pct >= 70 ? '잘했어요' : '힘내요';
      let testNote = '';
      const timedBest = Store.meta('timedBest') || 0;
      if (isTimed && results.length > timedBest) Store.setMeta('timedBest', results.length);
      if (isTest && nums.length === 1) {
        const prev = Store.getTest(nums[0]); Store.setTest(nums[0], pct);
        testNote = `<p class="muted">Контрольная по уроку ${nums[0]}${prev ? ` · лучший результат был ${prev.best}%` : ''}${prev && pct > prev.best ? ' — новый рекорд' : ''}</p>`;
      }
      root.innerHTML = `<section class="finish">
        <div class="stamp lg"><span>${stampText}</span></div>
        <div class="score">${pct}%</div>${testNote}${isTimed ? `<p class="muted">За 5 минут: ${plural(results.length, 'ответ', 'ответа', 'ответов')}${timedBest ? (results.length > timedBest ? ' — новый рекорд' : ` · рекорд ${timedBest}`) : ''}</p>` : ''}
        <p class="muted">${right} из ${total} верно с первого раза · всего ответов: ${results.length}</p>
        ${mistakes.length ? `<div class="card"><h2 class="h">Стоит повторить</h2>${mistakes.map((r) => `<div class="mist">${r.q.explain || (r.q.entry ? `<span class="ko">${esc(r.q.entry.ko)}</span> — ${esc(r.q.entry.ru)}` : '')}</div>`).join('')}</div>` : ''}
        <div class="row"><a class="btn" href="${again}&r=${Date.now()}">Ещё раз</a><a class="btn ghost" href="#/">На главную</a></div>
      </section>`;
    }

    function onKey(e) {
      if (!document.body.classList.contains('in-session')) return;
      if (e.key === 'Escape') { quit(); return; }
      if (e.target.tagName === 'INPUT' && e.key !== 'Enter') return;
      if (answered && q?.kind !== 'intro' && e.key === 'Enter') { e.preventDefault(); $foot.querySelector('.next')?.click(); return; }
      if (!answered && q?.kind === 'choice' && /^[1-4]$/.test(e.key)) { const i = +e.key - 1; if (q.options[i]) choose_(i); }
      if (!answered && q?.kind === 'card' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); $foot.querySelector('.reveal')?.click(); return; }
      if (q?.kind === 'card' && /^[1-4]$/.test(e.key)) $foot.querySelector(`[data-g="${+e.key - 1}"]`)?.click();
      if (q?.kind === 'intro' && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); $foot.querySelector('.next')?.click(); }
    }
    document.addEventListener('keydown', onKey);
    start.cleanup = () => { alive = false; clearInterval(timer); try { activeRec?.abort(); } catch {} window.speechSynthesis?.cancel(); document.removeEventListener('keydown', onKey); document.body.classList.remove('in-session'); };
    next();
  }

  // ---------- «Найди пары»: 3 раунда по 6 пар на время ----------
  function startMatch(root, nums, pool) {
    const ROUNDS = 3, PAIRS = 6;
    const items = uniqBy(choose(uniqBy(pool, (it) => it.entry.ru), ROUNDS * PAIRS, 'words'), (it) => it.entry.ru);
    if (items.length < PAIRS) { root.innerHTML = '<section class="empty">Слишком мало слов для игры.<br><a class="btn" href="#/practice">Назад</a></section>'; return; }
    const t0 = Date.now(); let round = 0, misses = 0, timer = null, alive = true; const missed = new Set();
    document.body.classList.add('in-session');
    root.innerHTML = `<section class="session match">
      <header class="s-top"><button class="icon-btn quit" type="button" aria-label="Выйти">${icon('close')}</button><div class="segs"></div><span class="s-count">0:00</span></header>
      <div class="q-label">Соедини слово с переводом</div><div class="pairs"></div></section>`;
    const $pairs = root.querySelector('.pairs');
    root.querySelector('.quit').addEventListener('click', () => { if (round === 0 || confirm('Выйти из игры?')) location.hash = '#/practice'; });
    const fmt = (ms) => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
    timer = setInterval(() => { root.querySelector('.s-count').textContent = fmt(Date.now() - t0); }, 500);
    const rounds = Math.min(ROUNDS, Math.floor(items.length / PAIRS));

    function drawRound() {
      root.querySelector('.segs').innerHTML = Array.from({ length: rounds }, (_, i) => `<i class="${i < round ? 'ok' : i === round ? 'cur' : ''}"></i>`).join('');
      const set = items.slice(round * PAIRS, round * PAIRS + PAIRS);
      const left = shuffle(set), right = shuffle(set);
      $pairs.innerHTML = `<div class="col">${left.map((it) => `<button class="pair ko" data-k="${esc(it.key)}" data-side="ko">${esc(it.entry.ko)}</button>`).join('')}</div>
        <div class="col">${right.map((it) => `<button class="pair" data-k="${esc(it.key)}" data-side="ru">${esc(it.entry.ru)}</button>`).join('')}</div>`;
      let sel = null, left_ = PAIRS;
      $pairs.querySelectorAll('.pair').forEach((b) => b.addEventListener('click', () => {
        if (b.classList.contains('done')) return;
        if (b.dataset.side === 'ko') TTS.speak(set.find((x) => x.key === b.dataset.k).entry.ko);
        if (!sel || sel.dataset.side === b.dataset.side) { $pairs.querySelectorAll('.pair.sel').forEach((x) => x.classList.remove('sel')); sel = b; b.classList.add('sel'); return; }
        const a = sel; sel = null; a.classList.remove('sel');
        const koBtn = a.dataset.side === 'ko' ? a : b;
        if (a.dataset.k === b.dataset.k) {
          a.classList.add('done'); b.classList.add('done');
          if (!missed.has(a.dataset.k)) Store.answer(a.dataset.k, true);
          if (--left_ === 0) { round++; setTimeout(() => { if (alive) (round < rounds ? drawRound : end)(); }, 350); }
        } else {
          misses++; [a, b].forEach((x) => { x.classList.add('miss'); setTimeout(() => x.classList.remove('miss'), 400); });
          if (!missed.has(koBtn.dataset.k)) { missed.add(koBtn.dataset.k); Store.answer(koBtn.dataset.k, false); }
        }
      }));
    }
    function end() {
      clearInterval(timer); document.body.classList.remove('in-session');
      const ms = Date.now() - t0, best = Store.meta('matchBest');
      const record = misses === 0 && (!best || ms < best);
      if (record) Store.setMeta('matchBest', ms);
      root.innerHTML = `<section class="finish">
        <div class="stamp lg"><span>${misses === 0 ? '참 잘했어요' : misses <= 3 ? '잘했어요' : '힘내요'}</span></div>
        <div class="score">${fmt(ms)}</div>
        <p class="muted">${rounds * PAIRS} пар · ошибок: ${misses}${record ? ' · новый рекорд без ошибок' : best ? ` · рекорд без ошибок ${fmt(best)}` : ''}</p>
        <div class="row"><a class="btn" href="#/practice/match?l=${nums.join(',')}&r=${Date.now()}">Ещё раз</a><a class="btn ghost" href="#/">На главную</a></div></section>`;
    }
    start.cleanup = () => { alive = false; clearInterval(timer); window.speechSynthesis?.cancel(); document.body.classList.remove('in-session'); };
    drawRound();
  }

  const mistakes = (nums) => buildPool('mistakes', nums).map((it) => ({ ...it, s: Store.get(it.key) })).sort((a, b) => b.s.wrong - a.s.wrong);

  window.Practice = { MODES, GEN, start, buildPool, mistakes, micSupported, cleanup: () => start.cleanup && start.cleanup() };
})();
