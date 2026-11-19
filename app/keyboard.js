// Экранная корейская клавиатура (두벌식): сама собирает буквы в слоги.
(function () {
  const H = Hangul;
  const VOWELS = new Set(H.JUNG);
  const V_JOIN = { 'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ', 'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ', 'ㅡㅣ': 'ㅢ' };
  const C_JOIN = { 'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ', 'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ', 'ㅂㅅ': 'ㅄ' };
  const V_SPLIT = Object.fromEntries(Object.entries(V_JOIN).map(([k, v]) => [v, [...k]]));
  const C_SPLIT = Object.fromEntries(Object.entries(C_JOIN).map(([k, v]) => [v, [...k]]));
  const canJong = (c) => H.JONG.includes(c) && !['ㄸ', 'ㅃ', 'ㅉ'].includes(c);

  // Последовательность букв → текст (автомат набора)
  function assemble(seq) {
    let out = '', cur = null; // cur = { cho, jung, jong }
    const flush = () => {
      if (!cur) return;
      if (cur.cho && cur.jung) out += H.compose(cur.cho, cur.jung, cur.jong || '');
      else out += cur.cho || cur.jung || '';
      cur = null;
    };
    for (const j of seq) {
      if (j === ' ') { flush(); out += ' '; continue; }
      if (VOWELS.has(j)) {
        if (cur && cur.cho && !cur.jung) cur.jung = j;
        else if (cur && cur.jung && !cur.jong && cur.cho && V_JOIN[cur.jung + j]) cur.jung = V_JOIN[cur.jung + j];
        else if (cur && cur.jong) {
          // патчим уходит в начало следующего слога: 학ㅐ → 하개
          const [stay, move] = C_SPLIT[cur.jong] || [null, cur.jong];
          cur.jong = stay; flush(); cur = { cho: move, jung: j };
        } else { flush(); cur = { jung: j }; }
      } else {
        if (cur && cur.cho && cur.jung && !cur.jong && canJong(j)) cur.jong = j;
        else if (cur && cur.jong && C_JOIN[cur.jong + j]) cur.jong = C_JOIN[cur.jong + j];
        else { flush(); cur = { cho: j }; }
      }
    }
    flush();
    return out;
  }
  // Текст → последовательность букв (чтобы стирать по одной букве)
  function toSeq(text) {
    const seq = [];
    for (const ch of text) {
      const d = H.decompose(ch);
      if (!d) { seq.push(ch); continue; }
      seq.push(d.cho, ...(V_SPLIT[d.jung] || [d.jung]));
      if (d.jong) seq.push(...(C_SPLIT[d.jong] || [d.jong]));
    }
    return seq;
  }

  const ROWS = [['ㅂ', 'ㅈ', 'ㄷ', 'ㄱ', 'ㅅ', 'ㅛ', 'ㅕ', 'ㅑ', 'ㅐ', 'ㅔ'], ['ㅁ', 'ㄴ', 'ㅇ', 'ㄹ', 'ㅎ', 'ㅗ', 'ㅓ', 'ㅏ', 'ㅣ'], ['shift', 'ㅋ', 'ㅌ', 'ㅊ', 'ㅍ', 'ㅠ', 'ㅜ', 'ㅡ', 'back']];
  const SHIFT = { 'ㅂ': 'ㅃ', 'ㅈ': 'ㅉ', 'ㄷ': 'ㄸ', 'ㄱ': 'ㄲ', 'ㅅ': 'ㅆ', 'ㅐ': 'ㅒ', 'ㅔ': 'ㅖ' };

  // Физические клавиши → буквы по раскладке 두벌식 (по коду клавиши, работает и при русской/английской раскладке)
  const CODE = { KeyQ: 'ㅂ', KeyW: 'ㅈ', KeyE: 'ㄷ', KeyR: 'ㄱ', KeyT: 'ㅅ', KeyY: 'ㅛ', KeyU: 'ㅕ', KeyI: 'ㅑ', KeyO: 'ㅐ', KeyP: 'ㅔ',
    KeyA: 'ㅁ', KeyS: 'ㄴ', KeyD: 'ㅇ', KeyF: 'ㄹ', KeyG: 'ㅎ', KeyH: 'ㅗ', KeyJ: 'ㅓ', KeyK: 'ㅏ', KeyL: 'ㅣ',
    KeyZ: 'ㅋ', KeyX: 'ㅌ', KeyC: 'ㅊ', KeyV: 'ㅍ', KeyB: 'ㅠ', KeyN: 'ㅜ', KeyM: 'ㅡ' };
  const CODE_SHIFT = { KeyQ: 'ㅃ', KeyW: 'ㅉ', KeyE: 'ㄸ', KeyR: 'ㄲ', KeyT: 'ㅆ', KeyO: 'ㅒ', KeyP: 'ㅖ' };

  // Подключить к полю ввода. onEnter вызывается по кнопке «готово». visual=false — только физическая клавиатура.
  function attach(host, input, onEnter, visual = true) {
    let seq = toSeq(input.value), shift = false;
    input.addEventListener('keydown', (e) => {
      if (e.isComposing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (/[ㄱ-ㆎ가-힣]/.test(e.key) || e.key === 'Process') return; // уже стоит корейская раскладка
      const j = (e.shiftKey && CODE_SHIFT[e.code]) || CODE[e.code];
      if (j) { e.preventDefault(); seq.push(j); sync(); return; }
      if (e.key === 'Backspace' && input.selectionStart === input.value.length && input.selectionEnd === input.value.length) { e.preventDefault(); seq.pop(); sync(); return; }
      if (e.key === ' ') { e.preventDefault(); seq.push(' '); sync(); }
    });
    const kb = document.createElement('div'); kb.className = 'kb';
    const draw = () => {
      kb.innerHTML = ROWS.map((r) => `<div class="kb-row">${r.map((k) => {
        if (k === 'shift') return `<button type="button" class="kb-k wide ${shift ? 'on' : ''}" data-k="shift" aria-label="Двойные согласные">⇧</button>`;
        if (k === 'back') return `<button type="button" class="kb-k wide" data-k="back" aria-label="Стереть">⌫</button>`;
        const v = shift && SHIFT[k] ? SHIFT[k] : k;
        return `<button type="button" class="kb-k" data-k="${v}">${v}</button>`;
      }).join('')}</div>`).join('') +
        `<div class="kb-row"><button type="button" class="kb-k space" data-k=" ">пробел</button><button type="button" class="kb-k enter" data-k="enter">Проверить</button></div>`;
    };
    const sync = () => { input.value = assemble(seq); input.dispatchEvent(new Event('kbinput')); };
    kb.addEventListener('pointerdown', (e) => e.preventDefault()); // не забирать фокус
    kb.addEventListener('click', (e) => {
      const b = e.target.closest('[data-k]'); if (!b || input.disabled) return;
      const k = b.dataset.k;
      if (k === 'shift') { shift = !shift; draw(); return; }
      if (k === 'enter') { onEnter(); return; }
      if (k === 'back') seq.pop(); else seq.push(k);
      if (shift) { shift = false; draw(); }
      sync();
    });
    // если печатают с обычной клавиатуры — подхватить
    input.addEventListener('input', () => { seq = toSeq(input.value); });
    if (!visual) return null;
    draw(); host.appendChild(kb);
    return kb;
  }

  window.Keyboard = { attach, assemble, toSeq };
})();
