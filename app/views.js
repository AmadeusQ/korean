// Экраны: главная, уроки, урок, словарь, хангыль, тренировка, настройки.
(function () {
  const { esc, icon, sayBtn, strength } = UI;
  const H = Hangul;
  const allNums = () => DB.lessons.map((l) => l.number);
  const avgMastery = (keys) => {
    if (!keys.length) return 0;
    return keys.reduce((s, k) => s + Math.max(0, Store.box(k)), 0) / (keys.length * Store.MAX_BOX);
  };
  const learned = (keys) => keys.filter((k) => Store.box(k) >= 3).length;
  const dueCount = () => { const now = Date.now(); return DB.entries.filter((e) => Store.isDue(e.key, now)).length; };
  const plural = (n, a, b, c) => { const m = n % 10, h = n % 100; return n + ' ' + (m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 10 || h >= 20) ? b : c); };

  // ---------- Главная ----------
  function home(root) {
    const st = Store.todayStats(), goal = Store.settings().dailyGoal;
    const pct = Math.min(100, Math.round((st.n / goal) * 100));
    const keys = DB.entries.map((e) => e.key);
    const due = dueCount(), streak = Store.streak();
    const days = Store.lastDays(14); const maxN = Math.max(goal, ...days.map((d) => d.n));
    const last = DB.lessons[DB.lessons.length - 1];
    const hour = new Date().getHours();
    const hello = hour < 5 ? 'Доброй ночи' : hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';
    root.innerHTML = `
      <section class="hero">
        <div class="hero-text">
          <div class="eyebrow">${hello} · 안녕하세요!</div>
          <h1>${st.n >= goal ? 'Цель на сегодня выполнена 🎉' : st.n ? 'Продолжим?' : 'Пора потренироваться'}</h1>
          <p class="muted">${due ? `${plural(due, 'слово ждёт', 'слова ждут', 'слов ждут')} повторения.` : 'Повторять пока нечего, можно учить новое.'}</p>
          <div class="row">
            <a class="btn big" href="#/practice/mix">${icon('play')} Тренировка дня</a>
            <a class="btn ghost" href="#/practice">Выбрать режим</a>
          </div>
        </div>
        <div class="hero-side">
          <div class="ring" style="--p:${pct}"><div><b>${st.n}</b><span>из ${goal}</span></div></div>
          <div class="streak ${streak ? 'on' : ''}">${icon('flame')}<b>${streak}</b><span>${plural(streak, 'день', 'дня', 'дней').replace(/^\d+ /, '')} подряд</span></div>
        </div>
      </section>

      <section class="tiles">
        <div class="tile"><b>${DB.entries.length}</b><span>слов и фраз</span></div>
        <div class="tile"><b>${learned(keys)}</b><span>хорошо знаю</span></div>
        <div class="tile"><b>${due}</b><span>к повторению</span></div>
        <div class="tile"><b>${st.n ? Math.round((st.ok / st.n) * 100) + '%' : '—'}</b><span>точность сегодня</span></div>
      </section>

      <section class="card">
        <div class="card-head"><h3>Активность за 2 недели</h3><span class="muted sm">ответов в день</span></div>
        <div class="week">${days.map((d) => `<div class="day ${d.n >= goal ? 'full' : ''} ${d.n ? '' : 'zero'}" title="${d.date}: ${d.n}"><i style="height:${d.n ? Math.max(6, (d.n / maxN) * 100) : 0}%"></i><span>${new Date(d.date).getDate()}</span></div>`).join('')}</div>
      </section>

      ${last ? `<section class="card lesson-cta">
        <div><div class="eyebrow">Последний урок</div><h3>${last.number}. ${esc(last.title)}</h3><p class="muted sm">${esc(last.topics.slice(0, 3).join(' · '))}</p></div>
        <div class="row"><a class="btn" href="#/practice/mix?l=${last.number}">Тренировать</a><a class="btn ghost" href="#/lesson/${last.number}">Открыть</a></div>
      </section>` : ''}

      <h2 class="sec-title">Режимы</h2>
      ${modeGrid(allNums())}
    `;
  }

  function modeGrid(nums) {
    const q = nums.length === allNums().length ? '' : `?l=${nums.join(',')}`;
    return `<div class="modes">${Object.entries(Practice.MODES).map(([k, m]) => {
      const off = m.tts && !TTS.available();
      return `<a class="mode ${off ? 'off' : ''}" href="#/practice/${k}${q}" data-mode="${k}"><span class="mode-ic">${icon(m.icon)}</span><b>${m.title}</b><span>${off ? 'нужен корейский голос' : m.desc}</span></a>`;
    }).join('')}</div>`;
  }

  // ---------- Уроки ----------
  function lessons(root) {
    root.innerHTML = `<h1 class="page-title">Уроки</h1>
      <div class="lessons">${DB.lessons.map((l) => {
        const keys = DB.entries.filter((e) => e.lesson === l.number).map((e) => e.key);
        const m = Math.round(avgMastery(keys) * 100);
        return `<a class="lesson" href="#/lesson/${l.number}">
          <div class="num">${l.number}<small>урок</small></div>
          <div class="l-body"><h3>${esc(l.title)}</h3><p class="muted sm">${esc(l.source || '')}</p>
            <div class="chips">${l.topics.slice(0, 4).map((t) => `<span class="chip">${esc(t.split(':')[0])}</span>`).join('')}</div>
            <div class="meter"><i style="width:${m}%"></i></div><span class="muted xs">${plural(keys.length, 'новое слово', 'новых слова', 'новых слов')} · освоено ${m}%</span>
          </div></a>`;
      }).join('')}</div>`;
  }

  // ---------- Урок ----------
  function lesson(root, n) {
    const l = DB.lesson(n);
    if (!l) { root.innerHTML = '<p>Урок не найден</p>'; return; }
    const photos = DB.photos(l);
    const tabs = [
      ['overview', 'Обзор'], l.words.length && ['words', `Слова · ${l.words.length}`], l.phrases.length && ['phrases', `Фразы · ${l.phrases.length}`],
      l.grammar.length && ['grammar', 'Грамматика'], l.dialogues.length && ['dialogues', 'Диалоги'], photos.length && ['photos', `Конспект · ${photos.length}`],
    ].filter(Boolean);
    root.innerHTML = `
      <a class="back" href="#/lessons">${icon('back')} Все уроки</a>
      <section class="lesson-head">
        <div class="num lg">${l.number}<small>урок</small></div>
        <div><h1>${esc(l.title)}</h1><p class="muted">${esc(l.source || '')}</p>
          <div class="row"><a class="btn" href="#/practice/mix?l=${l.number}">${icon('play')} Тренировать урок</a><a class="btn ghost" href="#/practice/cards?l=${l.number}">${icon('cards')} Карточки</a></div></div>
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
    root.querySelectorAll('.tab').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab)));
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

  const wordRow = (w) => { const e = DB.byKo.get(w.ko) || w; return `<div class="wrow"><div class="w-ko"><span class="ko">${esc(w.ko)}</span>${UI.rr(w.ko)}</div><div class="w-ru">${esc(w.ru)}</div>${strength(e.key)}${sayBtn(w.ko, 'sm')}</div>`; };
  const TAB = {
    overview(l) {
      const units = l.hangul.map((u) => H.UNITS[u]);
      return `<div class="card"><h3>Что прошли</h3><ul class="topics">${l.topics.map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
        ${l.notes?.length ? `<div class="card note"><h3>Запомнить</h3>${l.notes.map((n) => `<p>${esc(n)}</p>`).join('')}</div>` : ''}
        ${units.length ? `<div class="card"><h3>Хангыль в этом уроке</h3><div class="chips">${units.map((u) => `<span class="chip">${u.title}</span>`).join('')}</div><a class="link" href="#/hangul">Открыть таблицу хангыля →</a></div>` : ''}
        <h3 class="sec-title">Как тренировать</h3>${modeGrid([l.number])}`;
    },
    words: (l) => `<div class="card list">${l.words.map(wordRow).join('')}</div>`,
    phrases: (l) => {
      const groups = {}; l.phrases.forEach((p) => (groups[p.c || 'Фразы'] = groups[p.c || 'Фразы'] || []).push(p));
      return Object.entries(groups).map(([g, ps]) => `<div class="card list"><h3>${esc(g)}</h3>${ps.map(wordRow).join('')}</div>`).join('');
    },
    grammar: (l) => l.grammar.map((g) => `<div class="card grammar"><div class="g-head"><h3 class="ko">${esc(g.title)}</h3><span class="muted">${esc(g.short || '')}</span></div>
      ${g.body.map((p) => `<p>${p}</p>`).join('')}
      <div class="examples">${g.examples.map((x) => `<div class="exm"><div><span class="ko">${esc(x.ko)}</span><div class="muted sm">${esc(x.ru)}</div></div>${sayBtn(x.ko, 'sm')}</div>`).join('')}</div></div>`).join('')
      + `<a class="btn" href="#/practice/grammar?l=${l.number}">${icon('pen')} Тренировать грамматику</a>`,
    dialogues: (l) => `<label class="toggle"><input type="checkbox" class="hide-ru"> Скрыть перевод</label>` + l.dialogues.map((d) => `<div class="card dialog"><h3>${esc(d.title)}</h3>
      ${d.lines.map((x) => `<div class="line">${x.who ? `<span class="who ko">${esc(x.who)}</span>` : '<span class="who"></span>'}<div class="bubble"><span class="ko">${esc(x.ko)}</span><div class="ru">${esc(x.ru)}</div></div>${sayBtn(x.ko, 'sm')}</div>`).join('')}
      <button class="link" data-say="${esc(d.lines.map((x) => x.ko).join(' '))}">${icon('speaker')} Прослушать весь диалог</button></div>`).join('')
      + `<a class="btn" href="#/practice/build?l=${l.number}">${icon('puzzle')} Собирать фразы</a>`,
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

  // ---------- Словарь ----------
  const dictState = { q: '', lesson: 'all', cat: 'all', sort: 'lesson' };
  function dict(root) {
    root.innerHTML = `<h1 class="page-title">Словарь <span class="muted count"></span></h1>
      <div class="filters">
        <input class="search" type="search" placeholder="Поиск: 학생, студент, hakseng…" value="${esc(dictState.q)}">
        <select class="f-lesson"><option value="all">Все уроки</option>${DB.lessons.map((l) => `<option value="${l.number}">Урок ${l.number}</option>`).join('')}</select>
        <select class="f-cat"><option value="all">Все темы</option>${DB.categories().map((c) => `<option>${esc(c)}</option>`).join('')}</select>
        <select class="f-sort"><option value="lesson">По урокам</option><option value="abc">По алфавиту</option><option value="weak">Сначала слабые</option></select>
      </div>
      <div class="row dict-actions"><a class="btn sm" id="dict-cards" href="#/practice/cards">${icon('cards')} Карточки по этой выборке</a></div>
      <div class="card list dict-list"></div>`;
    const $ = (s) => root.querySelector(s);
    $('.f-lesson').value = dictState.lesson; $('.f-cat').value = dictState.cat; $('.f-sort').value = dictState.sort;
    const draw = () => {
      const q = dictState.q.trim().toLowerCase();
      let list = DB.entries.filter((e) =>
        (dictState.lesson === 'all' || e.lessons.includes(+dictState.lesson)) &&
        (dictState.cat === 'all' || e.c === dictState.cat) &&
        (!q || e.ko.includes(q) || e.ru.toLowerCase().includes(q) || H.romanize(e.ko).includes(q.replace(/[\s-]/g, ''))));
      if (dictState.sort === 'abc') list = list.slice().sort((a, b) => a.ko.localeCompare(b.ko, 'ko'));
      if (dictState.sort === 'weak') list = list.slice().sort((a, b) => Store.box(a.key) - Store.box(b.key));
      $('.count').textContent = list.length;
      $('#dict-cards').href = `#/practice/cards${dictState.lesson === 'all' ? '' : '?l=' + dictState.lesson}`;
      $('.dict-list').innerHTML = list.length ? list.map((e) => `<div class="wrow"><div class="w-ko"><span class="ko">${esc(e.ko)}</span>${UI.rr(e.ko)}</div>
        <div class="w-ru">${esc(e.ru)}<div class="w-meta"><span class="tag">${esc(e.c)}</span><span class="tag ghost">урок ${e.lessons.join(', ')}</span></div></div>${strength(e.key)}${sayBtn(e.ko, 'sm')}</div>`).join('')
        : '<p class="muted center">Ничего не нашлось</p>';
    };
    $('.search').addEventListener('input', (e) => { dictState.q = e.target.value; draw(); });
    $('.f-lesson').addEventListener('change', (e) => { dictState.lesson = e.target.value; draw(); });
    $('.f-cat').addEventListener('change', (e) => { dictState.cat = e.target.value; draw(); });
    $('.f-sort').addEventListener('change', (e) => { dictState.sort = e.target.value; draw(); });
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
        <div class="b-out"><div class="b-syll ko">가</div><div><span class="rr b-rr">ga</span><div class="b-parts muted"></div></div><button class="say b-say" data-say="가">${icon('speaker')}</button></div>
        <div class="b-row"><span class="b-lbl">Согласная</span><div class="b-chips" data-part="cho">${H.CHO.map((c, i) => `<button class="${i ? '' : 'on'}" data-v="${c}">${c}</button>`).join('')}</div></div>
        <div class="b-row"><span class="b-lbl">Гласная</span><div class="b-chips" data-part="jung">${H.JUNG.map((c, i) => `<button class="${i ? '' : 'on'}" data-v="${c}">${c}</button>`).join('')}</div></div>
        <div class="b-row"><span class="b-lbl">Патчим</span><div class="b-chips" data-part="jong">${['', 'ㄱ', 'ㄴ', 'ㄷ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅅ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ', 'ㄲ', 'ㅆ'].map((c, i) => `<button class="${i ? '' : 'on'}" data-v="${c}">${c || '—'}</button>`).join('')}</div></div>
      </div>
      <div class="two-col">${table('vowels1')}${table('consonants1')}</div>
      <div class="two-col">${table('vowels2')}${table('consonants2')}</div>
      <div class="card"><h3>Патчим: 7 звуков</h3><p class="muted sm">Сколько бы ни было букв, на конце слога звучит только один из семи звуков.</p>
        <div class="batchim">${U.batchim.groups.map((g) => `<div class="bg"><div class="bg-sound ko">[${g.sound}]<span class="rr">${g.rr}</span></div><div class="bg-letters ko">${g.letters}</div><div class="bg-words">${g.words.map((w) => `<button class="tok ko" data-say="${w}">${w}</button>`).join('')}</div></div>`).join('')}</div></div>
      <a class="btn" href="#/practice/hangul">${icon('letters')} Тренировать хангыль</a>`;
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

  // ---------- Меню тренировки ----------
  let practiceNums = null;
  function practiceMenu(root) {
    if (!practiceNums) practiceNums = allNums();
    const draw = () => {
      root.innerHTML = `<h1 class="page-title">Тренировка</h1>
        <div class="card"><div class="card-head"><h3>Какие уроки</h3><button class="link all">${practiceNums.length === allNums().length ? 'Снять все' : 'Выбрать все'}</button></div>
          <div class="chips pick">${DB.lessons.map((l) => `<button class="chip ${practiceNums.includes(l.number) ? 'on' : ''}" data-n="${l.number}">${l.number}. ${esc(l.title)}</button>`).join('')}</div></div>
        ${!TTS.available() ? `<div class="card warn">Корейский голос не найден, поэтому аудирование выключено. <a class="link" href="#/settings">Как включить →</a></div>` : ''}
        ${practiceNums.length ? modeGrid(practiceNums) : '<p class="muted center">Выбери хотя бы один урок</p>'}`;
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
        <label class="field"><span>Задания с набором текста (нужна корейская раскладка)</span><input type="checkbox" data-k="typing" ${s.typing ? 'checked' : ''}></label>
      </div>
      <div class="card form">
        <h3>Прогресс</h3>
        <p class="sm muted">Прогресс хранится в этом браузере. Чтобы перенести его на другое устройство, сохрани файл и загрузи его там.</p>
        <div class="row"><button class="btn sm exp">Сохранить в файл</button><label class="btn sm ghost">Загрузить из файла<input type="file" accept=".json" class="imp" hidden></label><button class="btn sm danger rst">Сбросить</button></div>
      </div>
      <div class="card"><h3>Как поставить на телефон</h3><p class="sm">Открой сайт на телефоне. В Chrome: меню ⋮ → «Добавить на главный экран». В Safari: «Поделиться» → «На экран «Домой»». Приложение откроется без браузерной рамки и будет работать без интернета.</p></div>`;
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
      try { Store.importJSON(await f.text()); UI.toast('Прогресс загружен'); applyTheme(); } catch (err) { UI.toast('Ошибка: ' + err.message); }
    });
    root.querySelector('.rst').addEventListener('click', () => { if (confirm('Удалить весь прогресс на этом устройстве?')) { Store.reset(); UI.toast('Прогресс сброшен'); settings(root); } });
  }

  function applyTheme() {
    const t = Store.settings().theme;
    if (t === 'auto') document.documentElement.removeAttribute('data-theme'); else document.documentElement.dataset.theme = t;
  }

  window.Views = { home, lessons, lesson, dict, hangul, practiceMenu, settings, applyTheme };
})();
