// Мелкие общие помощники интерфейса.
(function () {
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const shuffle = (a) => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const uniqBy = (a, f) => { const s = new Set(); return a.filter((x) => { const k = f(x); if (s.has(k)) return false; s.add(k); return true; }); };

  const ICONS = {
    speaker: '<path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/>',
    home: '<path d="M3 11 12 3l9 8"/><path d="M5 10v10h14V10"/>',
    book: '<path d="M4 4h6a3 3 0 0 1 3 3v13a2 2 0 0 0-2-2H4z"/><path d="M20 4h-6a3 3 0 0 0-3 3v13a2 2 0 0 1 2-2h7z"/>',
    dict: '<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    play: '<path d="M7 4v16l13-8z"/>',
    letters: '<path d="M4 6h7M7.5 6v12"/><path d="M14 6h6M17 6v6M14 12h6M17 12v6"/>',
    gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
    flame: '<path d="M12 22c4 0 7-3 7-7 0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-3 3-5 5-5 8 0 4 3 7 7 7z"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    back: '<path d="M15 5l-7 7 7 7"/>',
    cards: '<rect x="3" y="6" width="13" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v13"/>',
    ear: '<path d="M6 9a6 6 0 1 1 12 0c0 4-4 5-4 9a3 3 0 0 1-6 0"/><path d="M10 9a2 2 0 1 1 4 0"/>',
    puzzle: '<path d="M4 7h4a2 2 0 1 1 4 0h4v4a2 2 0 1 1 0 4v4h-4a2 2 0 1 0-4 0H4v-4a2 2 0 1 0 0-4z"/>',
    pen: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13 7 4 4"/>',
    shuffle: '<path d="M3 7h4l10 10h4M3 17h4l3-3M14 10l3-3h4"/><path d="m18 4 3 3-3 3M18 14l3 3-3 3"/>',
    image: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="m21 17-5-5-9 8"/>',
    check: '<path d="m5 12 5 5 9-10"/>',
    mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3M8 21h8"/>',
    star:'<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z"/>',
  };
  const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  const sayBtn = (ko, cls = '') => `<button class="say ${cls}" data-say="${esc(ko)}" aria-label="Послушать">${icon('speaker')}</button>`;
  // как читается [학쌩], если не совпадает с написанием, и латиница по настройке
  const pr = (ko) => { const p = Hangul.pron(ko); return p !== ko ? `<span class="pr" title="Так читается">[${esc(p)}]</span>` : ''; };
  const rr = (ko) => pr(ko) + (Store.settings().romanize ? `<span class="rr">${esc(Hangul.romanize(ko))}</span>` : '');

  let toastTimer;
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function say(text, rate) {
    if (!TTS.speak(text, rate)) toast('Нет корейского голоса для озвучки — см. «Настройки»');
  }
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-say]');
    if (b) { e.preventDefault(); e.stopPropagation(); say(b.dataset.say, b.dataset.slow ? Math.max(0.45, Store.settings().rate * 0.6) : undefined); }
  });

  // Сила запоминания: 0..6 → 4 клетки
  function strength(key) {
    const b = Store.box(key);
    const lvl = b < 0 ? 0 : Math.min(4, Math.ceil((b + 1) * 4 / (Store.MAX_BOX + 1)));
    return `<span class="lvl l${lvl}" title="${b < 0 ? 'ещё не тренировалось' : 'уровень ' + b + ' из ' + Store.MAX_BOX}"><i></i><i></i><i></i><i></i></span>`;
  }

  // Слово по слогам в клетках 원고지 (короткие слова без пробелов), иначе обычный текст
  function cells(ko, cls = '') {
    const s = [...ko];
    if (s.length > 6 || /\s/.test(ko) || !s.every(Hangul.isSyllable)) return `<span class="ko serif phrase ${cls}">${esc(ko)}</span>`;
    return `<span class="cells ${cls}">${s.map((c) => `<span class="cell">${esc(c)}</span>`).join('')}</span>`;
  }
  // Печать 도장
  const stamp = (text) => `<div class="stamp" aria-label="${esc(text)}"><span>${esc(text)}</span></div>`;

  window.UI = { esc, shuffle, pick, uniqBy, icon, sayBtn, pr, rr, toast, say, strength, cells, stamp };
})();
