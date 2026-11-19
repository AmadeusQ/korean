// Упражнения: генерация вопросов и экран тренировки.
(function () {
  const { esc, shuffle, pick, uniqBy, icon, sayBtn } = UI;
  const H = Hangul;

  const MODES = {
    mix: { title: 'Всё вперемешку', desc: 'Слова, хангыль, грамматика и фразы', icon: 'shuffle' },
    words: { title: 'Слова', desc: 'Перевод в обе стороны и набор', icon: 'dict' },
    cards: { title: 'Карточки', desc: 'Вспомни перевод и оцени себя', icon: 'cards' },
    listen: { title: 'Аудирование', desc: 'Услышь и выбери, что прозвучало', icon: 'ear', tts: true },
    hangul: { title: 'Хангыль', desc: 'Буквы, слоги и патчим', icon: 'letters' },
    grammar: { title: 'Грамматика', desc: '이에요 / 예요 и 은 / 는', icon: 'pen' },
    build: { title: 'Собери фразу', desc: 'Расставь слова по порядку', icon: 'puzzle' },
  };
  const SESSION_LEN = 15;

  // ---------- пул заданий ----------
  function unlocked(nums) {
    const units = DB.hangulUnits(nums); const vowels = [], cons = [];
    units.forEach((u) => { const U = H.UNITS[u]; (U.items || []).forEach((it) => (U.kind === 'vowel' ? vowels : cons).push(it[0])); });
    return { units, vowels, cons };
  }

  function buildPool(mode, nums) {
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
      if (gids.includes('topic')) {
        shuffle([...persons, ...nouns]).slice(0, 20).forEach((e) => add('grammar', 'g:topic:' + e.ko, ['topic'], { entry: e }));
        for (let i = 0; i < 12 && persons.length && jobs.length; i++) {
          const p = pick(persons), jb = pick(jobs);
          add('grammar', 'g:sent:' + p.ko + '|' + jb.ko, ['sentence'], { p, jb });
        }
      }
    }
    if (['mix', 'build'].includes(mode)) {
      const lines = [
        ...entries.filter((e) => e.kind === 'phrase').map((e) => ({ ko: e.ko, ru: e.ru, key: e.key })),
        ...DB.dialogues(nums).flatMap((d) => d.lines.map((l) => ({ ko: l.ko, ru: l.ru, key: 'd:' + l.ko }))),
        ...DB.grammar(nums).flatMap((g) => g.examples.map((x) => ({ ko: x.ko, ru: x.ru, key: 'd:' + x.ko }))),
      ];
      uniqBy(lines, (l) => l.ko).filter((l) => l.ko.trim().split(/\s+/).length >= 2)
        .forEach((l) => add('build', 'build:' + l.ko, ['build'], { line: l }));
    }
    return uniqBy(pool, (p) => p.key);
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
      if (out.length >= n) break; const kx = keyFn(x); if (seen.has(kx)) continue; seen.add(kx); out.push(x);
    }
    return out;
  }
  const entryExplain = (e) => `<div class="ex-line"><span class="ko">${esc(e.ko)}</span>${UI.rr(e.ko)}${sayBtn(e.ko, 'sm')}</div><div class="ex-ru">${esc(e.ru)}</div>`;
  const sameKind = (e) => DB.entries.filter((x) => x.kind === e.kind);
  const lenNear = (e) => sameKind(e).filter((x) => Math.abs([...x.ko].length - [...e.ko].length) <= 1);

  function variants(j, J, n = 3) {
    const info = H.jamoInfo(j); const same = info.kind === 'vowel' ? J.vowels : J.cons;
    const sim = H.similarTo(j).filter((x) => same.includes(x));
    return uniqBy([...shuffle(sim), ...shuffle(same)].filter((x) => x !== j), (x) => x).slice(0, n);
  }
  function syllFor(j, J) {
    const info = H.jamoInfo(j);
    if (info.kind === 'vowel') { const c = J.cons.length ? pick(J.cons.filter((x) => x !== 'ㅇ').concat('ㅇ')) : 'ㅇ'; return { c, v: j, target: 'v' }; }
    return { c: j, v: J.vowels.length ? pick(J.vowels) : 'ㅏ', target: 'c' };
  }

  const GEN = {
    'ko-ru'(it) {
      const e = it.entry;
      const ds = fillDistractors(e, sameKind(e).filter((x) => x.c === e.c), sameKind(e), 3, (x) => x.ru);
      return { kind: 'choice', label: 'Что это значит?', prompt: `<div class="q-ko">${esc(e.ko)}</div>${sayBtn(e.ko)}`,
        options: shuffle([e, ...ds]).map((x) => ({ text: x.ru, ok: x === e })), say: e.ko, explain: entryExplain(e) };
    },
    'ru-ko'(it) {
      const e = it.entry;
      const ds = fillDistractors(e, lenNear(e).filter((x) => x.c === e.c), lenNear(e), 3, (x) => x.ko);
      return { kind: 'choice', label: 'Как сказать по-корейски?', prompt: `<div class="q-ru">${esc(e.ru)}</div>`,
        options: shuffle([e, ...ds]).map((x) => ({ text: x.ko, ok: x === e, ko: true })), sayAfter: e.ko, explain: entryExplain(e) };
    },
    'listen-word'(it) {
      const e = it.entry;
      const ds = fillDistractors(e, lenNear(e), sameKind(e), 3, (x) => x.ko);
      return { kind: 'choice', label: 'Что прозвучало?', autoplay: e.ko,
        prompt: `<button class="big-say" data-say="${esc(e.ko)}">${icon('speaker')}</button><div class="hint">Нажми, чтобы послушать ещё раз</div>`,
        options: shuffle([e, ...ds]).map((x) => ({ text: x.ko, ok: x === e, ko: true })), explain: entryExplain(e) };
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
        prompt: toName ? `<div class="q-jamo">${j}</div>` : `<div class="q-ko">${name}</div>`, sayAfter: name,
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
      const vs = variants(it.jamo, it.J).map((x) => (target === 'v' ? H.compose(c, x) : H.compose(x, v)));
      return { kind: 'choice', label: 'Какой слог прозвучал?', autoplay: s,
        prompt: `<button class="big-say" data-say="${s}">${icon('speaker')}</button><div class="hint">Нажми, чтобы послушать ещё раз</div>`,
        options: shuffle(uniqBy([s, ...vs], (x) => x).map((x) => ({ text: x, ok: x === s, ko: true }))),
        explain: `<div class="ex-line"><span class="ko">${s}</span> <span class="rr">${H.romanize(s)}</span>${sayBtn(s, 'sm')}</div>` };
    },
    batchim(it) {
      const e = it.entry; const last = [...e.ko].pop(); const d = H.decompose(last); const snd = H.JONG_SOUND[d.jong];
      const sounds = Object.keys(H.SOUND_RR);
      const opts = shuffle([snd, ...shuffle(sounds.filter((x) => x !== snd)).slice(0, 3)]).map((x) => ({ text: `[${x}] ${H.SOUND_RR[x]}`, ok: x === snd }));
      return { kind: 'choice', label: 'Как звучит патчим?', prompt: `<div class="q-ko">${esc(e.ko)}</div><div class="hint">последняя согласная: <b class="ko">${d.jong}</b></div>`,
        options: opts, sayAfter: e.ko,
        explain: `<div class="ex-line">Патчим <b class="ko">${d.jong}</b> на конце звучит как <b class="ko">[${snd}]</b></div>${entryExplain(e)}` };
    },
    copula(it) {
      const e = it.entry; const ok = H.copula(e.ko);
      return { kind: 'choice', label: 'Выбери окончание', prompt: `<div class="q-ko">${esc(e.ko)}<span class="blank">___</span></div><div class="hint">«это ${esc(e.ru)}»</div>`,
        options: ['이에요', '예요'].map((x) => ({ text: x, ok: x === ok, ko: true })), sayAfter: e.ko + ok,
        explain: `<div class="ex-line">${esc(e.ko)} кончается на ${H.hasBatchim(e.ko) ? 'согласную → <b>이에요</b>' : 'гласную → <b>예요</b>'}</div><div class="ex-line"><span class="ko">${esc(e.ko + ok)}</span>${sayBtn(e.ko + ok, 'sm')}</div>` };
    },
    topic(it) {
      const e = it.entry; const ok = H.topic(e.ko);
      return { kind: 'choice', label: 'Выбери частицу темы', prompt: `<div class="q-ko">${esc(e.ko)}<span class="blank">___</span></div><div class="hint">${esc(e.ru)}</div>`,
        options: ['은', '는'].map((x) => ({ text: x, ok: x === ok, ko: true })), sayAfter: e.ko + ok,
        explain: `<div class="ex-line">${esc(e.ko)} кончается на ${H.hasBatchim(e.ko) ? 'согласную → <b>은</b>' : 'гласную → <b>는</b>'}</div>` };
    },
    sentence(it) {
      const { p, jb } = it; const a = H.topic(p.ko), b = H.copula(jb.ko);
      const full = `${p.ko}${a} ${jb.ko}${b}.`;
      const combos = [['은', '이에요'], ['은', '예요'], ['는', '이에요'], ['는', '예요']];
      return { kind: 'choice', label: 'Заполни пропуски', prompt: `<div class="q-ko md">${esc(p.ko)}<span class="blank">__</span> ${esc(jb.ko)}<span class="blank">__</span>.</div><div class="hint">${esc(p.ru)} — ${esc(jb.ru)}</div>`,
        options: combos.map(([x, y]) => ({ text: `${x} … ${y}`, ok: x === a && y === b, ko: true })), sayAfter: full,
        explain: `<div class="ex-line"><span class="ko">${esc(full)}</span>${sayBtn(full, 'sm')}</div>` };
    },
    build(it) {
      const l = it.line; const tokens = l.ko.trim().split(/\s+/);
      let order = shuffle(tokens.map((t, i) => i));
      if (tokens.length > 1 && order.every((x, i) => x === i)) order = order.reverse();
      return { kind: 'build', label: 'Собери фразу', prompt: `<div class="q-ru">${esc(l.ru)}</div>`, tokens, order, answer: l.ko, sayAfter: l.ko,
        explain: `<div class="ex-line"><span class="ko">${esc(l.ko)}</span>${sayBtn(l.ko, 'sm')}</div>` };
    },
  };

  const norm = (s) => s.replace(/[\s.,!?·…'"]/g, '');

  // ---------- экран тренировки ----------
  function start(root, mode, nums) {
    const pool = buildPool(mode, nums);
    if (!pool.length) {
      root.innerHTML = `<section class="empty">${MODES[mode].tts && !TTS.available() ? 'Для аудирования нужен корейский голос. Как его включить — в «Настройках».' : 'Для этого режима пока нет материала в выбранных уроках.'}<br><a class="btn" href="#/practice">Назад</a></section>`;
      return;
    }
    const queue = choose(pool, SESSION_LEN, mode);
    const retried = new Set();
    const results = [];
    let idx = 0, q = null, answered = false;
    document.body.classList.add('in-session');

    root.innerHTML = `
      <section class="session">
        <header class="s-top">
          <a class="icon-btn" href="#/practice" aria-label="Выйти">${icon('close')}</a>
          <div class="bar"><i></i></div>
          <span class="s-count"></span>
        </header>
        <div class="s-body"></div>
        <footer class="s-foot"></footer>
      </section>`;
    const $body = root.querySelector('.s-body'), $foot = root.querySelector('.s-foot');

    function progress() {
      root.querySelector('.bar i').style.width = (idx / queue.length) * 100 + '%';
      root.querySelector('.s-count').textContent = `${Math.min(idx + 1, queue.length)} / ${queue.length}`;
    }

    function next() {
      if (idx >= queue.length) return finish();
      const it = queue[idx];
      q = GEN[pick(it.types)](it); q.item = it; answered = false;
      progress();
      $foot.className = 's-foot'; $foot.innerHTML = '';
      if (q.kind === 'choice') renderChoice();
      else if (q.kind === 'type') renderType();
      else if (q.kind === 'build') renderBuild();
      else if (q.kind === 'card') renderCard();
      if (q.autoplay) setTimeout(() => TTS.speak(q.autoplay), 250);
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
      $body.innerHTML = head() + `<form class="type-form"><input class="type-in" lang="ko" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="한글로…"><button class="btn">Проверить</button></form>
        <div class="hint">Нужна корейская раскладка. <button type="button" class="link show-hint">Подсказка: первый слог</button></div>`;
      const f = $body.querySelector('form'), inp = $body.querySelector('input');
      setTimeout(() => inp.focus(), 50);
      $body.querySelector('.show-hint').addEventListener('click', (e) => { e.target.textContent = 'Начинается с: ' + [...q.answer][0]; });
      f.addEventListener('submit', (e) => {
        e.preventDefault(); if (answered) return;
        const v = inp.value.trim(); if (!v) return;
        const ok = norm(v) === norm(q.answer);
        inp.disabled = true; inp.classList.add(ok ? 'right' : 'wrong');
        done(ok);
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
          if (picked.length === q.tokens.length) {
            const ok = picked.map((t) => q.tokens[t]).join(' ') === q.tokens.join(' ');
            $line.classList.add(ok ? 'right' : 'wrong'); done(ok);
          }
        }));
      }
      draw();
    }

    function renderCard() {
      const e = q.entry; const koFront = q.front === 'ko';
      const front = koFront ? `<div class="q-ko">${esc(e.ko)}</div>` : `<div class="q-ru">${esc(e.ru)}</div>`;
      const back = `<div class="card-back"><div class="q-ko md">${esc(e.ko)}</div>${UI.rr(e.ko)}<div class="q-ru sm">${esc(e.ru)}</div>${sayBtn(e.ko)}</div>`;
      $body.innerHTML = `<div class="q-label">${koFront ? 'Вспомни перевод' : 'Вспомни по-корейски'}</div><div class="flash"><div class="flash-front">${front}${koFront ? sayBtn(e.ko) : ''}</div></div>`;
      if (koFront) setTimeout(() => TTS.speak(e.ko), 200);
      $foot.innerHTML = `<button class="btn wide reveal">Показать ответ</button>`;
      $foot.querySelector('.reveal').addEventListener('click', () => {
        $body.querySelector('.flash').innerHTML = back; if (!koFront) TTS.speak(e.ko);
        $foot.innerHTML = `<div class="grade"><button class="btn bad" data-g="0">Не вспомнил</button><button class="btn good" data-g="1">Помню</button></div>`;
        $foot.querySelectorAll('[data-g]').forEach((b) => b.addEventListener('click', () => { answered = true; record(b.dataset.g === '1'); idx++; next(); }));
      });
    }

    function record(ok) {
      Store.answer(q.item.key, ok);
      results.push({ q, ok });
      if (!ok && !retried.has(q.item.key)) { retried.add(q.item.key); queue.push(q.item); }
    }

    function done(ok) {
      answered = true; record(ok);
      if (q.sayAfter) TTS.speak(q.sayAfter);
      $foot.className = 's-foot show ' + (ok ? 'ok' : 'bad');
      $foot.innerHTML = `<div class="fb"><div class="fb-title">${icon(ok ? 'check' : 'close')} ${ok ? pick(['Верно!', 'Отлично!', '잘했어요!', 'Так держать!']) : 'Не совсем'}</div>
        <div class="fb-ex">${q.explain || ''}</div></div><button class="btn wide next">Дальше</button>`;
      const nb = $foot.querySelector('.next'); nb.addEventListener('click', () => { idx++; next(); }); nb.focus({ preventScroll: true });
    }

    function finish() {
      document.body.classList.remove('in-session');
      document.removeEventListener('keydown', onKey);
      const first = new Map(); results.forEach((r) => { if (!first.has(r.q.item.key)) first.set(r.q.item.key, r.ok); });
      const total = first.size, right = [...first.values()].filter(Boolean).length;
      const pct = total ? Math.round((right / total) * 100) : 0;
      const mistakes = uniqBy(results.filter((r) => !r.ok), (r) => r.q.item.key);
      root.innerHTML = `<section class="finish">
        <div class="ring big" style="--p:${pct}"><div><b>${pct}%</b><span>с первого раза</span></div></div>
        <h2>${pct >= 90 ? '훌륭해요! Прекрасно!' : pct >= 70 ? '잘했어요! Хорошо!' : 'Продолжай, всё получится 화이팅!'}</h2>
        <p class="muted">${right} из ${total} верно сразу · всего ответов: ${results.length}</p>
        ${mistakes.length ? `<div class="card"><h3>Стоит повторить</h3>${mistakes.map((r) => `<div class="mist">${r.q.explain || (r.q.entry ? `<span class="ko">${esc(r.q.entry.ko)}</span> — ${esc(r.q.entry.ru)}` : '')}</div>`).join('')}</div>` : ''}
        <div class="row"><a class="btn" href="#/practice/${mode}?l=${nums.join(',')}&r=${Date.now()}">Ещё раз</a><a class="btn ghost" href="#/">На главную</a></div>
      </section>`;
    }

    function onKey(e) {
      if (!document.body.classList.contains('in-session')) return;
      if (e.target.tagName === 'INPUT' && e.key !== 'Enter') return;
      if (answered && e.key === 'Enter') { e.preventDefault(); $foot.querySelector('.next')?.click(); return; }
      if (!answered && q?.kind === 'choice' && /^[1-4]$/.test(e.key)) { const i = +e.key - 1; if (q.options[i]) choose_(i); }
      if (!answered && q?.kind === 'card' && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); $foot.querySelector('.reveal')?.click(); }
    }
    document.addEventListener('keydown', onKey);
    start.cleanup = () => { document.removeEventListener('keydown', onKey); document.body.classList.remove('in-session'); };
    next();
  }

  window.Practice = { MODES, GEN, start, buildPool, cleanup: () => start.cleanup && start.cleanup() };
})();
