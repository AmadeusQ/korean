// Роутер по #хэшу и запуск.
(function () {
  const view = document.getElementById('view');

  function route() {
    Practice.cleanup(); Reading.stop(); TTS.stop(); // в том числе диалог, который читается по репликам
    UI.dropModals();
    const [path, query] = (location.hash.slice(1) || '/').split('?');
    const params = new URLSearchParams(query || '');
    const parts = path.split('/').filter(Boolean);
    const tab = parts[0] || 'home';
    document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.tab === (tab === 'lesson' || tab === 'intro' ? 'lessons' : tab === 'progress' ? 'home' : tab === 'read' ? 'practice' : tab)));
    window.scrollTo(0, 0);
    const nums = params.get('l') ? params.get('l').split(',').filter((x) => x !== '').map(Number).filter((n) => !isNaN(n)) : DB.openNums();
    switch (tab) {
      case 'lessons': return Views.lessons(view);
      case 'lesson': return Views.lesson(view, parts[1]);
      case 'dict': return Views.dict(view);
      case 'hangul': return Views.hangul(view);
      case 'settings': return Views.settings(view);
      case 'import': return Views.importLink(view, parts[1] || '');
      case 'intro': return Views.intro(view);
      case 'progress': return Views.progress(view);
      case 'read': return parts[1] ? Reading.text(view, parts[1]) : Reading.list(view);
      case 'practice':
        if (parts[1] && Practice.MODES[parts[1]]) return Practice.start(view, parts[1], nums, { c: params.get('c') || '', q: params.get('q') || '', intro: params.get('s') === 'intro', hard: params.get('h') === '1' });
        return Views.practiceMenu(view);
      default: return Views.home(view);
    }
  }

  async function boot() {
    Views.applyTheme();
    try { await DB.load(); } catch (e) { view.innerHTML = `<p class="empty">${UI.esc(e.message)}</p>`; return; }
    window.addEventListener('hashchange', route);
    route();
    // голоса в Chrome подгружаются с задержкой — перерисуем, когда появятся
    if (window.speechSynthesis) speechSynthesis.addEventListener?.('voiceschanged', () => { if (!document.body.classList.contains('in-session') && !Reading.busy()) route(); }, { once: true });
    if (Store.keys().length && !/firefox/i.test(navigator.userAgent)) navigator.storage?.persist?.().catch(() => {});
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
    watchUpdates();
  }

  // Новая версия сайта. GitHub Pages ставит всем файлам время выкладки (Last-Modified), по нему и сверяемся.
  // Своя версия — время загруженной страницы (document.lastModified): если она открылась из офлайн-кэша старой,
  // плашка появится сразу. Проверяем при старте, при возвращении в приложение, при переходах и раз в 5 минут, пока оно открыто
  // (не чаще раза в 3 минуты). Pages кэширует ответы до 10 минут, так что плашка может прийти не сразу после выкладки.
  function watchUpdates() {
    if (!location.protocol.startsWith('http')) return;
    const GAP = 3 * 60000;
    const mine = Date.parse(document.lastModified); // без заголовка браузер даёт текущее время — тогда новее не будет ничего
    let at = 0, pending = false, seen = null, firstTag = null;
    const stamp = async () => {
      try {
        const r = await fetch('index.html', { method: 'HEAD', cache: 'no-store' });
        return r.ok ? { time: Date.parse(r.headers.get('last-modified') || ''), tag: r.headers.get('etag') } : null;
      } catch { return null; }
    };
    const show = () => {
      // посреди тренировки не отвлекаем: плашка появится после неё
      if (document.body.classList.contains('in-session')) { pending = true; return; }
      pending = false;
      if (document.querySelector('.update-bar')) return;
      const bar = document.createElement('div'); bar.className = 'update-bar'; bar.setAttribute('role', 'status');
      bar.innerHTML = '<span>Вышла новая версия</span><button type="button" class="btn sm">Обновить</button><button type="button" class="icon-btn" aria-label="Позже">' + UI.icon('close') + '</button>';
      bar.querySelector('.btn').addEventListener('click', () => location.reload());
      // «Позже»: про эту версию больше не напоминаем, про следующую — да
      bar.querySelector('.icon-btn').addEventListener('click', () => { bar.remove(); dismissed = seen; });
      document.body.appendChild(bar);
    };
    let dismissed = null;
    const check = async () => {
      if (document.visibilityState !== 'visible' || Date.now() - at < GAP) return;
      at = Date.now();
      const v = await stamp(); if (!v) return;
      // время выкладки новее загруженной страницы (точность заголовка — секунда); без Last-Modified — по смене ETag
      const key = v.time || v.tag; if (!key) return;
      const newer = v.time ? v.time > mine + 1000 : firstTag !== null && v.tag !== firstTag;
      if (firstTag === null) firstTag = v.tag;
      if (!newer || key === dismissed) return;
      seen = key; show();
    };
    check();
    document.addEventListener('visibilitychange', check);
    setInterval(check, 5 * 60000);
    window.addEventListener('hashchange', () => { if (pending) setTimeout(show, 300); else check(); });
  }
  boot();
})();
