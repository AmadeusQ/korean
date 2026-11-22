// Чтение: тексты к урокам из пройденных слов. Сначала читаешь сам (нажатие на слово — перевод и как читается),
// потом отвечаешь на вопросы, потом читаешь вслух на время: скорость в слогах в минуту видна от раза к разу.
(function () {
  const { esc, shuffle, icon, sayBtn } = UI;
  const H = Hangul;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const syllables = (s) => (s.match(/[가-힣]/g) || []).length;
  const onlyHangul = (s) => (s.match(/[가-힣]/g) || []).join('');
  const lessonName = (n) => `제${n}과`;
  let stopActive = null; // распознавание или таймер текущего экрана: останавливаем при уходе со страницы
  const once = (fn) => { let done = false; return (...a) => { if (!done) { done = true; fn(...a); } }; };

  // Замер засчитан: вслух расслышано от 80% слов. «Про себя» — отдельный счёт: так читают быстрее, и рекорд вслух иначе не побить
  const counted = (r) => r.acc >= 80;
  const silent = (r) => r.acc < 0;
  // последний результат по тексту и лучший — отдельно вслух и про себя
  function stat(id) {
    const rs = Store.reads(id); if (!rs.length) return null;
    const best = (f) => { const xs = rs.filter(f); return xs.length ? Math.max(...xs.map((r) => r.spm)) : null; };
    return { last: rs[rs.length - 1], best: best(counted), bestSilent: best(silent), n: rs.length };
  }
  const resLabel = (r) => `${r.spm} слог/мин${r.acc >= 0 ? ` · ${r.acc}%` : ' · про себя'}`;

  // ---------- список текстов ----------
  function list(root) {
    const nums = DB.openNums().filter((n) => n > 0);
    const texts = DB.texts(nums).slice().sort((a, b) => b.lesson - a.lesson || (a.words === b.words ? 0 : a.words ? 1 : -1));
    const now = Date.now();
    const row = (t) => {
      const s = stat(t.id), due = Store.isDue('txt:' + t.id, now);
      const status = !s ? '<span class="muted xs">не читал</span>' : due ? '<span class="rd-due xs">пора перечитать</span>' : `<span class="muted xs">${resLabel(s.last)}</span>`;
      const preview = t.lines.map((l) => l.ko).join(' ');
      return `<a class="mode rd-row" href="#/read/${esc(t.id)}"><span class="mode-ex serif">${lessonName(t.lesson)}</span>
        <span class="mode-t"><b>${esc(t.title)}</b><span class="ko rd-prev">${esc(preview)}</span>${status}</span><span class="arr">→</span></a>`;
    };
    root.innerHTML = `<h1 class="page-title">Чтение</h1>
      ${speedCard(true)}
      <div class="card note"><p class="sm">Как читать: сначала сам, нажимая на незнакомые слова. Потом ответь на вопросы под текстом. В конце прочитай вслух на время: скорость покажет, как растёт чтение.</p></div>
      ${texts.length ? `<div class="modes">${texts.map(row).join('')}</div>` : '<p class="muted center">Тексты появятся с первыми уроками.</p>'}
      <p class="muted xs center">Новые тексты добавляются вместе с уроками.</p>`;
  }

  // Скорость чтения вслух: последние 30 прочтений столбиками
  function speedCard(compact) {
    const all = Store.reads(), aloud = all.filter(counted), quiet = all.filter(silent);
    const rs = (aloud.length ? aloud : quiet).slice(-30), mode = aloud.length ? 'вслух' : 'про себя';
    if (!rs.length) return compact ? '' : '<div class="card"><h3>Скорость чтения</h3><p class="muted sm">Пока нет замеров. Прочитай любой текст вслух на время в разделе <a class="link" href="#/read">Чтение</a>.</p></div>';
    const top = Math.max(...rs.map((r) => r.spm), 1), last = rs[rs.length - 1], best = Math.max(...rs.map((r) => r.spm));
    const first = rs.slice(0, Math.min(3, rs.length)), avg = (xs) => Math.round(xs.reduce((a, r) => a + r.spm, 0) / xs.length);
    const growth = rs.length >= 6 ? avg(rs.slice(-3)) - avg(first) : null;
    return `<div class="card"><div class="card-head"><h3>Скорость чтения <span class="muted sm">· ${mode}</span></h3>${compact ? '' : '<a class="link sm" href="#/read">Тексты →</a>'}</div>
      <section class="stats rd-stats">
        <div><b>${last.spm}</b><span>слогов в минуту в прошлый раз</span></div>
        <div><b>${best}</b><span>лучшая скорость</span></div>
        ${growth !== null ? `<div><b>${growth > 0 ? '+' : ''}${growth}</b><span>к первым замерам</span></div>` : ''}
      </section>
      <div class="bars sm-bars" role="img" aria-label="Скорость чтения по замерам">${rs.map((r) => `<i class="full" style="height:${(r.spm / top) * 100}%" title="${new Date(r.at).toLocaleDateString('ru')}: ${r.spm} слог/мин${r.acc >= 0 ? `, расслышано ${r.acc}%` : ', про себя'}"></i>`).join('')}</div>
      <div class="bars-x muted xs"><span>первый замер</span><span>последний</span></div>
      ${aloud.length && quiet.length ? `<p class="muted xs rd-quiet">Про себя: последний раз ${quiet[quiet.length - 1].spm}, лучшая ${Math.max(...quiet.map((r) => r.spm))} слог/мин</p>` : ''}</div>`;
  }

  // ---------- текст ----------
  function text(root, id) {
    stop();
    const t = DB.text(id);
    if (!t) { root.innerHTML = '<section class="empty">Такого текста нет.<br><a class="btn" href="#/read">Все тексты</a></section>'; return; }
    const lines = t.lines.map((l) => ({ ...l, words: DB.parseLine(l.ko, t.names) }));
    const s = stat(t.id);
    const items = [...(t.questions || []).map((q) => ({ key: 'rd:' + q.q, q })), ...(t.facts || []).map((f) => ({ key: 'tf:' + f.ko, f }))];
    root.innerHTML = `<a class="back" href="#/read">${icon('back')} Все тексты</a>
      <div class="kicker serif">${lessonName(t.lesson)} · 읽기</div><h1 class="rd-title">${esc(t.title)}</h1>
      <div class="row rd-tools">
        ${TTS.available() ? `<button type="button" class="btn ghost sm rd-play">${icon('speaker')} <span>Слушать</span></button>` : ''}
        <label class="toggle"><input type="checkbox" class="rd-ru-on"> Перевод</label>
        ${s ? `<span class="muted xs">Прочитан ${s.n} ${s.n % 10 === 1 && s.n % 100 !== 11 ? 'раз' : s.n % 10 >= 2 && s.n % 10 <= 4 && (s.n % 100 < 10 || s.n % 100 >= 20) ? 'раза' : 'раз'}${s.best ? ` · лучшая вслух ${s.best} слог/мин` : s.bestSilent ? ` · лучшая про себя ${s.bestSilent} слог/мин` : ''}</span>` : ''}
      </div>
      <div class="card rd-text ${t.words ? 'rd-words' : ''}">${lines.map((l, i) => `<div class="rd-line" data-i="${i}">
        ${l.who ? `<span class="who ko">${esc(l.who)}</span>` : ''}
        <div class="rd-body"><p class="rd-ko ko">${l.words.map((w, k) => `<button type="button" class="rw" data-i="${i}" data-k="${k}">${esc(w.text)}</button>`).join(' ')}</p>
        <p class="rd-tr">${esc(l.ru)}</p></div>${sayBtn(t.words ? l.words.map((w) => w.text).join(', ') : l.ko, 'sm')}</div>`).join('')}</div>
      <p class="muted xs">Нажми на слово: покажу перевод и как оно читается.</p>
      ${items.length ? `<div class="card rd-quiz"><h3>Понял ли текст?</h3>${shuffle(items).map((it, n) => quizHtml(it, n)).join('')}</div>` : ''}
      <div class="card rd-timed"><h3>Прочитай вслух на время</h3><div class="rd-timer-body"></div></div>`;

    const textEl = root.querySelector('.rd-text');
    root.querySelector('.rd-ru-on').addEventListener('change', (e) => textEl.classList.toggle('show-ru', e.target.checked));
    textEl.addEventListener('click', (e) => {
      const b = e.target.closest('.rw'); if (!b) return;
      wordPop(lines[+b.dataset.i].words[+b.dataset.k]);
    });
    const play = root.querySelector('.rd-play');
    play?.addEventListener('click', () => {
      if (play.classList.contains('on')) { TTS.stop(); return; }
      // текст — по строкам; «Слова урока» — по одному слову с паузой (строкой подряд диктор читал их как одну фразу)
      const parts = t.words ? [...textEl.querySelectorAll('.rw')] : [...textEl.querySelectorAll('.rd-line')];
      const say = t.words ? parts.map((b) => lines[+b.dataset.i].words[+b.dataset.k].text) : t.lines.map((l) => l.ko);
      play.classList.add('on'); play.querySelector('span').textContent = 'Стоп';
      TTS.speakAll(say, (i) => {
        parts.forEach((r, k) => r.classList.toggle('speaking', k === i));
        if (i < 0) { play.classList.remove('on'); play.querySelector('span').textContent = 'Слушать'; }
      });
    });
    root.querySelectorAll('.rq').forEach((el) => bindQuiz(el, items, lines));
    timed(root.querySelector('.rd-timer-body'), t, lines, textEl);
  }

  // нажатое слово: основа, окончание, как читается
  function wordPop(w) {
    document.querySelectorAll('.sheet-wrap').forEach((x) => x.remove());
    const word = w.text.replace(/[.,!?…«»"]/g, '');
    const pr = H.pron(word);
    const box = document.createElement('div'); box.className = 'sheet-wrap';
    box.innerHTML = `<div class="sheet rd-sheet" role="dialog" aria-label="${esc(word)}">
      <button class="icon-btn sheet-x" aria-label="Закрыть">${icon('close')}</button>
      <div class="sheet-head"><span class="ko rd-big">${esc(word)}</span>${sayBtn(word)}</div>
      ${pr !== word ? `<div class="sheet-pr">Читается: <span class="ko">[${esc(pr)}]</span></div>` : ''}
      ${Store.settings().romanize ? `<div class="rr sheet-rr">${esc(H.romanize(word))}</div>` : ''}
      <div class="rd-parts">
        <div><span class="ko">${esc(w.base)}</span> — ${esc(w.ru || 'нет в словаре')}</div>
        ${w.suf ? `<div><span class="ko">+ ${esc(w.suf)}</span> — ${esc(w.sufRu)}</div>` : ''}
      </div>
      ${w.entry ? '<button type="button" class="link rd-card">Карточка слова →</button>' : ''}
    </div>`;
    const close = () => { box.remove(); document.removeEventListener('keydown', key); };
    const key = (ev) => { if (!box.isConnected) return close(); if (ev.key === 'Escape') close(); };
    box.addEventListener('click', (ev) => { if (ev.target === box || ev.target.closest('.sheet-x')) close(); });
    box.querySelector('.rd-card')?.addEventListener('click', () => { close(); Views.wordSheet(w.entry); });
    document.addEventListener('keydown', key);
    document.body.appendChild(box);
  }

  // ---------- вопросы по тексту (те же ключи rd:/tf:, что в «Прочитай и ответь») ----------
  function quizHtml(it, n) {
    const opts = it.q ? shuffle([it.q.a, ...it.q.wrong]).map((x) => ({ text: x, ok: x === it.q.a })) : [{ text: 'Верно', ok: it.f.ok }, { text: 'Неверно', ok: !it.f.ok }];
    const ask = it.q ? esc(it.q.q) : `Верно ли: <span class="ko">${esc(it.f.ko)}</span>`;
    return `<div class="rq" data-n="${n}" data-key="${esc(it.key)}"><div class="rq-q">${ask}</div>
      <div class="opts rq-opts">${opts.map((o) => `<button type="button" class="opt" data-ok="${o.ok ? 1 : ''}">${esc(o.text)}</button>`).join('')}</div><div class="rq-ex"></div></div>`;
  }
  function bindQuiz(el, items, lines) {
    const it = items.find((x) => x.key === el.dataset.key);
    el.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
      const ok = !!b.dataset.ok;
      el.querySelectorAll('.opt').forEach((x) => { x.disabled = true; if (x.dataset.ok) x.classList.add('right'); });
      if (!ok) b.classList.add('wrong');
      Store.answer(it.key, ok);
      const at = lines[(it.q || it.f).at];
      el.querySelector('.rq-ex').innerHTML = `${it.f ? `<div class="ex-ru">«${esc(it.f.ru)}» — ${it.f.ok ? 'верно' : 'неверно'}</div>` : ''}${at ? `<div class="ex-ru">В тексте: <span class="ko">${esc(at.ko)}</span> — ${esc(at.ru)}</div>` : ''}`;
    }));
  }

  // ---------- чтение вслух на время ----------
  function timed(el, t, lines, textEl) {
    const total = syllables(t.lines.map((l) => l.ko).join(' '));
    const mic = !!SR;
    const idle = (note = '') => {
      el.innerHTML = `${note}<p class="sm muted">${mic ? 'Читай весь текст вслух в обычном темпе. Засеку время и проверю, какие слова расслышал.' : 'Этот браузер не распознаёт речь, поэтому засеку только время. Прочитай текст вслух или про себя.'}</p>
        <div class="row">${mic ? `<button type="button" class="btn rd-go" data-mic="1">${icon('mic')} Начать вслух</button>` : ''}<button type="button" class="btn ${mic ? 'ghost' : ''} rd-go">${mic ? 'Про себя' : 'Начать'}</button></div>`;
      el.querySelectorAll('.rd-go').forEach((b) => b.addEventListener('click', () => run(!!b.dataset.mic)));
    };
    const run = (useMic) => {
      textEl.querySelectorAll('.rw.miss').forEach((x) => x.classList.remove('miss'));
      TTS.stop();
      el.innerHTML = '<p class="sm muted">Идёт замер…</p>';
      // часы и «Готово» прибиты к низу экрана: текст длинный, а карточка замера под вопросами
      document.querySelectorAll('.rd-bar').forEach((x) => x.remove());
      const bar = document.createElement('div'); bar.className = 'rd-bar'; bar.setAttribute('role', 'status');
      bar.innerHTML = `<span class="rd-clock serif">0:00</span>${useMic ? `<span class="rd-rec">${icon('mic')}</span>` : ''}<span class="rd-hint sm muted">${useMic ? 'Читай вслух' : 'Читай'}</span>
        <button type="button" class="btn ghost sm rd-cancel">Отмена</button><button type="button" class="btn sm rd-done">Готово</button>`;
      document.body.appendChild(bar);
      textEl.scrollIntoView({ block: 'start', behavior: 'smooth' });
      const t0 = Date.now(), clock = bar.querySelector('.rd-clock');
      const tick = setInterval(() => { const s = Math.floor((Date.now() - t0) / 1000); clock.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }, 250);
      let heard = [], rec = null, live = true, err = '';
      // распознавание на телефоне само останавливается после паузы: перезапускаем, пока читаешь
      const listen = () => {
        if (!useMic || !live) return;
        rec = new SR(); rec.lang = 'ko-KR'; rec.continuous = true; rec.interimResults = false; rec.maxAlternatives = 1;
        rec.onresult = (ev) => { for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) heard.push(ev.results[i][0].transcript); };
        // no-speech и aborted — обычные паузы, после них перезапуск; остальное без толку повторять
        rec.onerror = (ev) => {
          const why = { 'not-allowed': 'Нет доступа к микрофону — разреши его в браузере.', 'service-not-allowed': 'Нет доступа к микрофону — разреши его в браузере.',
            'audio-capture': 'Микрофон не найден.', network: 'Распознаванию речи нужен интернет.', 'language-not-supported': 'Браузер не распознаёт корейскую речь.' }[ev.error];
          if (why) { err = why; live = false; bar.querySelector('.rd-hint').textContent = why; }
        };
        rec.onend = () => { rec = null; if (live) setTimeout(listen, 50); };
        try { rec.start(); } catch { rec = null; }
      };
      listen();
      const finish = (save) => {
        live = false; clearInterval(tick); stopActive = null; bar.remove();
        const ms = Date.now() - t0;
        const after = () => {
          if (!save) return idle();
          if (err) return idle(`<p class="sm rd-err">${esc(err)}</p>`);
          if (ms < 3000) return idle('<p class="sm rd-err">Слишком быстро — похоже, нажал «Готово» случайно.</p>');
          const spm = Math.round(total / (ms / 60000));
          // вслух быстрее 600 слогов в минуту не читают и носители: значит, «Готово» нажато раньше, чем дочитал
          if (spm > 600) return idle('<p class="sm rd-err">Слишком быстро — похоже, нажал «Готово», не дочитав. Попробуй ещё раз.</p>');
          let acc = -1;
          if (useMic) {
            const got = onlyHangul(heard.join(' '));
            if (!got) return idle('<p class="sm rd-err">Ничего не расслышал. Проверь микрофон и попробуй ещё раз.</p>');
            const r = score(got, [...textEl.querySelectorAll('.rw')], lines);
            acc = r.acc; r.miss.forEach((b) => b.classList.add('miss'));
          }
          const prev = stat(t.id);
          Store.addRead(t.id, spm, acc);
          const prevBest = acc < 0 ? prev?.bestSilent : prev?.best;
          const better = prevBest && (acc < 0 || acc >= 80) ? spm - prevBest : null;
          const m = Math.floor(ms / 60000), sec = Math.round((ms % 60000) / 1000);
          idle(`<div class="rd-result"><div><b class="serif">${spm}</b><span>слогов в минуту</span></div>${acc >= 0 ? `<div><b class="serif">${acc}%</b><span>слов расслышано</span></div>` : ''}<div><b class="serif">${m ? m + ' мин ' : ''}${sec} с</b><span>время</span></div></div>
            ${better !== null ? `<p class="sm">${better > 0 ? `Быстрее лучшего раза на ${better} слог/мин.` : better === 0 ? 'Как в лучший раз.' : `Лучший раз был ${prevBest} слог/мин.`}</p>` : ''}
            ${acc >= 0 && acc < 100 ? '<p class="sm muted">Слова, которые я не расслышал, подчёркнуты в тексте красным: прочитай их ещё раз с диктором.</p>' : ''}
            ${acc >= 0 && acc < 80 ? '<p class="sm muted">Скорость засчитывается в рекорд, когда расслышано от 80% слов.</p>' : ''}`);
        };
        // последние слова распознаются уже после stop(): ждём onend, но не дольше 2,5 с
        const done = once(after);
        if (rec) { const r = rec; r.onend = done; try { r.stop(); } catch { done(); } setTimeout(done, 2500); }
        else done();
      };
      const fin = once(finish);
      bar.querySelector('.rd-done').addEventListener('click', () => fin(true));
      bar.querySelector('.rd-cancel').addEventListener('click', () => fin(false));
      stopActive = () => { live = false; clearInterval(tick); bar.remove(); try { rec?.abort(); } catch { /* уже остановлено */ } };
    };
    idle();
  }

  // Сколько слов текста расслышано. Идём по тексту по порядку и ищем слово в распознанном после предыдущего найденного
  // (не дальше 12 слогов вперёд): иначе частые 저는, 제, 사람이에요 засчитывались бы, даже если прочитана половина текста.
  // Окончания распознаются неровно — достаточно основы от двух слогов. Имена и числа не считаем: их пишут как попало (피에르, 1번).
  function score(got, btns, lines) {
    let pos = 0, okN = 0, n = 0; const miss = [];
    for (const b of btns) {
      const w = lines[+b.dataset.i].words[+b.dataset.k];
      if (w.name || w.entry?.t === 'num') continue;
      n++;
      const full = onlyHangul(w.text), base = onlyHangul(w.base);
      let hit = -1, len = 0;
      for (const c of [full, base.length >= 2 ? base : '']) {
        if (!c) continue;
        const at = got.indexOf(c, pos);
        if (at >= 0 && at - pos <= 12) { hit = at; len = c.length; break; }
      }
      if (hit >= 0) { okN++; pos = hit + len; } else miss.push(b);
    }
    return { acc: Math.round((okN / Math.max(1, n)) * 100), miss };
  }

  function stop() { if (stopActive) { stopActive(); stopActive = null; } }

  window.Reading = { list, text, speedCard, stop, busy: () => !!stopActive, score };
})();
