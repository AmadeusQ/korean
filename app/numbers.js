// Числа: китайско-корейские (일, 이, 삼…) и исконно корейские (하나, 둘, 셋…).
(function () {
  const SD = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구'];
  // 0..9999: единица перед 십/백/천 не произносится (십, 백, 천)
  function sino(n) {
    if (n === 0) return '영';
    let out = '';
    [[1000, '천'], [100, '백'], [10, '십']].forEach(([v, u]) => {
      const d = Math.floor(n / v) % 10;
      if (d) out += (d === 1 ? '' : SD[d]) + u;
    });
    return out + SD[n % 10];
  }
  const NU = ['', '하나', '둘', '셋', '넷', '다섯', '여섯', '일곱', '여덟', '아홉'];
  const NT = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
  // 1..99
  const native = (n) => NT[Math.floor(n / 10)] + NU[n % 10];

  const SYSTEMS = {
    s: { title: 'китайско-корейские', ex: '일, 이, 삼', read: sino, max: 1000, use: 'деньги, даты, телефон, минуты' },
    n: { title: 'исконно корейские', ex: '하나, 둘, 셋', read: native, max: 99, use: 'счёт предметов, возраст, часы' },
  };
  // случайный набор чисел для тренировки: больше простых, немного крупных
  function sample(sys, count) {
    const set = new Set();
    const small = sys === 'n' ? 20 : 20;
    while (set.size < count) {
      const r = Math.random();
      const n = r < 0.45 ? 1 + Math.floor(Math.random() * small) : r < 0.85 ? 1 + Math.floor(Math.random() * 99)
        : sys === 's' ? (1 + Math.floor(Math.random() * 9)) * (Math.random() < 0.5 ? 100 : 1000) + (Math.random() < 0.5 ? Math.floor(Math.random() * 100) : 0) : 1 + Math.floor(Math.random() * 99);
      if (n <= SYSTEMS[sys].max || sys === 's') set.add(Math.min(n, 9999));
    }
    return [...set];
  }
  // похожие числа для отвлекающих вариантов
  function near(n, sys) {
    const max = sys === 'n' ? 99 : 9999;
    const c = new Set();
    const s = String(n);
    if (s.length >= 2) c.add(+s.split('').reverse().join(''));
    [1, -1, 2, -2, 10, -10, 11, -11, 100, -100].forEach((d) => c.add(n + d));
    return [...c].filter((x) => x > 0 && x <= max && x !== n);
  }

  // Как устроены числа: показывается перед первой тренировкой и по кнопке из разбора
  const RULE = {
    id: 'numbers', title: 'Числа', short: 'две системы счёта',
    body: [
      'В корейском две системы чисел, и у каждой своё применение.',
      '<b>Китайско-корейские</b>: 일 1, 이 2, 삼 3, 사 4, 오 5, 육 6, 칠 7, 팔 8, 구 9, 십 10, 백 100, 천 1000. Числа собираются как «два десять три»: 이십삼 = 23, 십오 = 15, 백이십 = 120. Единица перед 십, 백, 천 не говорится: 십, а не 일십. Для денег, дат, номеров телефона, минут.',
      '<b>Исконно корейские</b>: 하나 1, 둘 2, 셋 3, 넷 4, 다섯 5, 여섯 6, 일곱 7, 여덟 8, 아홉 9, 열 10. Десятки свои: 스물 20, 서른 30, 마흔 40, 쉰 50, 예순 60, 일흔 70, 여든 80, 아흔 90. Собираются так же: 열다섯 = 15, 스물셋 = 23. Есть только до 99. Для счёта предметов, возраста, часов.',
      'Перед счётным словом 하나, 둘, 셋, 넷, 스물 сокращаются: 한, 두, 세, 네, 스무 (한 시 — час, 두 개 — две штуки).',
    ],
    examples: [
      { ko: '이십삼', ru: '23 (китайско-корейское)' },
      { ko: '스물셋', ru: '23 (исконно корейское)' },
      { ko: '백오십', ru: '150' },
      { ko: '열다섯', ru: '15' },
    ],
  };

  // Обратно: 오천오백 → 5500, 공일공 (по цифрам) → 010. null, если это не число.
  const SV = { 영: 0, 공: 0, 일: 1, 이: 2, 삼: 3, 사: 4, 오: 5, 육: 6, 칠: 7, 팔: 8, 구: 9 }, SU = { 십: 10, 백: 100, 천: 1000 };
  function parseSino(s) {
    if (!/^[영공일이삼사오육칠팔구십백천만]+$/.test(s)) return null;
    if (!/[십백천만]/.test(s)) return [...s].map((c) => SV[c]).join('');
    let total = 0, sec = 0, d = null;
    for (const c of s) {
      if (c in SV) { if (d !== null) return null; d = SV[c]; }
      else if (c === '만') { total += (sec + (d ?? (sec ? 0 : 1))) * 10000; sec = 0; d = null; }
      else { sec += (d ?? 1) * SU[c]; d = null; }
    }
    return String(total + sec + (d ?? 0));
  }

  window.Numbers = { sino, native, SYSTEMS, RULE, sample, near, parseSino };
})();
