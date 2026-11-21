// Справочник хангыля и утилиты для слогов.
(function () {
  const CHO = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ'.split('');
  const JUNG = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ'.split('');
  const JONG = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'.split('')];

  const CHO_RR = ['g', 'kk', 'n', 'd', 'tt', 'r', 'm', 'b', 'pp', 's', 'ss', '', 'j', 'jj', 'ch', 'k', 't', 'p', 'h'];
  const JUNG_RR = ['a', 'ae', 'ya', 'yae', 'eo', 'e', 'yeo', 'ye', 'o', 'wa', 'wae', 'oe', 'yo', 'u', 'wo', 'we', 'wi', 'yu', 'eu', 'ui', 'i'];
  // Как звучит патчим (упрощённо, двойные по первому/основному звуку)
  const JONG_SOUND = { 'ㄱ': 'ㄱ', 'ㄲ': 'ㄱ', 'ㅋ': 'ㄱ', 'ㄳ': 'ㄱ', 'ㄺ': 'ㄱ', 'ㄴ': 'ㄴ', 'ㄵ': 'ㄴ', 'ㄶ': 'ㄴ',
    'ㄷ': 'ㄷ', 'ㅌ': 'ㄷ', 'ㅅ': 'ㄷ', 'ㅆ': 'ㄷ', 'ㅈ': 'ㄷ', 'ㅊ': 'ㄷ', 'ㅎ': 'ㄷ',
    'ㄹ': 'ㄹ', 'ㄼ': 'ㄹ', 'ㄽ': 'ㄹ', 'ㄾ': 'ㄹ', 'ㅀ': 'ㄹ', 'ㅁ': 'ㅁ', 'ㄻ': 'ㅁ', 'ㅂ': 'ㅂ', 'ㅍ': 'ㅂ', 'ㅄ': 'ㅂ', 'ㄿ': 'ㅂ', 'ㅇ': 'ㅇ' };
  const SOUND_RR = { 'ㄱ': 'k', 'ㄴ': 'n', 'ㄷ': 't', 'ㄹ': 'l', 'ㅁ': 'm', 'ㅂ': 'p', 'ㅇ': 'ng' };

  const isSyllable = (ch) => { const c = ch.charCodeAt(0); return c >= 0xac00 && c <= 0xd7a3; };
  function decompose(ch) {
    if (!isSyllable(ch)) return null;
    const i = ch.charCodeAt(0) - 0xac00;
    return { cho: CHO[Math.floor(i / 588)], jung: JUNG[Math.floor((i % 588) / 28)], jong: JONG[i % 28] };
  }
  function compose(cho, jung, jong = '') {
    const a = CHO.indexOf(cho), b = JUNG.indexOf(jung), c = JONG.indexOf(jong);
    if (a < 0 || b < 0 || c < 0) return '';
    return String.fromCharCode(0xac00 + (a * 21 + b) * 28 + c);
  }
  // Последний слог слова (без знаков) с патчимом?
  function hasBatchim(word) {
    const s = word.replace(/[^가-힣]/g, '');
    if (!s) return false;
    return decompose(s[s.length - 1]).jong !== '';
  }
  const copula = (w) => (hasBatchim(w) ? '이에요' : '예요');
  const topic = (w) => (hasBatchim(w) ? '은' : '는');

  // Упрощённая романизация (без большинства правил ассимиляции)
  const SPLIT = { 'ㄳ': ['ㄱ', 'ㅅ'], 'ㄵ': ['ㄴ', 'ㅈ'], 'ㄶ': ['ㄴ', 'ㅎ'], 'ㄺ': ['ㄹ', 'ㄱ'], 'ㄻ': ['ㄹ', 'ㅁ'], 'ㄼ': ['ㄹ', 'ㅂ'],
    'ㄽ': ['ㄹ', 'ㅅ'], 'ㄾ': ['ㄹ', 'ㅌ'], 'ㄿ': ['ㄹ', 'ㅍ'], 'ㅀ': ['ㄹ', 'ㅎ'], 'ㅄ': ['ㅂ', 'ㅅ'] };
  const NASAL = { 'ㄱ': 'ㅇ', 'ㄷ': 'ㄴ', 'ㅂ': 'ㅁ' };
  // Романизация с основными правилами чтения: связывание, назализация, ㄹ между гласными
  function romanize(text) {
    const syl = [...text].map((ch) => decompose(ch) || ch);
    let out = '';
    for (let i = 0; i < syl.length; i++) {
      const d = syl[i];
      if (typeof d === 'string') { out += d; continue; }
      const next = typeof syl[i + 1] === 'object' ? syl[i + 1] : null;
      let ini = CHO_RR[CHO.indexOf(d.cho)];
      if (d.cho === 'ㄹ' && d.afterL) ini = 'l';
      out += ini + JUNG_RR[JUNG.indexOf(d.jung)];
      if (!d.jong) continue;
      if (next && next.cho === 'ㅇ' && d.jong !== 'ㅇ') {
        // связывание: 있어요 → isseoyo, 읽으세요 → ilgeuseyo
        const [stay, move] = SPLIT[d.jong] || ['', d.jong];
        if (stay) out += SOUND_RR[JONG_SOUND[stay]];
        syl[i + 1] = { ...next, cho: move === 'ㅎ' ? 'ㅇ' : move };
        continue;
      }
      let snd = JONG_SOUND[d.jong];
      if (next && (next.cho === 'ㄴ' || next.cho === 'ㅁ') && NASAL[snd]) snd = NASAL[snd];
      if (snd === 'ㄹ' && next && next.cho === 'ㄹ') syl[i + 1] = { ...next, afterL: true };
      out += SOUND_RR[snd] || '';
    }
    return out;
  }

  // Как слово читается на самом деле (хангылем): 학생 → 학쌩, 한국어 → 한구거, 합니다 → 함니다.
  // Правила внутри слова без пробелов: связное чтение, ㅎ, назализация, ㄹ, напряжение, нейтрализация патчима.
  // Исключения на стыке корней (맛없다) и сайсиот (여권 [여꿘]) не учитываются.
  const TENSE = { 'ㄱ': 'ㄲ', 'ㄷ': 'ㄸ', 'ㅂ': 'ㅃ', 'ㅅ': 'ㅆ', 'ㅈ': 'ㅉ' };
  const ASPIR = { 'ㄱ': 'ㅋ', 'ㄷ': 'ㅌ', 'ㅂ': 'ㅍ', 'ㅈ': 'ㅊ' };
  function pronWord(w) {
    const s = [...w].map((ch) => decompose(ch) || ch);
    for (let i = 0; i < s.length; i++) {
      const d = s[i]; if (typeof d === 'string') continue;
      if (d.jung === 'ㅢ' && d.cho !== 'ㅇ') d.jung = 'ㅣ'; // 희 → 히
      if (!d.jong) continue;
      const n = typeof s[i + 1] === 'object' ? s[i + 1] : null;
      const [stay, move] = SPLIT[d.jong] || ['', d.jong];
      if (n && n.cho === 'ㅇ') {
        if (d.jong === 'ㅇ') continue;
        if (move === 'ㅎ') { d.jong = ''; if (stay) n.cho = stay; continue; } // 좋아요 → 조아요, 많아요 → 마나요
        let m = stay && move === 'ㅅ' ? 'ㅆ' : move;
        if (n.jung === 'ㅣ' && (m === 'ㄷ' || m === 'ㅌ')) m = m === 'ㄷ' ? 'ㅈ' : 'ㅊ'; // 같이 → 가치
        d.jong = stay; n.cho = m; continue;
      }
      if (move === 'ㅎ' && n) { // 좋다 → 조타, 좋습니다 → 조씀니다, 놓는 → 논는
        if (ASPIR[n.cho]) { n.cho = ASPIR[n.cho]; d.jong = stay; continue; }
        if (n.cho === 'ㅅ') { n.cho = 'ㅆ'; d.jong = stay; continue; }
        if (n.cho === 'ㄴ') { d.jong = stay || 'ㄴ'; if (d.jong === 'ㄹ') n.cho = 'ㄹ'; continue; }
      }
      const snd = JONG_SOUND[d.jong];
      if (n && n.cho === 'ㅎ' && ASPIR[snd]) { n.cho = ASPIR[snd]; d.jong = stay && stay !== snd ? stay : ''; continue; } // 축하 → 추카
      d.jong = snd;
      if (!n) continue;
      if ((n.cho === 'ㄴ' || n.cho === 'ㅁ') && NASAL[snd]) d.jong = NASAL[snd]; // 합니다 → 함니다
      else if (n.cho === 'ㄹ') {
        if (snd === 'ㄴ') d.jong = 'ㄹ'; // 신라 → 실라
        else if (snd !== 'ㄹ') { n.cho = 'ㄴ'; if (NASAL[snd]) d.jong = NASAL[snd]; } // 정류장 → 정뉴장, 독립 → 동닙
      } else if (snd === 'ㄹ' && n.cho === 'ㄴ') n.cho = 'ㄹ'; // 설날 → 설랄
      else if (NASAL[snd] && TENSE[n.cho]) n.cho = TENSE[n.cho]; // 학생 → 학쌩
    }
    return s.map((d) => (typeof d === 'string' ? d : compose(d.cho, d.jung, d.jong))).join('');
  }
  const pron = (text) => text.split(/(\s+)/).map(pronWord).join('');

  // Блоки, которые открываются уроками
  const UNITS = {
    vowels1: {
      title: 'Гласные 1', kind: 'vowel',
      items: [
        ['ㅏ', 'a', 'а'], ['ㅓ', 'eo', 'о (открытое)'], ['ㅗ', 'o', 'о (губы трубочкой)'], ['ㅜ', 'u', 'у'],
        ['ㅡ', 'eu', 'ы'], ['ㅣ', 'i', 'и'], ['ㅐ', 'ae', 'э'], ['ㅔ', 'e', 'е / э'],
      ],
    },
    consonants1: {
      title: 'Согласные 1', kind: 'cons',
      items: [
        ['ㄱ', 'g/k', 'к / г'], ['ㄴ', 'n', 'н'], ['ㄷ', 'd/t', 'т / д'], ['ㄹ', 'r/l', 'р / ль'], ['ㅁ', 'm', 'м'],
        ['ㅂ', 'b/p', 'п / б'], ['ㅅ', 's', 'с'], ['ㅇ', '–/ng', 'немая / нъ'], ['ㅈ', 'j', 'ч / дж'], ['ㅎ', 'h', 'х'],
      ],
    },
    vowels2: {
      title: 'Гласные 2', kind: 'vowel',
      items: [
        ['ㅑ', 'ya', 'я'], ['ㅕ', 'yeo', 'йо (открытое)'], ['ㅛ', 'yo', 'йо'], ['ㅠ', 'yu', 'ю'], ['ㅒ', 'yae', 'йэ'],
        ['ㅖ', 'ye', 'йе'], ['ㅘ', 'wa', 'ва'], ['ㅙ', 'wae', 'вэ'], ['ㅚ', 'oe', 'вэ'], ['ㅝ', 'wo', 'во'],
        ['ㅞ', 'we', 'вэ'], ['ㅟ', 'wi', 'ви'], ['ㅢ', 'ui', 'ый'],
      ],
    },
    consonants2: {
      title: 'Согласные 2', kind: 'cons',
      items: [
        ['ㅋ', 'k', 'кх (с выдохом)'], ['ㅌ', 't', 'тх (с выдохом)'], ['ㅍ', 'p', 'пх (с выдохом)'], ['ㅊ', 'ch', 'чх (с выдохом)'],
        ['ㄲ', 'kk', 'кк (напряжённое)'], ['ㄸ', 'tt', 'тт (напряжённое)'], ['ㅃ', 'pp', 'пп (напряжённое)'],
        ['ㅆ', 'ss', 'сс (напряжённое)'], ['ㅉ', 'jj', 'чч (напряжённое)'],
      ],
    },
    batchim: {
      title: 'Патчим', kind: 'batchim',
      groups: [
        { sound: 'ㄱ', rr: 'k', letters: 'ㄱ ㄲ ㅋ', words: ['약', '밖', '부엌'] },
        { sound: 'ㄴ', rr: 'n', letters: 'ㄴ', words: ['눈', '문', '손'] },
        { sound: 'ㄷ', rr: 't', letters: 'ㄷ ㅌ ㅅ ㅆ ㅈ ㅊ ㅎ', words: ['곧', '밑', '옷', '낮', '빛'] },
        { sound: 'ㄹ', rr: 'l', letters: 'ㄹ', words: ['달', '물', '불'] },
        { sound: 'ㅁ', rr: 'm', letters: 'ㅁ', words: ['곰', '봄', '땀'] },
        { sound: 'ㅂ', rr: 'p', letters: 'ㅂ ㅍ', words: ['밥', '집', '옆'] },
        { sound: 'ㅇ', rr: 'ng', letters: 'ㅇ', words: ['공', '병', '빵'] },
      ],
    },
  };

  UNITS.names = { title: 'Названия букв', kind: 'names' };
  const NAMES = { 'ㄱ': '기역', 'ㄴ': '니은', 'ㄷ': '디귿', 'ㄹ': '리을', 'ㅁ': '미음', 'ㅂ': '비읍', 'ㅅ': '시옷', 'ㅇ': '이응', 'ㅈ': '지읒', 'ㅊ': '치읓',
    'ㅋ': '키읔', 'ㅌ': '티읕', 'ㅍ': '피읖', 'ㅎ': '히읗', 'ㄲ': '쌍기역', 'ㄸ': '쌍디귿', 'ㅃ': '쌍비읍', 'ㅆ': '쌍시옷', 'ㅉ': '쌍지읒' };

  // Похожие на слух группы (для аудирования и отвлекающих вариантов)
  const SIMILAR = [
    ['ㄱ', 'ㅋ', 'ㄲ'], ['ㄷ', 'ㅌ', 'ㄸ'], ['ㅂ', 'ㅍ', 'ㅃ'], ['ㅈ', 'ㅊ', 'ㅉ'], ['ㅅ', 'ㅆ'], ['ㄴ', 'ㄹ', 'ㅁ'],
    ['ㅓ', 'ㅗ'], ['ㅜ', 'ㅡ'], ['ㅐ', 'ㅔ'], ['ㅙ', 'ㅚ', 'ㅞ'], ['ㅟ', 'ㅝ'], ['ㅢ', 'ㅣ'], ['ㅑ', 'ㅕ'], ['ㅛ', 'ㅠ'], ['ㅏ', 'ㅓ'], ['ㅒ', 'ㅖ'],
  ];
  const similarTo = (j) => (SIMILAR.find((g) => g.includes(j)) || [j]).filter((x) => x !== j);

  function jamoInfo(j) {
    for (const [key, u] of Object.entries(UNITS)) {
      if (!u.items) continue;
      const it = u.items.find((x) => x[0] === j);
      if (it) return { jamo: it[0], rr: it[1], ru: it[2], unit: key, kind: u.kind };
    }
    return null;
  }

  window.Hangul = { NAMES, CHO, JUNG, JONG, UNITS, JONG_SOUND, SOUND_RR, decompose, compose, hasBatchim, copula, topic, romanize, pron, similarTo, jamoInfo, isSyllable };
})();
