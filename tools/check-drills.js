// Проверка упражнений: node tools/check-drills.js
// Загружает приложение без браузера, строит задания всех режимов по всем урокам и генерирует каждый вопрос
// несколько раз. Ошибка — исключение в генераторе, не ровно один верный вариант, повтор вариантов, меньше двух вариантов.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(root, f), 'utf8');

// Заглушки браузера: хранилище в памяти, корейский голос «есть», распознавания речи нет
const store = {};
const ctx = {
  console, setTimeout, clearTimeout, setInterval, clearInterval, URLSearchParams, TextEncoder, TextDecoder,
  localStorage: { getItem: (k) => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); } },
  matchMedia: () => ({ matches: false }),
  speechSynthesis: { getVoices: () => [{ lang: 'ko-KR', name: 'Google 한국의' }], cancel() {}, speak() {} },
  SpeechSynthesisUtterance: function () {},
  navigator: {},
  location: { hash: '' },
};
ctx.window = ctx;
ctx.document = {
  addEventListener() {}, removeEventListener() {}, querySelectorAll: () => [], getElementById: () => null,
  body: { classList: { add() {}, remove() {}, contains: () => false } },
  // DB.load подключает уроки через <script>: выполняем файл сразу
  createElement: () => ({}),
  head: { appendChild(s) { try { vm.runInContext(read(s.src), ctx, { filename: s.src }); s.onload(); } catch (e) { s.onerror(e); } } },
};
vm.createContext(ctx);
const run = (f) => vm.runInContext(read(f), ctx, { filename: f });
run('data/index.js');
run('data/pictures.js');
['hangul', 'store', 'tts', 'ui', 'keyboard', 'numbers', 'data', 'practice'].forEach((f) => run(`app/${f}.js`));

const errors = new Set();
const ROUNDS = 6; // вопросы случайные: каждый генерируем несколько раз
(async () => {
  await ctx.DB.load();
  const { Practice, DB } = ctx;
  const nums = DB.allNums();
  const sets = [nums, ...nums.map((n) => [n])]; // все уроки вместе и каждый по отдельности
  const counts = {};
  for (const ns of sets) for (const mode of Object.keys(Practice.MODES)) {
    if (mode === 'mistakes') continue;
    let pool;
    try { pool = Practice.buildPool(mode, ns); } catch (e) { errors.add(`${mode} [${ns}]: buildPool — ${e.message}`); continue; }
    if (ns === nums) counts[mode] = pool.length;
    for (const it of pool) for (const t of it.types) for (let r = 0; r < ROUNDS; r++) {
      const where = `${t} ${it.key}`;
      let q;
      try { q = Practice.GEN[t](it); } catch (e) { errors.add(`${where}: ${e.message}`); break; }
      if (q.kind === 'choice') {
        const ok = q.options.filter((o) => o.ok).length;
        if (ok !== 1) errors.add(`${where}: верных вариантов ${ok}`);
        const texts = q.options.map((o) => o.text);
        if (new Set(texts).size !== texts.length) errors.add(`${where}: повтор вариантов [${texts.join(' / ')}]`);
        if (texts.length < 2) errors.add(`${where}: меньше двух вариантов`);
        if (texts.some((x) => !String(x).trim())) errors.add(`${where}: пустой вариант`);
      }
      // картинка подсказала бы ответ: в вопросе её быть не должно (кроме «Перед тобой: …», где она и есть условие)
      if (t !== 'yesno' && /class="pic/.test(q.prompt || '')) errors.add(`${where}: картинка в вопросе`);
      if ((q.kind === 'type' || q.kind === 'build') && !q.answer) errors.add(`${where}: нет ответа`);
      if (q.kind === 'build' && q.answerToks && q.answerToks.some((x) => !q.tokens.includes(x))) errors.add(`${where}: плашек ответа нет среди плашек`);
    }
  }
  // «Мои ошибки»: каждый ключ, который могут дать задания, должен находиться обратно
  const keys = new Set();
  for (const mode of Object.keys(Practice.MODES)) if (mode !== 'mistakes') Practice.buildPool(mode, nums).forEach((it) => keys.add(it.key));
  keys.forEach((k) => ctx.Store.answer(k, false));
  const back = new Set(Practice.buildPool('mistakes', nums).map((it) => it.key));
  keys.forEach((k) => { if (!back.has(k)) errors.add(`Мои ошибки: ключ ${k} не находится через resolveKey`); });

  console.log('Заданий по режимам:', Object.entries(counts).map(([m, n]) => `${m} ${n}`).join(', '));
  [...errors].sort().forEach((m) => console.log('ОШИБКА  ' + m));
  console.log(`\nОшибок: ${errors.size}`);
  process.exit(errors.size ? 1 : 0);
})();
