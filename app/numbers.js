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

  window.Numbers = { sino, native, SYSTEMS, sample, near };
})();
