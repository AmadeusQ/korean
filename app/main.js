// Роутер по #хэшу и запуск.
(function () {
  const view = document.getElementById('view');

  function route() {
    Practice.cleanup(); TTS.stop(); // в том числе диалог, который читается по репликам
    document.querySelectorAll('.sheet-wrap, .lightbox').forEach((x) => x.remove());
    const [path, query] = (location.hash.slice(1) || '/').split('?');
    const params = new URLSearchParams(query || '');
    const parts = path.split('/').filter(Boolean);
    const tab = parts[0] || 'home';
    document.querySelectorAll('.nav a').forEach((a) => a.classList.toggle('on', a.dataset.tab === (tab === 'lesson' || tab === 'intro' ? 'lessons' : tab === 'progress' ? 'home' : tab)));
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
    if (window.speechSynthesis) speechSynthesis.addEventListener?.('voiceschanged', () => { if (!document.body.classList.contains('in-session')) route(); }, { once: true });
    if (Store.keys().length && !/firefox/i.test(navigator.userAgent)) navigator.storage?.persist?.().catch(() => {});
    if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  boot();
})();
