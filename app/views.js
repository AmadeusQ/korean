// Экраны: главная, уроки, урок, словарь, хангыль, тренировка, настройки.
(function () {
  const { esc, icon, sayBtn, strength } = UI;
  const H = Hangul;
  const allNums = () => DB.allNums();
  const lessonName = (n) => (n === 0 ? 'Мои слова' : `제${n}과`);
  const avgMastery = (keys) => DB.mastery(keys);
  const learned = (keys) => keys.filter((k) => Store.box(k) >= 3).length;
  const dueCount = () => { const now = Date.now(); return DB.entriesFor(DB.openNums()).filter((e) => Store.isDue(e.key, now)).length; };
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return n + ' ' + (m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c); };

  // ---------- Главная ----------
  const WEEK_KO = '월화수목금토일';
  function home(root) {
    const st = Store.todayStats(), goal = Store.settings().dailyGoal;
    const keys = DB.entries.map((e) => e.key);
    const due = dueCount(), streak = Store.streak();
    const tomorrow = Store.forecastTomorrow(keys);
    const now = new Date();
    const koDate = `${now.getMonth() + 1}월 ${now.getDate()}일 ${'일월화수목금토'[now.getDay()]}요일`;
    // календарь за 4 недели, столбцы — дни недели с понедельника
    const wd = (now.getDay() + 6) % 7;
    const days = Store.lastDays(21 + wd + 1);
    const cal = [...days, ...Array(6 - wd).fill(null)];
    const lvl = (d) => (!d ? 'f' : !d.n ? 0 : d.n >= goal ? 3 : d.n >= goal / 2 ? 2 : 1);
    const CELLS = 10, filled = Math.min(CELLS, Math.floor((st.n / goal) * CELLS));
    const path = DB.path();
    root.innerHTML = `
      <section class="today">
        <div class="today-main">
          <div class="date">${koDate}</div>
          <h1 class="serif">오늘의 공부</h1>
          <p class="muted">${st.n >= goal ? 'Цель на сегодня выполнена.' : `Сегодня ${st.n} из ${goal} ответов.`}
            ${streak ? ` ${plural(streak, 'день', 'дня', 'дней')} подряд.` : ''}</p>
          <div class="goal-bar" role="progressbar" aria-label="Цель дня" aria-valuemin="0" aria-valuemax="${goal}" aria-valuenow="${Math.min(st.n, goal)}"><i style="width:${Math.min(100, Math.round((st.n / goal) * 100))}%"></i></div>
          <div class="row">
            <a class="btn" href="#/practice/mix">Начать тренировку</a>
            <span class="muted sm">${due ? `${plural(due, 'слово ждёт', 'слова ждут', 'слов ждут')} повторения` : 'Повторять пока нечего — можно учить новое'}${tomorrow ? ` · завтра ещё ${tomorrow}` : ''}</span>
          </div>
        </div>
        ${st.n >= goal ? UI.stamp('참 잘했어요') : ''}
      </section>
      ${path.fresh ? welcome() : ''}

      <section class="stats">
        <div><b>${DB.entries.length}</b><span>слов и фраз</span></div>
        <div><b>${learned(keys)}</b><span>хорошо знаю</span></div>
        <div><b>${due}</b><span>к повторению</span></div>
        <div><b>${st.n ? Math.round((st.ok / st.n) * 100) + '%' : '—'}</b><span>точность сегодня</span></div>
      </section>

      <div class="home-cols">
        <section class="block">
          <h2 class="h">Что делать сейчас</h2>
          ${quickList(path, due)}
          <a class="link all-modes" href="#/practice">Все режимы тренировки →</a>
        </section>
        <div>
          <section class="block">
            <h2 class="h">Четыре недели</h2>
            <div class="cal">${[...WEEK_KO].map((w) => `<span class="wd">${w}</span>`).join('')}
              ${cal.map((d) => `<span class="c l${lvl(d)}" ${d ? `title="${d.date}: ${d.n}"` : ''}>${lvl(d) === 3 ? '<b>참</b>' : ''}</span>`).join('')}</div>
            <div class="cal-legend muted xs">меньше <span class="c l0"></span><span class="c l1"></span><span class="c l2"></span> больше · <span class="c l3"><b>참</b></span> цель выполнена</div>
          </section>

        </div>
      </div>
    `;
  }

  // Первый запуск: с чего начать и где что лежит
  function welcome() {
    return `<section class="card welcome">
      <h3>С чего начать</h3>
      <ol class="sm">
        <li>Открой <a class="link" href="#/lesson/1">урок 1</a>. В уроке есть обзор, слова, фразы, грамматика и диалоги.</li>
        <li>Нажми «Тренировать урок». Новое слово сначала покажется карточкой, потом будут вопросы по нему.</li>
        <li>Занимайся каждый день. «Тренировка дня» повторяет то, что пора повторить, и добавляет новое из пройденных уроков.</li>
        <li>Когда урок освоен или контрольная сдана на 80%, здесь появится следующий урок.</li>
      </ol>
      <p class="sm">Уже знаешь основы? Открой нужный урок во вкладке <a class="link" href="#/lessons">«Уроки»</a> или сдай контрольную по уроку на 80%, чтобы перейти дальше.</p>
      <p class="muted sm">Во вкладке «Хангыль» таблица букв, в «Словаре» все слова с поиском.</p>
    </section>`;
  }

  function quickList(path, due) {
    const nMist = Practice.mistakes(DB.openNums()).length;
    const cur = DB.lesson(path.current), nxt = path.next != null ? DB.lesson(path.next) : null;
    const row = (href, ex, title, desc) => `<a class="mode" href="${href}"><span class="mode-ex serif">${ex}</span><span class="mode-t"><b>${title}</b><span>${desc}</span></span><span class="arr">→</span></a>`;
    const pct = cur ? Math.round(DB.mastery(DB.lessonKeys(cur.number)) * 100) : 0;
    const test = cur && Store.getTest(cur.number);
    return `<div class="modes">
      ${nxt ? row(`#/lesson/${nxt.number}`, `제${nxt.number}과`, 'Следующий урок', `${esc(nxt.title)} · урок ${cur.number} освоен`) : ''}
      ${path.fresh ? '' : row('#/practice/mix', '오늘', 'Тренировка дня', due ? `Сначала повторение: ${plural(due, 'слово', 'слова', 'слов')}` : 'Слова, грамматика и фразы из пройденных уроков')}
      ${nMist ? row('#/practice/mistakes', '오답', 'Мои ошибки', `${plural(nMist, 'задание', 'задания', 'заданий')}, в ${nMist % 10 === 1 && nMist % 100 !== 11 ? 'котором' : 'которых'} ты ошибался`) : ''}
      ${cur ? row(path.fresh ? `#/lesson/${cur.number}` : `#/practice/mix?l=${cur.number}`, `제${cur.number}과`, path.fresh ? 'Начать с урока 1' : 'Текущий урок', `${esc(cur.title)}${path.fresh ? '' : ` · освоено ${pct}%`}`) : ''}
      ${cur && !path.fresh ? row(`#/practice/test?l=${cur.number}`, '시험', 'Контрольная', `По уроку ${cur.number}${test ? ` · лучший результат ${test.best}%` : cur !== DB.lessons[DB.lessons.length - 1] ? ' · от 80% откроет следующий урок' : ''}`) : ''}
    </div>`;
  }

  function modeGrid(nums) {
    const q = String(nums) === String(DB.openNums()) ? '' : `?l=${nums.join(',')}`;
    return `<div class="modes">${Object.entries(Practice.MODES).filter(([, m]) => !m.hidden).map(([k, m]) => {
      const why = m.tts && !TTS.available() ? 'нужен корейский голос' : m.mic && !Practice.micSupported() ? 'браузер не распознаёт речь' : '';
      return `<a class="mode ${why ? 'off' : ''}" href="#/practice/${k}${q}" data-mode="${k}"><span class="mode-ex serif">${m.ex}</span><span class="mode-t"><b>${m.title}</b><span>${why || m.desc}</span></span><span class="arr">→</span></a>`;
    }).join('')}</div>`;
  }

  // ---------- Уроки ----------
  function lessons(root) {
    root.innerHTML = `<h1 class="page-title">Уроки</h1>
      <div class="lessons">${DB.lessons.map((l) => {
        const keys = DB.entries.filter((e) => e.lesson === l.number).map((e) => e.key);
        const m = Math.round(avgMastery(DB.lessonKeys(l.number)) * 100);
        return `<a class="lesson" href="#/lesson/${l.number}">
          <span class="kicker serif">제${l.number}과</span>
          <span class="l-body"><b>${esc(l.title)}</b><span class="muted sm">${esc(l.topics.map((t) => t.split(':')[0]).join(' · '))}</span>
            <span class="muted xs">${plural(keys.length, 'новое слово или фраза', 'новых слова и фразы', 'новых слов и фраз')}${Store.getTest(l.number) ? ` · контрольная ${Store.getTest(l.number).best}%` : ''}</span></span>
          <span class="l-prog"><span class="pbar"><i style="width:${m}%"></i></span><span class="xs muted">${m}%</span></span>
        </a>`;
      }).join('')}</div>`;
  }

  // ---------- Урок ----------
  function lesson(root, n) {
    const l = DB.lesson(n);
    if (!l) { root.innerHTML = '<section class="empty">Такого урока нет.<br><a class="btn" href="#/lessons">Все уроки</a></section>'; return; }
    const photos = DB.photos(l);
    const tabs = [
      ['overview', 'Обзор'], l.words.length && ['words', `Слова · ${l.words.length}`], l.phrases.length && ['phrases', `Фразы · ${l.phrases.length}`],
      l.grammar.length && ['grammar', 'Грамматика'], l.dialogues.length && ['dialogues', 'Диалоги'], photos.length && ['photos', `Конспект · ${photos.length}`],
    ].filter(Boolean);
    root.innerHTML = `
      <a class="back" href="#/lessons">${icon('back')} Все уроки</a>
      <section class="lesson-head">
        <div class="kicker serif lg">제${l.number}과</div>
        <h1>${esc(l.title)}</h1><p class="muted">${esc(l.source || '')}</p>
        <div class="row"><a class="btn" href="#/practice/mix?l=${l.number}">Тренировать урок</a><a class="btn ghost" href="#/practice/cards?l=${l.number}">Карточки</a><a class="btn ghost" href="#/practice/test?l=${l.number}">Контрольная${Store.getTest(l.number) ? ` · ${Store.getTest(l.number).best}%` : ''}</a></div>
      </section>
      <nav class="tabs">${tabs.map(([k, t], i) => `<button class="tab ${i ? '' : 'on'}" data-tab="${k}">${t}</button>`).join('')}</nav>
      <div class="tab-body"></div>`;
    const body = root.querySelector('.tab-body');
    const show = (k) => {
      root.querySelectorAll('.tab').forEach((b) => b.classList.toggle('on', b.dataset.tab === k));
      body.innerHTML = TAB[k](l, photos);
      if (k === 'photos') body.querySelectorAll('[data-photo]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); lightbox(photos, +a.dataset.photo); }));
      if (k === 'dialogues') body.querySelector('.hide-ru')?.addEventListener('change', (e) => body.classList.toggle('no-ru', e.target.checked));
    };
    root.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => { show(b.dataset.tab); b.scrollIntoView({ inline: 'center', block: 'nearest' }); }));
    // затемнение у края показывает, что вкладки можно листать
    const tabsEl = root.querySelector('.tabs');
    const edge = () => { tabsEl.classList.toggle('more-r', tabsEl.scrollLeft + tabsEl.clientWidth < tabsEl.scrollWidth - 4); tabsEl.classList.toggle('more-l', tabsEl.scrollLeft > 4); };
    tabsEl.addEventListener('scroll', edge, { passive: true }); edge();
    show('overview');
    // фото есть только в локальной версии: если их нет, вкладку не показываем
    if (photos.length) {
      const probe = new Image();
      probe.onerror = () => {
        const tab = root.querySelector('.tab[data-tab="photos"]');
        if (tab?.classList.contains('on')) show('overview');
        tab?.remove();
      };
      probe.src = photos[0];
    }
  }

  const wordRow = (w) => { const e = DB.byKo.get(w.ko) || w; return `<div class="wrow" data-ko="${esc(w.ko)}"><div class="w-ko"><span class="ko">${esc(w.ko)}</span>${UI.rr(w.ko)}</div><div class="w-ru">${esc(w.ru)}</div>${strength(e.key)}${sayBtn(w.ko, 'sm')}</div>`; };
  const TAB = {
    overview(l) {
      const units = l.hangul.map((u) => H.UNITS[u]);
      return `<div class="card"><h3>Что прошли</h3><ul class="topics">${l.topics.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
        ${l.notes?.length ? `<div class="card note"><h3>Запомнить</h3>${l.notes.map((n) => `<p>${esc(n)}</p>`).join('')}</div>` : ''}
        ${units.length ? `<div class="card"><h3>Хангыль в этом уроке</h3><div class="chips">${units.map((u) => `<span class="chip">${u.title}</span>`).join('')}</div><a class="link" href="#/hangul">Открыть таблицу хангыля →</a></div>` : ''}
        <h2 class="h">Как тренировать</h2>${modeGrid([l.number])}`;
    },
    words: (l) => `<div class="card list">${l.words.map(wordRow).join('')}</div>`,
    phrases: (l) => {
      const groups = {}; l.phrases.forEach((p) => (groups[p.c || 'Фразы'] = groups[p.c || 'Фразы'] || []).push(p));
      return Object.entries(groups).map(([g, ps]) => `<div class="card list"><h3>${esc(g)}</h3>${ps.map(wordRow).join('')}</div>`).join('');
    },
    grammar: (l) => l.grammar.map((g) => `<div class="card grammar"><div class="g-head"><h3 class="serif">${esc(g.title)}</h3><span class="muted">${esc(g.short || '')}</span></div>
      ${g.body.map((p) => `<p>${p}</p>`).join('')}
      <div class="examples">${g.examples.map((x) => `<div class="exm"><div><span class="ko">${esc(x.ko)}</span><div class="muted sm">${esc(x.ru)}</div></div>${sayBtn(x.ko, 'sm')}</div>`).join('')}</div></div>`).join('')
      + `<a class="btn" href="#/practice/grammar?l=${l.number}">Тренировать грамматику</a>`,
    dialogues: (l) => `<label class="toggle"><input type="checkbox" class="hide-ru"> Скрыть перевод</label>` + l.dialogues.map((d) => `<div class="card dialog"><h3>${esc(d.title)}</h3>
      ${d.lines.map((x) => `<div class="line">${x.who ? `<span class="who ko">${esc(x.who)}</span>` : '<span class="who"></span>'}<div class="bubble"><span class="ko">${esc(x.ko)}</span><div class="ru">${esc(x.ru)}</div></div>${sayBtn(x.ko, 'sm')}</div>`).join('')}
      <button class="link" data-say="${esc(d.lines.map((x) => x.ko).join(' '))}">${icon('speaker')} Прослушать весь диалог</button></div>`).join('')
      + `<a class="btn" href="#/practice/build?l=${l.number}">Собирать фразы</a>`,
    photos: (l, photos) => `<div class="gallery">${photos.map((p, i) => `<a href="${p}" data-photo="${i}"><img src="${p}" loading="lazy" alt="Страница ${i + 1}"></a>`).join('')}</div>`,
  };

  function lightbox(photos, i) {
    const box = document.createElement('div'); box.className = 'lightbox';
    const draw = () => { box.innerHTML = `<img src="${photos[i]}" alt=""><button class="lb-prev" aria-label="Назад">‹</button><button class="lb-next" aria-label="Вперёд">›</button><button class="lb-close" aria-label="Закрыть">${icon('close')}</button><span class="lb-n">${i + 1} / ${photos.length}</span>`; };
    const go = (d) => { i = (i + d + photos.length) % photos.length; draw(); };
    const close = () => { box.remove(); document.removeEventListener('keydown', key); };
    const key = (e) => { if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); };
    box.addEventListener('click', (e) => {
      if (e.target.closest('.lb-prev')) go(-1); else if (e.target.closest('.lb-next')) go(1); else if (e.target.closest('.lb-close') || e.target === box) close();
    });
    let x0 = null;
    box.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
    box.addEventListener('touchend', (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); x0 = null; });
    document.addEventListener('keydown', key);
    draw(); document.body.appendChild(box);
  }

  // Карточка слова: нажатие на строку в словаре или в уроке
  function wordSheet(e) {
    const s = Store.get(e.key);
    const lines = [
      ...DB.dialogues(allNums()).flatMap((d) => d.lines), ...DB.grammar(allNums()).flatMap((g) => g.examples),
      ...DB.entries.filter((x) => x.kind === 'phrase'),
    ].filter((l) => l.ko !== e.ko && l.ko.split(/\s+/).some((t) => t.replace(/[.,!?]/g, '').startsWith(e.ko)));
    const ex = UI.uniqBy(lines, (l) => l.ko).slice(0, 5);
    document.querySelectorAll('.sheet-wrap').forEach((x) => x.remove());
    const box = document.createElement('div'); box.className = 'sheet-wrap';
    box.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(e.ko)}">
      <button class="icon-btn sheet-x" aria-label="Закрыть">${icon('close')}</button>
      <div class="sheet-head">${UI.cells(e.ko, 'big')}${sayBtn(e.ko)}</div>
      ${Store.settings().romanize ? `<div class="rr sheet-rr">${esc(H.romanize(e.ko))}</div>` : ''}
      <div class="sheet-ru">${esc(e.ru)}</div>
      <div class="muted sm">${esc(e.c)} · ${e.lessons.map((n) => (n === 0 ? 'мои слова' : `<a class="link" href="#/lesson/${n}">제${n}과</a>`)).join(', ')}</div>
      <div class="sheet-stats">${s ? `${strength(e.key)} <span class="sm">верно ${s.right}, ошибок ${s.wrong}</span>` : '<span class="sm muted">Ещё не тренировалось</span>'}</div>
      ${e.mine ? '<button class="btn sm danger del-word" type="button">Удалить из моих слов</button>' : ''}
      ${ex.length ? `<h2 class="h">Встречается во фразах</h2>${ex.map((l) => `<div class="exm"><div><span class="ko">${esc(l.ko)}</span><div class="muted sm">${esc(l.ru)}</div></div>${sayBtn(l.ko, 'sm')}</div>`).join('')}` : ''}
    </div>`;
    const close = () => { box.remove(); document.removeEventListener('keydown', key); };
    const key = (ev) => { if (ev.key === 'Escape') close(); };
    box.querySelector('.del-word')?.addEventListener('click', () => {
      if (!confirm(`Удалить «${e.ko}» из своих слов?`)) return;
      DB.removeCustom(e.ko); close(); UI.toast('Удалено'); if (location.hash.startsWith('#/dict')) dict(document.getElementById('view'));
    });
    box.addEventListener('click', (ev) => { if (ev.target === box || ev.target.closest('.sheet-x') || ev.target.closest('a')) close(); });
    document.addEventListener('keydown', key);
    document.body.appendChild(box);
  }
  document.addEventListener('click', (ev) => {
    const r = ev.target.closest('.wrow[data-ko]');
    if (!r || ev.target.closest('.say') || document.body.classList.contains('in-session')) return;
    const e = DB.byKo.get(r.dataset.ko); if (e) wordSheet(e);
  });

  // Правило грамматики по кнопке «Правило →» из разбора ответа
  function ruleSheet(id) {
    const g = DB.grammar(DB.allNums()).find((x) => x.id === id); if (!g) return;
    document.querySelectorAll('.sheet-wrap').forEach((x) => x.remove());
    const box = document.createElement('div'); box.className = 'sheet-wrap';
    box.innerHTML = `<div class="sheet grammar" role="dialog"><button class="icon-btn sheet-x" aria-label="Закрыть">${icon('close')}</button>
      <div class="g-head"><h3 class="serif">${esc(g.title)}</h3><span class="muted">${esc(g.short || '')}</span></div>
      ${g.body.map((p) => `<p>${p}</p>`).join('')}
      <div class="examples">${g.examples.map((x) => `<div class="exm"><div><span class="ko">${esc(x.ko)}</span><div class="muted sm">${esc(x.ru)}</div></div>${sayBtn(x.ko, 'sm')}</div>`).join('')}</div></div>`;
    const close = () => { box.remove(); document.removeEventListener('keydown', key, true); };
    const key = (ev) => { if (ev.key === 'Escape') { ev.stopPropagation(); close(); } };
    box.addEventListener('click', (ev) => { if (ev.target === box || ev.target.closest('.sheet-x')) close(); });
    document.addEventListener('keydown', key, true);
    document.body.appendChild(box);
  }
  document.addEventListener('click', (ev) => { const b = ev.target.closest('[data-rule]'); if (b) { ev.preventDefault(); ruleSheet(b.dataset.rule); } });

  // ---------- Словарь ----------
  const dictState = { q: '', lesson: 'all', cat: 'all', sort: 'lesson' };
  function dict(root) {
    root.innerHTML = `<h1 class="page-title">Словарь <span class="muted count"></span></h1>
      <div class="filters">
        <input class="search" type="search" placeholder="Поиск: 학생, студент, haksaeng…" value="${esc(dictState.q)}">
        <select class="f-lesson"><option value="all">Все уроки</option>${DB.lessons.map((l) => `<option value="${l.number}">제${l.number}과</option>`).join('')}<option value="0">Мои слова</option></select>
        <select class="f-cat"><option value="all">Все темы</option>${DB.categories().map((c) => `<option>${esc(c)}</option>`).join('')}</select>
        <select class="f-sort"><option value="lesson">По урокам</option><option value="abc">По алфавиту</option><option value="weak">Сначала слабые</option></select>
      </div>
      <div class="row dict-actions"><a class="btn sm ghost" id="dict-cards" href="#/practice/cards">Карточки по этой выборке</a><button class="btn sm ghost add-word" type="button">+ Своё слово</button></div>
      <form class="card form add-form" hidden>
        <h3>Новое слово</h3>
        <label class="field"><span>По-корейски</span><input class="aw-ko" lang="ko" maxlength="60" required autocomplete="off" placeholder="한글로…"></label>
        <label class="field"><span>Перевод</span><input class="aw-ru" maxlength="120" required autocomplete="off" placeholder="по-русски"></label>
        <label class="field"><span>Тема</span><select class="aw-c">${['Мои слова', ...DB.categories().filter((c) => c !== 'Мои слова')].map((c) => `<option>${esc(c)}</option>`).join('')}</select></label>
        <div class="row"><button class="btn sm">Добавить</button><button class="btn sm ghost aw-cancel" type="button">Отмена</button></div>
      </form>
      <div class="card list dict-list"></div>`;
    const $ = (s) => root.querySelector(s);
    $('.f-lesson').value = dictState.lesson; $('.f-cat').value = dictState.cat; $('.f-sort').value = dictState.sort;
    const draw = () => {
      const q = dictState.q.trim().toLowerCase();
      const filter = { c: dictState.cat === 'all' ? '' : dictState.cat, q };
      let list = DB.entries.filter((e) => (dictState.lesson === 'all' || e.lessons.includes(+dictState.lesson)) && DB.matches(e, filter));
      if (dictState.sort === 'abc') list = list.slice().sort((a, b) => a.ko.localeCompare(b.ko, 'ko'));
      if (dictState.sort === 'weak') list = list.slice().sort((a, b) => Store.box(a.key) - Store.box(b.key));
      $('.count').textContent = list.length;
      // карточки ровно по тому, что сейчас видно в словаре: урок + тема + поиск
      const p = new URLSearchParams();
      if (dictState.lesson !== 'all') p.set('l', dictState.lesson);
      if (filter.c) p.set('c', filter.c);
      if (q) p.set('q', q);
      $('#dict-cards').href = `#/practice/cards${p.toString() ? '?' + p : ''}`;
      $('#dict-cards').textContent = `Карточки по этой выборке · ${list.length > 30 ? `30 из ${list.length}` : list.length}`;
      const row = (e) => `<div class="wrow" data-ko="${esc(e.ko)}"><div class="w-ko"><span class="ko serif">${esc(e.ko)}</span>${UI.rr(e.ko)}</div>
        <div class="w-ru">${esc(e.ru)}<div class="w-meta">${esc(e.c)} · ${e.lessons.map((n) => (n === 0 ? 'мои' : `제${n}과`)).join(', ')}</div></div>${strength(e.key)}${sayBtn(e.ko, 'sm')}</div>`;
      const groupOf = dictState.sort === 'abc' ? (e) => { const d = H.decompose(e.ko[0]); return d ? d.cho : e.ko[0]; }
        : dictState.sort === 'lesson' ? (e) => lessonName(e.lesson) : null;
      if (dictState.sort === 'lesson') list = list.slice().sort((a, b) => a.lesson - b.lesson);
      let html = '', prev = null;
      for (const e of list) { const g = groupOf && groupOf(e); if (g && g !== prev) { html += `<div class="dgroup serif">${esc(g)}</div>`; prev = g; } html += row(e); }
      $('.dict-list').innerHTML = list.length ? html
        : '<p class="muted center">Ничего не нашлось</p>';
    };
    $('.search').addEventListener('input', (e) => { dictState.q = e.target.value; draw(); });
    $('.f-lesson').addEventListener('change', (e) => { dictState.lesson = e.target.value; draw(); });
    $('.f-cat').addEventListener('change', (e) => { dictState.cat = e.target.value; draw(); });
    $('.f-sort').addEventListener('change', (e) => { dictState.sort = e.target.value; draw(); });
    const form = $('.add-form');
    $('.add-word').addEventListener('click', () => { form.hidden = !form.hidden; if (!form.hidden) $('.aw-ko').focus(); });
    $('.aw-cancel').addEventListener('click', () => { form.hidden = true; });
    Keyboard.attach(form, $('.aw-ko'), () => {}, false);
    form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const ko = $('.aw-ko').value.trim(), ru = $('.aw-ru').value.trim();
      if (!ko || !ru) return;
      if (!/[가-힣]/.test(ko)) { UI.toast('Слово должно быть по-корейски (можно печатать gkrtod → 학생)'); return; }
      DB.addCustom({ ko, ru, c: $('.aw-c').value });
      UI.toast(`Добавлено: ${ko}`); $('.aw-ko').value = ''; $('.aw-ru').value = ''; $('.aw-ko').focus(); draw();
    });
    draw();
  }

  // ---------- Хангыль ----------
  function hangul(root) {
    const U = H.UNITS;
    const table = (key) => {
      const u = U[key];
      return `<div class="card"><h3>${u.title}</h3><div class="jamo-grid">${u.items.map(([j, r, ru]) => {
        const ex = u.kind === 'vowel' ? H.compose('ㅇ', j) : H.compose(j, 'ㅏ');
        return `<button class="jamo" data-say="${H.NAMES[j] || ex}"><b>${j}</b><span class="ko ex">${H.NAMES[j] || ex}</span><span class="rr">${r}</span><span class="xs muted">${ru}</span>${strength('j:' + j)}</button>`;
      }).join('')}</div></div>`;
    };
    root.innerHTML = `<h1 class="page-title">Хангыль</h1>
      <p class="muted">Нажми на букву, чтобы услышать её (у согласных под буквой написано название).</p>
      <div class="card builder">
        <h3>Конструктор слога</h3>
        <div class="b-out"><div class="b-syll serif cell-guide">가</div><div><span class="rr b-rr">ga</span><div class="b-parts muted"></div></div><button class="say b-say" data-say="가">${icon('speaker')}</button></div>
        <div class="b-row"><span class="b-lbl">Согласная</span><div class="b-chips" data-part="cho">${H.CHO.map((c, i) => `<button class="${i ? '' : 'on'}" data-v="${c}">${c}</button>`).join('')}</div></div>
        <div class="b-row"><span class="b-lbl">Гласная</span><div class="b-chips" data-part="jung">${H.JUNG.map((c, i) => `<button class="${i ? '' : 'on'}" data-v="${c}">${c}</button>`).join('')}</div></div>
        <div class="b-row"><span class="b-lbl">Патчим</span><div class="b-chips" data-part="jong">${['', 'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ', 'ㄲ', 'ㅆ'].map((c, i) => `<button class="${i ? '' : 'on'}" data-v="${c}">${c || '—'}</button>`).join('')}</div></div>
      </div>
      <div class="two-col">${table('vowels1')}${table('consonants1')}</div>
      <div class="two-col">${table('vowels2')}${table('consonants2')}</div>
      <div class="card"><h3>Патчим: 7 звуков</h3><p class="muted sm">Сколько бы ни было букв, на конце слога звучит только один из семи звуков.</p>
        <div class="batchim">${U.batchim.groups.map((g) => `<div class="bg"><div class="bg-sound ko">[${g.sound}]<span class="rr">${g.rr}</span></div><div class="bg-letters ko">${g.letters}</div><div class="bg-words">${g.words.map((w) => `<button class="tok ko" data-say="${w}">${w}</button>`).join('')}</div></div>`).join('')}</div></div>
      <a class="btn" href="#/practice/hangul">Тренировать хангыль</a>`;
    const sel = { cho: 'ㄱ', jung: 'ㅏ', jong: '' };
    const upd = () => {
      const s = H.compose(sel.cho, sel.jung, sel.jong);
      root.querySelector('.b-syll').textContent = s;
      root.querySelector('.b-rr').textContent = H.romanize(s);
      root.querySelector('.b-parts').textContent = [sel.cho, sel.jung, sel.jong].filter(Boolean).join(' + ');
      root.querySelector('.b-say').dataset.say = s;
    };
    root.querySelectorAll('.b-chips').forEach((row) => row.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      row.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      sel[row.dataset.part] = b.dataset.v; upd(); TTS.speak(H.compose(sel.cho, sel.jung, sel.jong));
    }));
    upd();
  }

  function mistakesBlock(nums) {
    const list = Practice.mistakes(nums);
    const label = (it) => it.entry ? `<span class="ko">${esc(it.entry.ko)}</span> — ${esc(it.entry.ru)}`
      : it.sys ? `числа: ${esc(Numbers.SYSTEMS[it.sys].title)}, ${it.n <= 10 ? 'до 10' : it.n < 100 ? 'до 100' : 'от 100'}`
      : it.target ? `пропись <span class="ko">${esc(it.target)}</span>`
      : it.jamo ? `буква <span class="ko">${esc(it.jamo)}</span>` : it.line ? `<span class="ko">${esc(it.line.ko)}</span>`
      : it.p ? `<span class="ko">${esc(it.p.ko)} … ${esc(it.jb.ko)}</span>` : it.dlg ? `<span class="ko">${esc(it.dlg.lines[it.i].ko)}</span>` : esc(it.key);
    const q = String(nums) === String(DB.openNums()) ? '' : `?l=${nums.join(',')}`;
    return `<section class="block mistakes"><h2 class="h">Мои ошибки</h2>
      ${list.length ? `<div class="mist-list">${list.slice(0, 8).map((it) => `<div class="mist-row"><span>${label(it)}</span><span class="muted xs">ошибок: ${it.s.wrong}</span></div>`).join('')}</div>
        <div class="row"><a class="btn" href="#/practice/mistakes${q}">Тренировать ошибки · ${list.length}</a></div>`
        : '<p class="muted sm">Пока ошибок нет. Здесь появится то, в чём ты ошибаешься чаще всего.</p>'}</section>`;
  }

  // ---------- Меню тренировки ----------
  let practiceNums = null, practiceBase = '';
  function practiceMenu(root) {
    // выбор сбрасывается, когда открылся новый урок; удалённых своих слов в нём не остаётся
    if (!practiceNums || practiceBase !== String(DB.openNums())) { practiceNums = DB.openNums(); practiceBase = String(practiceNums); }
    practiceNums = practiceNums.filter((n) => allNums().includes(n));
    const draw = () => {
      root.innerHTML = `<h1 class="page-title">Тренировка</h1>
        <div class="card"><div class="card-head"><h3>Какие уроки</h3><button class="link all">${practiceNums.length === allNums().length ? 'Снять все' : 'Выбрать все'}</button></div>
          <div class="chips pick">${DB.lessons.map((l) => `<button class="chip ${practiceNums.includes(l.number) ? 'on' : ''}" data-n="${l.number}">제${l.number}과 · ${esc(l.title)}</button>`).join('')}${Store.custom().length ? `<button class="chip ${practiceNums.includes(0) ? 'on' : ''}" data-n="0">Мои слова · ${Store.custom().length}</button>` : ''}</div></div>
        ${!TTS.available() ? `<div class="card warn">Корейский голос не найден, поэтому аудирование выключено. <a class="link" href="#/settings">Как включить →</a></div>` : ''}
        ${practiceNums.length ? modeGrid(practiceNums) : '<p class="muted center">Выбери хотя бы один урок</p>'}
        ${practiceNums.length ? mistakesBlock(practiceNums) : ''}`;
      root.querySelectorAll('.pick .chip').forEach((b) => b.addEventListener('click', () => {
        const n = +b.dataset.n; practiceNums = practiceNums.includes(n) ? practiceNums.filter((x) => x !== n) : [...practiceNums, n].sort((a, b) => a - b); draw();
      }));
      root.querySelector('.all').addEventListener('click', () => { practiceNums = practiceNums.length === allNums().length ? [] : allNums(); draw(); });
    };
    draw();
  }

  // ---------- Настройки ----------
  function settings(root) {
    const s = Store.settings();
    const voice = TTS.available() ? `Голос: <b>${esc(TTS.voiceName())}</b>` : TTS.supported() ? 'Корейский голос <b>не найден</b>.' : 'Браузер не поддерживает озвучку.';
    root.innerHTML = `<h1 class="page-title">Настройки</h1>
      <div class="card form">
        <h3>Внешний вид</h3>
        <label class="field"><span>Тема</span><select data-k="theme"><option value="auto">Как в системе</option><option value="light">Светлая</option><option value="dark">Тёмная</option></select></label>
        <label class="field"><span>Показывать латиницу (романизацию)</span><input type="checkbox" data-k="romanize" ${s.romanize ? 'checked' : ''}></label>
      </div>
      <div class="card form">
        <h3>Озвучка</h3>
        <p class="sm">${voice} <button class="link" data-say="안녕하세요? 저는 학생이에요.">Проверить</button></p>
        ${TTS.available() ? '' : `<details><summary>Как добавить корейский голос</summary><ul class="sm">
          <li><b>Windows:</b> Параметры → Время и язык → Речь → «Добавить голоса» → Корейский. Потом перезапусти браузер.</li>
          <li><b>Android:</b> Chrome обычно уже умеет; если нет — Настройки → Синтез речи → Google → установить корейский.</li>
          <li><b>iPhone:</b> Настройки → Универсальный доступ → Устный контент → Голоса → Корейский.</li></ul></details>`}
        <label class="field"><span>Скорость речи: <b class="rate-v">${s.rate}</b></span><input type="range" min="0.5" max="1.2" step="0.05" value="${s.rate}" data-k="rate"></label>
      </div>
      <div class="card form">
        <h3>Тренировка</h3>
        <label class="field"><span>Цель: ответов в день</span><input type="number" min="5" max="300" step="5" value="${s.dailyGoal}" data-k="dailyGoal"></label>
        <label class="field"><span>Задания с набором текста</span><input type="checkbox" data-k="typing" ${s.typing ? 'checked' : ''}></label>
        <label class="field"><span>Экранная корейская клавиатура (выключи, если есть своя корейская раскладка)</span><input type="checkbox" data-k="keyboard" ${s.keyboard ? 'checked' : ''}></label>
      </div>
      <div class="card form">
        <h3>Прогресс</h3>
        <p class="sm muted">Прогресс хранится в этом браузере. Чтобы перенести его на другое устройство, сохрани файл и загрузи его там.</p>
        <div class="row"><button class="btn sm exp">Сохранить в файл</button><label class="btn sm ghost">Загрузить из файла<input type="file" accept=".json" class="imp" hidden></label><button class="btn sm danger rst">Сбросить</button></div>
      </div>
      <div class="card form">
        <h3>Перенос на другое устройство</h3>
        <p class="sm muted">Создай ссылку и открой её на другом устройстве: прогресс объединится с тем, что там уже есть. Ссылку никому не отправляй.</p>
        <div class="row"><button class="btn sm mk-link">Создать ссылку</button></div>
        <textarea class="xfer" readonly hidden></textarea>
      </div>
      <div class="card"><h3>Как поставить на телефон</h3><p class="sm">Открой сайт на телефоне. В Chrome: меню ⋮ → «Добавить на главный экран». В Safari: «Поделиться» → «На экран „Домой“». Приложение откроется без браузерной рамки и будет работать без интернета.</p></div>`;
    root.querySelector('[data-k="theme"]').value = s.theme;
    root.querySelectorAll('[data-k]').forEach((el) => el.addEventListener('change', () => {
      const k = el.dataset.k; const v = el.type === 'checkbox' ? el.checked : el.type === 'range' || el.type === 'number' ? +el.value : el.value;
      Store.setSetting(k, v); if (k === 'theme') applyTheme();
    }));
    root.querySelector('[data-k="rate"]').addEventListener('input', (e) => (root.querySelector('.rate-v').textContent = e.target.value));
    root.querySelector('.exp').addEventListener('click', () => {
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([Store.exportJSON()], { type: 'application/json' }));
      a.download = `korean-progress-${new Date().toLocaleDateString('sv-SE')}.json`; a.click();
    });
    root.querySelector('.imp').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { Store.importJSON(await f.text()); location.hash = '#/'; location.reload(); } catch (err) { UI.toast('Ошибка: ' + err.message); }
    });
    root.querySelector('.mk-link').addEventListener('click', async () => {
      const url = `${location.origin}${location.pathname}#/import/${await Store.pack()}`;
      const ta = root.querySelector('.xfer'); ta.hidden = false; ta.value = url; ta.select();
      if (navigator.share && matchMedia('(pointer: coarse)').matches) { navigator.share({ title: 'Мой корейский: прогресс', url }).catch(() => {}); return; }
      try { await navigator.clipboard.writeText(url); UI.toast('Ссылка скопирована'); } catch { UI.toast('Скопируй ссылку из поля'); }
    });
    root.querySelector('.rst').addEventListener('click', () => { if (confirm('Удалить весь прогресс и свои слова на этом устройстве?')) { Store.reset(); location.hash = '#/'; location.reload(); } });
  }

  async function importLink(root, data) {
    let other;
    try { other = await Store.unpack(data); } catch { other = null; }
    if (!other || typeof other !== 'object' || !other.items || typeof other.items !== 'object') { root.innerHTML = '<p class="empty">Ссылка повреждена — создай новую.</p>'; return; }
    const n = Object.keys(other.items || {}).length, d = Object.keys(other.days || {}).length;
    root.innerHTML = `<section class="card form"><h3>Перенос прогресса</h3>
      <p>В ссылке: ${plural(n, 'задание', 'задания', 'заданий')} и ${plural(d, 'день', 'дня', 'дней')} занятий. Прогресс из ссылки объединится с прогрессом на этом устройстве — более свежие ответы победят.</p>
      <div class="row"><button class="btn ok-imp">Перенести</button><a class="btn ghost" href="#/">Отмена</a></div></section>`;
    root.querySelector('.ok-imp').addEventListener('click', () => {
      try { Store.merge(other); } catch (err) { UI.toast('Ошибка: ' + err.message); return; }
      // перезагрузка, чтобы словарь подхватил перенесённые свои слова
      location.hash = '#/'; location.reload();
    });
  }

  function applyTheme() {
    const t = Store.settings().theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t;
  }

  window.Views = { home, lessons, lesson, dict, hangul, practiceMenu, settings, importLink, applyTheme };
})();
