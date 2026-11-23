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
            <span class="muted sm">${due ? `${plural(due, 'слово ждёт', 'слова ждут', 'слов ждут')} повторения` : 'Повторять пока нечего — можно учить новое'}${tomorrow ? ` · завтра ещё ${tomorrow}` : ''}${Store.newToday() >= Store.settings().newPerDay ? ' · новые слова на сегодня все' : ''}</span>
          </div>
        </div>
        ${st.n >= goal ? UI.stamp('참 잘했어요') : ''}
      </section>
      ${path.fresh ? welcome() : backupCard()}

      <section class="stats">
        <div><b>${DB.entries.length}</b><span>слов и фраз</span></div>
        <div><b>${learned(keys)}</b><span>хорошо знаю</span></div>
        <div><b>${due}</b><span>к повторению</span></div>
        <div><b>${st.n ? Math.round((st.ok / st.n) * 100) + '%' : '—'}</b><span>точность сегодня</span></div>
      </section>
      <a class="link more-stats" href="#/progress">Подробнее о прогрессе →</a>

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
    const bk = root.querySelector('.backup');
    if (bk) {
      bk.querySelector('.hide-backup').addEventListener('click', () => { Store.setMeta('backupHide', Date.now() + 30 * DAY); bk.remove(); });
      // браузер пообещал не стирать данные — напоминание не нужно
      navigator.storage?.persisted?.().then((p) => { if (p) bk.remove(); }).catch(() => {});
    }
  }

  // Напоминание сохранить прогресс: он живёт только в этом браузере, а Safari стирает данные сайта,
  // который долго не открывали. Не показываем в установленном приложении и месяц после сохранения.
  const DAY = 86400000;
  const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  function backupCard() {
    const now = Date.now();
    if (standalone() || Store.keys().length < 30 || (Store.meta('backupAt') || 0) > now - 30 * DAY || (Store.meta('backupHide') || 0) > now) return '';
    return `<section class="card note backup">
      <h3>Сохрани прогресс</h3>
      <p class="sm">Прогресс хранится только в этом браузере и может пропасть, если долго не открывать сайт или очистить данные браузера. Поставь приложение на главный экран телефона или сохрани прогресс файлом или ссылкой.</p>
      <div class="row"><a class="btn sm" href="#/settings">Сохранить</a><button class="btn sm ghost hide-backup" type="button">Напомнить через месяц</button></div>
    </section>`;
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
      ${path.fresh ? '' : readRow(row)}
      ${nMist ? row('#/practice/mistakes', '오답', 'Мои ошибки', `${plural(nMist, 'задание', 'задания', 'заданий')}, в ${nMist % 10 === 1 && nMist % 100 !== 11 ? 'котором' : 'которых'} ты ошибался`) : ''}
      ${cur ? row(path.fresh ? `#/lesson/${cur.number}` : `#/practice/mix?l=${cur.number}`, `제${cur.number}과`, path.fresh ? 'Начать с урока 1' : 'Текущий урок', `${esc(cur.title)}${path.fresh ? '' : ` · освоено ${pct}%`}`) : ''}
      ${cur && !path.fresh ? row(`#/practice/test?l=${cur.number}`, '시험', 'Контрольная', `По уроку ${cur.number}${test ? ` · лучший результат ${test.best}%` : cur !== DB.lessons[DB.lessons.length - 1] ? ' · от 80% откроет следующий урок' : ''}`) : ''}
    </div>`;
  }

  // «Чтение» на главной и в тренировке: сколько текстов ждут, последняя скорость
  function readRow(row) {
    const texts = DB.texts(DB.openNums().filter((n) => n > 0)); if (!texts.length) return '';
    const now = Date.now(), fresh = texts.filter((t) => !Store.reads(t.id).length).length, due = texts.filter((t) => Store.isDue('txt:' + t.id, now)).length;
    const last = Store.reads().slice(-1)[0];
    const desc = [fresh ? `новых текстов: ${fresh}` : '', due ? `перечитать: ${due}` : '', last ? `скорость ${last.spm} слог/мин` : ''].filter(Boolean).join(' · ') || 'Тексты из пройденных слов';
    return row('#/read', '읽기', 'Чтение', desc);
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
          <span class="l-body"><b>${esc(l.title)}</b><span class="muted sm">${esc([...new Set(l.topics.map((t) => t.split(':')[0]))].join(' · '))}</span>
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
      l.grammar.length && ['grammar', 'Грамматика'], l.dialogues.length && ['dialogues', 'Диалоги'], DB.texts([l.number]).length && ['texts', `Чтение · ${DB.texts([l.number]).length}`], photos.length && ['photos', `Конспект · ${photos.length}`],
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
      TTS.stop(); body.classList.remove('no-ru'); // озвучка и «Скрыть перевод» относятся к прежней вкладке
      body.innerHTML = TAB[k](l, photos);
      if (k === 'photos') body.querySelectorAll('[data-photo]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); lightbox(photos, +a.dataset.photo); }));
      if (k === 'dialogues') {
        body.querySelector('.hide-ru')?.addEventListener('change', (e) => body.classList.toggle('no-ru', e.target.checked));
        body.querySelectorAll('.play-dialog').forEach((b) => b.addEventListener('click', () => playDialog(b, l.dialogues[+b.dataset.d])));
      }
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

  const wordRow = (w) => { const e = DB.byKo.get(w.ko) || w; return `<div class="wrow" data-ko="${esc(w.ko)}" tabindex="0"><div class="w-ko"><span class="ko">${esc(w.ko)}</span>${UI.rr(w.ko)}</div><div class="w-ru">${esc(w.ru)}</div><span class="wpic">${UI.pic(w.ko)}</span>${strength(e.key)}${sayBtn(w.ko, 'sm')}</div>`; };
  const TAB = {
    overview(l) {
      const units = l.hangul.map((u) => H.UNITS[u]);
      return `<div class="card"><h3>Что прошли</h3><ul class="topics">${l.topics.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
        ${l.notes?.length ? `<div class="card note"><h3>Запомнить</h3>${l.notes.map((n) => `<p>${esc(n)}</p>`).join('')}</div>` : ''}
        ${l.number === Practice.introLesson() ? `<div class="card"><h3>Расскажи о себе</h3><p class="sm">Впиши своё имя, страну и профессию — получится твой 자기소개, его можно собирать из плашек и повторять вслух.</p><a class="link" href="#/intro">Составить рассказ о себе →</a></div>` : ''}
        ${units.length ? `<div class="card"><h3>Хангыль в этом уроке</h3><div class="chips">${units.map((u) => `<span class="chip">${u.title}</span>`).join('')}</div><a class="link" href="#/hangul">Открыть таблицу хангыля →</a></div>` : ''}
        <h2 class="h">Как тренировать</h2>${modeGrid([l.number])}
        <p class="muted xs report">Нашёл ошибку в уроке? <button type="button" class="link" data-report="${l.number}">Напиши об этом</button>.</p>`;
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
      <button type="button" class="link play-dialog" data-d="${l.dialogues.indexOf(d)}">${icon('speaker')} <span>Прослушать по репликам</span></button></div>`).join('')
      + `<a class="btn" href="#/practice/build?l=${l.number}">Собирать фразы</a>`,
    texts: (l) => `<div class="modes">${DB.texts([l.number]).map((t) => { const r = Store.reads(t.id).slice(-1)[0];
      return `<a class="mode" href="#/read/${esc(t.id)}"><span class="mode-ex serif">읽기</span><span class="mode-t"><b>${esc(t.title)}</b><span>${r ? `${r.spm} слог/мин${r.acc >= 0 ? ` · ${r.acc}%` : ''}` : t.words ? 'Слова урока строками — на скорость' : 'Текст из пройденных слов'}</span></span><span class="arr">→</span></a>`; }).join('')}</div>`,
    photos: (l, photos) => `<div class="gallery">${photos.map((p, i) => `<a href="${p}" data-photo="${i}"><img src="${p}" loading="lazy" alt="Страница ${i + 1}"></a>`).join('')}</div>`,
  };

  // Диалог вслух по репликам: звучащая подсвечивается, повторное нажатие останавливает
  function playDialog(btn, d) {
    const card = btn.closest('.dialog'), lines = [...card.querySelectorAll('.line')], label = btn.querySelector('span');
    const mark = (i) => lines.forEach((x, k) => x.classList.toggle('speaking', k === i));
    if (btn.classList.contains('on')) { TTS.stop(); return; }
    // другой диалог, который ещё звучит, остановится сам: TTS.speakAll прерывает прежнюю очередь
    const ok = TTS.speakAll(d.lines.map((x) => x.ko), (i) => {
      mark(i);
      if (i < 0) { btn.classList.remove('on'); label.textContent = 'Прослушать по репликам'; }
      else lines[i].scrollIntoView({ block: 'nearest', behavior: UI.smooth() });
    });
    if (!ok) { UI.say(''); return; }
    btn.classList.add('on'); label.textContent = 'Остановить';
  }

  function lightbox(photos, i) {
    const box = document.createElement('div'); box.className = 'lightbox'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Фото страниц урока');
    box.innerHTML = `<img alt=""><button class="lb-prev" aria-label="Назад">‹</button><button class="lb-next" aria-label="Вперёд">›</button><button class="lb-close" aria-label="Закрыть">${icon('close')}</button><span class="lb-n"></span>`;
    // кнопки не перерисовываем, чтобы фокус оставался на них
    const draw = () => { box.querySelector('img').src = photos[i]; box.querySelector('.lb-n').textContent = `${i + 1} / ${photos.length}`; };
    const go = (d) => { i = (i + d + photos.length) % photos.length; draw(); };
    draw();
    const m = UI.modal(box, { onKey: (e) => { if (e.key === 'ArrowLeft') go(-1); if (e.key === 'ArrowRight') go(1); } });
    box.addEventListener('click', (e) => {
      if (e.target.closest('.lb-prev')) go(-1); else if (e.target.closest('.lb-next')) go(1); else if (e.target.closest('.lb-close') || e.target === box) m.close();
    });
    let x0 = null;
    box.addEventListener('touchstart', (e) => (x0 = e.touches[0].clientX), { passive: true });
    box.addEventListener('touchend', (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); x0 = null; });
  }

  // Карточка слова: нажатие на строку в словаре или в уроке
  function wordSheet(e) {
    const s = Store.get(e.key);
    // 이 «два» не должно находить фразы, где на этом месте 이 사람 «этот человек»
    const longer = DB.entries.filter((x) => x.ko.startsWith(e.ko + ' '));
    const lines = [
      ...DB.dialogues(allNums()).flatMap((d) => d.lines), ...DB.grammar(allNums()).flatMap((g) => g.examples),
      ...DB.entries.filter((x) => x.kind === 'phrase'),
    ].filter((l) => l.ko !== e.ko && DB.inSentence(e.ko, l.ko) && !longer.some((x) => DB.inSentence(x.ko, l.ko)));
    const ex = UI.uniqBy(lines, (l) => l.ko).slice(0, 5);
    const box = document.createElement('div'); box.className = 'sheet-wrap';
    box.innerHTML = `<div class="sheet" role="dialog" aria-label="${esc(e.ko)}">
      <button class="icon-btn sheet-x" aria-label="Закрыть">${icon('close')}</button>
      <div class="sheet-head">${UI.cells(e.ko, 'big')}${sayBtn(e.ko)}${UI.pic(e.ko, 'lg')}</div>
      ${H.pron(e.ko) !== e.ko ? `<div class="sheet-pr">Читается: <span class="ko">[${esc(H.pron(e.ko))}]</span></div>` : ''}
      ${Store.settings().romanize ? `<div class="rr sheet-rr">${esc(H.romanize(e.ko))}</div>` : ''}
      <div class="sheet-ru">${esc(e.ru)}</div>
      <div class="muted sm">${esc(e.c)} · ${e.lessons.map((n) => (n === 0 ? 'мои слова' : `<a class="link" href="#/lesson/${n}">제${n}과</a>`)).join(', ')}</div>
      <div class="sheet-stats">${s ? `${strength(e.key)} <span class="sm">верно ${s.right}, ошибок ${s.wrong}</span>${Store.isHard(e.key) ? ' <b class="hard sm">трудное</b>' : ''}` : '<span class="sm muted">Ещё не тренировалось</span>'}</div>
      <label class="note-field"><span class="sm">Своя подсказка</span><textarea class="note-in" maxlength="200" rows="2" placeholder="Ассоциация, чтобы запомнить. Например: 곰 — «гом», медведь">${esc(Store.note(e.ko))}</textarea><span class="muted xs">Покажется вместе с переводом в карточках и после ответа.</span></label>
      ${e.mine ? '<button class="btn sm danger del-word" type="button">Удалить из моих слов</button>' : ''}
      ${ex.length ? `<h2 class="h">Встречается во фразах</h2>${ex.map((l) => `<div class="exm"><div><span class="ko">${esc(l.ko)}</span><div class="muted sm">${esc(l.ru)}</div></div>${sayBtn(l.ko, 'sm')}</div>`).join('')}` : ''}
    </div>`;
    const m = UI.modal(box);
    box.querySelector('.note-in').addEventListener('input', (ev) => Store.setNote(e.ko, ev.target.value));
    box.querySelector('.del-word')?.addEventListener('click', async () => {
      if (!(await UI.ask(`Удалить «${e.ko}» из своих слов?`, 'Удалить', true))) return;
      DB.removeCustom(e.ko); await m.close(); UI.toast('Удалено'); if (location.hash.startsWith('#/dict')) dict(document.getElementById('view'));
    });
    box.addEventListener('click', (ev) => { if (ev.target === box || ev.target.closest('.sheet-x')) m.close(); });
  }
  document.addEventListener('click', (ev) => {
    const r = ev.target.closest('.wrow[data-ko]');
    if (!r || ev.target.closest('.say') || document.body.classList.contains('in-session')) return;
    const e = DB.byKo.get(r.dataset.ko); if (e) wordSheet(e);
  });
  // строка слова в фокусе (Tab): Enter или пробел открывают карточку
  document.addEventListener('keydown', (ev) => {
    if ((ev.key !== 'Enter' && ev.key !== ' ') || !ev.target.matches?.('.wrow[data-ko]')) return;
    ev.preventDefault(); ev.target.click();
  });

  // Правило грамматики по кнопке «Правило →» из разбора ответа
  function ruleSheet(id) {
    const g = DB.grammar(DB.allNums()).find((x) => x.id === id) || (id === Numbers.RULE.id ? Numbers.RULE : null); if (!g) return;
    const box = document.createElement('div'); box.className = 'sheet-wrap';
    box.innerHTML = `<div class="sheet grammar" role="dialog" aria-label="${esc(g.title)}"><button class="icon-btn sheet-x" aria-label="Закрыть">${icon('close')}</button>
      <div class="g-head"><h3 class="serif">${esc(g.title)}</h3><span class="muted">${esc(g.short || '')}</span></div>
      ${g.body.map((p) => `<p>${p}</p>`).join('')}
      <div class="examples">${g.examples.map((x) => `<div class="exm"><div><span class="ko">${esc(x.ko)}</span><div class="muted sm">${esc(x.ru)}</div></div>${sayBtn(x.ko, 'sm')}</div>`).join('')}</div></div>`;
    const m = UI.modal(box);
    box.addEventListener('click', (ev) => { if (ev.target === box || ev.target.closest('.sheet-x')) m.close(); });
  }
  document.addEventListener('click', (ev) => { const b = ev.target.closest('[data-rule]'); if (b) { ev.preventDefault(); ruleSheet(b.dataset.rule); } });

  // ---------- Сообщить об ошибке ----------
  // Уходит в Google Форму (ответы в таблице у автора): без входа куда-либо и без перехода со страницы.
  const REPORT_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSfs_br18xE9lVd09HzwTQRZEjl042YH5ugRiIyzeXPSL2uwRA/formResponse';
  const REPORT_FIELD = 'entry.1084018497';
  // context — что приложится к сообщению: урок, задание, ответы (пишущий видит это под «Что ещё отправится»)
  function report(context) {
    const box = document.createElement('div'); box.className = 'sheet-wrap';
    box.innerHTML = `<form class="sheet report-sheet" role="dialog" aria-label="Сообщить об ошибке"><button type="button" class="icon-btn sheet-x" aria-label="Закрыть">${icon('close')}</button>
      <h3>Сообщить об ошибке</h3>
      <label class="note-field"><span class="sm">Что не так?</span><textarea class="rep-in" maxlength="1000" rows="4" required placeholder="Например: неверный перевод, ответ засчитан неправильно, слово читается иначе"></textarea></label>
      <details class="rep-ctx"><summary class="muted xs">Что ещё отправится</summary><pre class="xs">${esc(context)}</pre></details>
      <div class="row"><button class="btn">Отправить</button><button type="button" class="btn ghost rep-cancel">Отмена</button></div></form>`;
    const form = box.querySelector('form'), ta = box.querySelector('.rep-in');
    // клавиши в окне не доходят до тренировки (UI.modal): Enter в поле не листает вопрос, цифры не выбирают вариант
    const m = UI.modal(box, { focus: ta });
    box.addEventListener('click', (ev) => { if (ev.target === box || ev.target.closest('.sheet-x, .rep-cancel')) m.close(); });
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const text = ta.value.trim(); if (!text) return;
      const btn = form.querySelector('.btn'); btn.disabled = true; btn.textContent = 'Отправляю…';
      const where = `${matchMedia('(pointer: coarse)').matches ? 'телефон' : 'компьютер'} · голос: ${TTS.voiceName() || 'нет'} · ${new Date().toLocaleString('ru-RU')}`;
      try {
        // ответ Google Формы закрыт (no-cors): узнать можно только о сбое сети
        await fetch(REPORT_URL, { method: 'POST', mode: 'no-cors', body: new URLSearchParams({ [REPORT_FIELD]: `${text}\n\n---\n${context}\n${where}`.slice(0, 4000) }) });
        m.close(); UI.toast('Спасибо, сообщение отправлено');
      } catch {
        btn.disabled = false; btn.textContent = 'Отправить';
        UI.toast('Не отправилось: нет сети. Текст остался, попробуй ещё раз');
      }
    });
  }
  document.addEventListener('click', (ev) => {
    const b = ev.target.closest('[data-report]'); if (!b) return;
    const l = DB.lesson(b.dataset.report);
    report(l ? `Урок ${l.number}: ${l.title}` : 'Из настроек, без привязки к уроку');
  });

  // ---------- Словарь ----------
  const dictState = { q: '', lesson: 'all', cat: 'all', sort: 'lesson', hard: false };
  function dict(root) {
    root.innerHTML = `<h1 class="page-title">Словарь <span class="muted count"></span></h1>
      <div class="filters">
        <input class="search" type="search" placeholder="Поиск: 학생, студент, haksaeng…" value="${esc(dictState.q)}">
        <select class="f-lesson"><option value="all">Все уроки</option>${DB.lessons.map((l) => `<option value="${l.number}">제${l.number}과</option>`).join('')}<option value="0">Мои слова</option></select>
        <select class="f-cat"><option value="all">Все темы</option>${DB.categories().map((c) => `<option>${esc(c)}</option>`).join('')}</select>
        <select class="f-sort"><option value="lesson">По урокам</option><option value="abc">По алфавиту</option><option value="weak">Сначала слабые</option></select>
      </div>
      <div class="row dict-actions"><a class="btn sm ghost" id="dict-cards" href="#/practice/cards">Карточки по этой выборке</a><button class="btn sm ghost add-word" type="button">+ Своё слово</button><button class="btn sm ghost only-hard" type="button" aria-pressed="false"></button></div>
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
      const filter = { c: dictState.cat === 'all' ? '' : dictState.cat, q, hard: dictState.hard };
      const nHard = DB.entries.filter((e) => Store.isHard(e.key)).length;
      if (!nHard) dictState.hard = filter.hard = false;
      $('.only-hard').hidden = !nHard; $('.only-hard').textContent = `Трудные · ${nHard}`;
      $('.only-hard').classList.toggle('on', dictState.hard); $('.only-hard').setAttribute('aria-pressed', dictState.hard);
      let list = DB.entries.filter((e) => (dictState.lesson === 'all' || e.lessons.includes(+dictState.lesson)) && DB.matches(e, filter));
      if (dictState.sort === 'abc') list = list.slice().sort((a, b) => a.ko.localeCompare(b.ko, 'ko'));
      if (dictState.sort === 'weak') list = list.slice().sort((a, b) => Store.box(a.key) - Store.box(b.key));
      $('.count').textContent = list.length;
      // карточки ровно по тому, что сейчас видно в словаре: урок + тема + поиск
      const p = new URLSearchParams();
      // трудные могут быть в любом уроке, а без l= тренировка берёт только открытые уроки
      if (dictState.lesson !== 'all') p.set('l', dictState.lesson); else if (filter.hard) p.set('l', DB.allNums().join(','));
      if (filter.c) p.set('c', filter.c);
      if (filter.hard) p.set('h', '1');
      if (q) p.set('q', q);
      $('#dict-cards').href = `#/practice/cards${p.toString() ? '?' + p : ''}`;
      $('#dict-cards').textContent = `Карточки по этой выборке · ${list.length > 30 ? `30 из ${list.length}` : list.length}`;
      const row = (e) => `<div class="wrow" data-ko="${esc(e.ko)}" tabindex="0"><div class="w-ko"><span class="ko serif">${esc(e.ko)}</span>${UI.rr(e.ko)}</div>
        <div class="w-ru">${esc(e.ru)}<div class="w-meta">${Store.isHard(e.key) ? '<b class="hard">трудное</b> · ' : ''}${esc(e.c)} · ${e.lessons.map((n) => (n === 0 ? 'мои' : `제${n}과`)).join(', ')}</div></div><span class="wpic">${UI.pic(e.ko)}</span>${strength(e.key)}${sayBtn(e.ko, 'sm')}</div>`;
      const groupOf = dictState.sort === 'abc' ? (e) => { const d = H.decompose(e.ko[0]); return d ? d.cho : e.ko[0]; }
        : dictState.sort === 'lesson' && dictState.lesson === 'all' ? (e) => lessonName(e.lesson) : null; // при выбранном уроке заголовок один и не нужен
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
    $('.only-hard').addEventListener('click', () => { dictState.hard = !dictState.hard; draw(); });
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

  // Трудные слова (много ошибок за всё время): карточками, по всем урокам
  function hardLink() {
    const n = DB.entries.filter((e) => Store.isHard(e.key)).length;
    return n ? `<a class="btn ghost" href="#/practice/cards?l=${DB.allNums().join(',')}&h=1">Трудные слова · ${n}</a>` : '';
  }
  function mistakesBlock(nums) {
    const list = Practice.mistakes(nums);
    const label = (it) => it.entry ? `<span class="ko">${esc(it.entry.ko)}</span> — ${esc(it.entry.ru)}`
      : it.sys ? `числа: ${esc(Numbers.SYSTEMS[it.sys].title)}, ${it.n <= 10 ? 'до 10' : it.n < 100 ? 'до 100' : 'от 100'}`
      : it.target ? `пропись <span class="ko">${esc(it.target)}</span>`
      : it.jamo ? `буква <span class="ko">${esc(it.jamo)}</span>` : it.line ? `<span class="ko">${esc(it.line.ko)}</span>`
      : it.p ? `<span class="ko">${esc(it.p.ko)} … ${esc(it.jb.ko)}</span>`
      : it.fact ? `<span class="ko">${esc(it.fact.ko)}</span> — верно или нет` : it.rq ? esc(it.rq.q) : it.dlg ? `<span class="ko">${esc(it.dlg.lines[it.i].ko)}</span>` : esc(it.key);
    const q = String(nums) === String(DB.openNums()) ? '' : `?l=${nums.join(',')}`;
    return `<section class="block mistakes"><h2 class="h">Мои ошибки</h2>
      ${list.length ? `<div class="mist-list">${list.slice(0, 8).map((it) => `<div class="mist-row"><span>${label(it)}</span><span class="muted xs">ошибок: ${it.s.wrong}</span></div>`).join('')}</div>
        <div class="row"><a class="btn" href="#/practice/mistakes${q}">Тренировать ошибки · ${list.length}</a>${hardLink()}</div>`
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
        <div class="modes">${readRow((href, ex, title, desc) => `<a class="mode" href="${href}"><span class="mode-ex serif">${ex}</span><span class="mode-t"><b>${title}</b><span>${desc}</span></span><span class="arr">→</span></a>`)}</div>
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
        <label class="field"><span>Вопросов в тренировке</span><select data-k="sessionLen">${[10, 15, 25].map((n) => `<option value="${n}" ${s.sessionLen === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="field"><span>Новых слов в день (дальше только повторение)</span><input type="number" min="3" max="100" step="1" value="${s.newPerDay}" data-k="newPerDay"></label>
        <label class="field"><span>Задания с набором текста</span><input type="checkbox" data-k="typing" ${s.typing ? 'checked' : ''}></label>
        <label class="field"><span>Экранная корейская клавиатура (выключи, если есть своя корейская раскладка)</span><input type="checkbox" data-k="keyboard" ${s.keyboard ? 'checked' : ''}></label>
      </div>
      <div class="card form">
        <h3>Прогресс</h3>
        <p class="sm muted">Прогресс хранится только в этом браузере. Сохраняй его иногда в файл: так он не пропадёт, если браузер очистит данные. Файл можно загрузить и на другом устройстве.</p>
        <div class="row"><button class="btn sm exp">Сохранить в файл</button><label class="btn sm ghost">Загрузить из файла<input type="file" accept=".json" class="imp" hidden></label><button class="btn sm danger rst">Сбросить</button></div>
      </div>
      <div class="card form">
        <h3>Перенос на другое устройство</h3>
        <p class="sm muted">Создай ссылку и открой её на другом устройстве: прогресс объединится с тем, что там уже есть. Ссылку никому не отправляй.</p>
        <div class="row"><button class="btn sm mk-link">Создать ссылку</button></div>
        <textarea class="xfer" readonly hidden></textarea>
      </div>
      <div class="card"><h3>Нашёл ошибку?</h3><p class="sm">Неверный перевод, опечатка или задание работает не так — <button type="button" class="link" data-report="settings">напиши об этом</button>. Укажи урок и слово или фразу.</p></div>
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
      Store.setMeta('backupAt', Date.now());
    });
    root.querySelector('.imp').addEventListener('change', async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try { Store.importJSON(await f.text()); location.hash = '#/'; location.reload(); } catch (err) { UI.toast('Ошибка: ' + err.message); }
    });
    root.querySelector('.mk-link').addEventListener('click', async () => {
      const url = `${location.origin}${location.pathname}#/import/${await Store.pack()}`;
      const ta = root.querySelector('.xfer'); ta.hidden = false; ta.value = url; ta.select();
      Store.setMeta('backupAt', Date.now());
      if (navigator.share && matchMedia('(pointer: coarse)').matches) { navigator.share({ title: 'Мой корейский: прогресс', url }).catch(() => {}); return; }
      try { await navigator.clipboard.writeText(url); UI.toast('Ссылка скопирована'); } catch { UI.toast('Скопируй ссылку из поля'); }
    });
    root.querySelector('.rst').addEventListener('click', async () => { if (await UI.ask('Удалить весь прогресс и свои слова на этом устройстве? Это не отменить.', 'Удалить всё', true)) { Store.reset(); location.hash = '#/'; location.reload(); } });
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

  // ---------- Прогресс ----------
  // Что считается каким разделом (по началу ключа задания)
  const PART = [['w', 'Слова и фразы'], ['j b', 'Хангыль'], ['g', 'Грамматика'], ['build cloze tr dl rd tf shadow', 'Предложения и тексты'], ['txt', 'Чтение вслух'], ['num', 'Числа'], ['write speak', 'Прописи и произношение']];
  function progress(root) {
    const days = Store.lastDays(30), goal = Store.settings().dailyGoal;
    const top = Math.max(goal, ...days.map((d) => d.n), 1);
    const sum = (f) => days.reduce((a, d) => a + f(d), 0);
    const active = days.filter((d) => d.n).length, total = sum((d) => d.n), ok = sum((d) => d.ok);
    const now = Date.now();
    // по урокам: не начато, учу (уровень 0–2), знаю (3+)
    const lessonRow = (l) => {
      const keys = DB.lessonKeys(l.number), c = { new: 0, learn: 0, know: 0, due: 0 };
      keys.forEach((k) => { const b = Store.box(k); c[b < 0 ? 'new' : b >= 3 ? 'know' : 'learn']++; if (Store.isDue(k, now)) c.due++; });
      const pc = (x) => (keys.length ? (x / keys.length) * 100 : 0);
      const t = Store.getTest(l.number);
      return `<a class="prog-row" href="#/lesson/${l.number}"><span class="kicker serif">제${l.number}과</span>
        <span class="prog-main"><b>${esc(l.title)}</b>
          <span class="stack" title="знаю ${c.know}, учу ${c.learn}, не начато ${c.new}"><i class="k" style="width:${pc(c.know)}%"></i><i class="l" style="width:${pc(c.learn)}%"></i></span>
          <span class="muted xs">знаю ${c.know} · учу ${c.learn} · не начато ${c.new}${c.due ? ` · к повторению ${c.due}` : ''}${t ? ` · контрольная ${t.best}%` : ''}</span></span></a>`;
    };
    // по разделам: сколько заданий пробовал, сколько выучено, точность
    const parts = PART.map(([pre, title]) => {
      const p = pre.split(' '), keys = Store.keys().filter((k) => p.includes(k.split(':')[0]));
      let right = 0, wrong = 0, know = 0;
      keys.forEach((k) => { const s = Store.get(k); right += s.right; wrong += s.wrong; if (s.box >= 3) know++; });
      return keys.length ? `<div class="part"><b>${title}</b><span class="muted sm">заданий ${keys.length} · выучено ${know} · точность ${Math.round((right / Math.max(1, right + wrong)) * 100)}%</span></div>` : '';
    }).join('');
    root.innerHTML = `<h1 class="page-title">Прогресс</h1>
      <section class="stats">
        <div><b>${Store.streak()}</b><span>дней подряд</span></div>
        <div><b>${active}</b><span>дней из 30</span></div>
        <div><b>${total}</b><span>ответов за 30 дней</span></div>
        <div><b>${total ? Math.round((ok / total) * 100) + '%' : '—'}</b><span>точность за 30 дней</span></div>
      </section>
      <div class="card"><h3>Ответы по дням</h3>
        <div class="bars" role="img" aria-label="Ответы за 30 дней">${days.map((d) => `<i class="${d.n >= goal ? 'full' : ''}" style="height:${(d.n / top) * 100}%" title="${d.date}: ${d.n}, верно ${d.ok}"></i>`).join('')}
          <span class="goal-line" style="bottom:${(goal / top) * 100}%"></span></div>
        <div class="bars-x muted xs"><span>${days[0].date.slice(5).split('-').reverse().join('.')}</span><span>цель ${goal}</span><span>сегодня</span></div></div>
      ${Reading.speedCard(false)}
      <div class="card"><h3>Уроки</h3><div class="prog-legend muted xs"><i class="k"></i> знаю <i class="l"></i> учу <i></i> не начато</div>${DB.lessons.map(lessonRow).join('')}</div>
      ${parts ? `<div class="card"><h3>По разделам</h3>${parts}</div>` : ''}
      ${mistakesBlock(DB.openNums())}`;
  }

  // ---------- Свой 자기소개 ----------
  function intro(root) {
    const n = Practice.introLesson();
    const m = Store.intro() || { name: '', country: '', job: '' };
    const lands = DB.entries.filter((e) => e.c === 'Страны' && e.gen), jobs = DB.entries.filter((e) => e.job);
    const opt = (list, v) => `<option value="">—</option>${list.map((e) => `<option value="${esc(e.ko)}" ${e.ko === v ? 'selected' : ''}>${esc(e.ko)} · ${esc(e.ru)}</option>`).join('')}`;
    root.innerHTML = `<a class="back" href="#/lesson/${n}">${icon('back')} Урок ${n}</a>
      <h1 class="page-title">Расскажи о себе <span class="muted ko">자기소개</span></h1>
      <form class="card form intro-form">
        <label class="field"><span>Имя хангылем</span><input class="in-name" lang="ko" maxlength="12" autocomplete="off" placeholder="например, 안나" value="${esc(m.name)}"></label>
        <p class="muted xs">Имя пишется, как звучит: Анна → 안나, Максим → 막심, Айгерим → 아이게림.</p>
        <label class="field"><span>Страна</span><select class="in-land">${opt(lands, m.country)}</select></label>
        <label class="field"><span>Профессия</span><select class="in-job">${opt(jobs, m.job)}</select></label>
      </form>
      <div class="card intro-out"></div>`;
    const $ = (s) => root.querySelector(s);
    Keyboard.attach($('.intro-form'), $('.in-name'), () => {}, false);
    const draw = () => {
      const name = $('.in-name').value.trim();
      // буквы без слога (ㅇ, ㅏ) — имя ещё набирается, это не ошибка
      const bad = /[^가-힣ㄱ-ㅎㅏ-ㅣ ]/.test(name), typing = !bad && !/^[가-힣]+( [가-힣]+)*$/.test(name);
      Store.setIntro({ name: bad || typing ? '' : name, country: $('.in-land').value, job: $('.in-job').value });
      const lines = Practice.introLines(), q = `?l=${n}&s=intro`;
      $('.intro-out').innerHTML = bad ? '<p class="sm">Имя нужно написать корейскими буквами (можно печатать латиницей по раскладке: dkssk → 안나).</p>'
        : !lines.length ? '<p class="muted sm">Впиши имя — здесь появится твой рассказ.</p>'
        : `<h3>Твой рассказ</h3>${lines.map((l) => `<div class="exm"><div><span class="ko">${esc(l.ko)}</span><div class="muted sm">${esc(l.ru)}</div></div>${sayBtn(l.ko, 'sm')}</div>`).join('')}
          <button class="link" data-say="${esc(lines.map((l) => l.ko).join(' '))}">${icon('speaker')} Прослушать целиком</button>
          <div class="row"><a class="btn" href="#/practice/build${q}">Собрать из плашек</a><a class="btn ghost" href="#/practice/translate${q}">Перевести с русского</a>${Practice.micSupported() ? `<a class="btn ghost" href="#/practice/shadow${q}">Повторить вслух</a>` : ''}</div>`;
    };
    $('.intro-form').addEventListener('input', draw); $('.intro-form').addEventListener('change', draw);
    $('.intro-form').addEventListener('submit', (e) => e.preventDefault());
    draw();
  }

  function applyTheme() {
    const t = Store.settings().theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t;
    // цвет строки состояния телефона: при своей теме — её цвет в обоих мета-тегах, при «как в системе» — по системе
    const COLOR = { light: '#f4efe6', dark: '#13171c' };
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
      const own = /dark/.test(m.media) ? 'dark' : 'light';
      m.content = COLOR[t === 'auto' ? own : t] || COLOR[own];
    });
  }

  window.Views = { wordSheet, report, home, lessons, lesson, dict, hangul, practiceMenu, settings, importLink, intro, progress, applyTheme };
})();
