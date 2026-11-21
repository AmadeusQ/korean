// Проверка данных уроков: node tools/check-lessons.js
// Ошибки (exit 1) ломают приложение или упражнения, предупреждения стоит посмотреть глазами.
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const errors = [], warns = [];
const err = (where, msg) => errors.push(`${where}: ${msg}`);
const warn = (where, msg) => warns.push(`${where}: ${msg}`);

// data/index.js и уроки — обычные скрипты с глобалами, выполняем их как в браузере
const window = {};
new Function('window', fs.readFileSync(path.join(root, 'data/index.js'), 'utf8'))(window);
const listed = window.LESSON_FILES || [];
const lessons = [];
const files = fs.readdirSync(path.join(root, 'data/lessons')).filter((f) => f.endsWith('.js')).sort();
for (const f of files) {
  const before = lessons.length;
  try { new Function('registerLesson', fs.readFileSync(path.join(root, 'data/lessons', f), 'utf8'))((l) => lessons.push({ ...l, file: f })); }
  catch (e) { err(f, `не выполняется: ${e.message}`); continue; }
  if (lessons.length !== before + 1) err(f, 'должен вызвать registerLesson ровно один раз');
}

const WORD_C = ['Люди', 'Профессии', 'Страны', 'Еда', 'Вещи', 'Места', 'Природа', 'Животные', 'Тело', 'Время', 'Действия', 'Описание', 'Числа', 'Служебные'];
const T = ['v', 'adv', 'pron', 'excl', 'cnt', 'suf', 'num'];
const HANGUL = ['vowels1', 'consonants1', 'vowels2', 'consonants2', 'batchim', 'names'];
const GRAMMAR = ['copula', 'topic', 'yesno']; // известные id; генераторы есть для copula и topic
const hasKo = (s) => /[가-힣]/.test(s);
const sentences = (s) => (s.match(/[^.?!]+[.?!]*/g) || []).map((x) => x.trim()).filter(Boolean);

const numbers = new Set();
const seenKo = new Map(); // ko → { ru, where }
for (const l of lessons) {
  const at = l.file;
  const id = l.file.replace(/\.js$/, '');
  if (l.id !== id) err(at, `id «${l.id}» не совпадает с именем файла`);
  if (!listed.includes(id)) err(at, 'нет в data/index.js');
  if (!Number.isInteger(l.number) || l.number < 1) err(at, 'number должен быть целым от 1');
  if (numbers.has(l.number)) err(at, `номер ${l.number} уже занят`); numbers.add(l.number);
  for (const k of ['title', 'source']) if (!l[k]) err(at, `нет поля ${k}`);
  if (!Array.isArray(l.topics) || !l.topics.length) warn(at, 'пустой topics');
  (l.hangul || []).forEach((u) => HANGUL.includes(u) || err(at, `неизвестный блок хангыля «${u}»`));
  const dir = path.join(root, 'materials', id);
  if (fs.existsSync(dir)) {
    const n = fs.readdirSync(dir).filter((f) => /^\d\d\.jpg$/.test(f)).length;
    if (n !== (l.photos || 0)) warn(at, `photos: ${l.photos || 0}, а в materials/${id} фото ${n}`);
  }

  const inLesson = new Set();
  const entry = (w, kind, i) => {
    const where = `${at} ${kind}[${i}] ${w.ko || ''}`;
    if (!w.ko || !hasKo(w.ko)) err(where, 'ko пустое или без хангыля');
    if (!w.ru || !w.ru.trim()) err(where, 'нет перевода ru');
    if (w.ko !== w.ko?.trim() || /\s{2,}/.test(w.ko || '')) err(where, 'лишние пробелы в ko');
    if (inLesson.has(w.ko)) warn(where, 'повтор внутри урока'); inLesson.add(w.ko);
    if (kind === 'words') {
      if (!WORD_C.includes(w.c)) warn(where, `тема «${w.c}» не из списка в CLAUDE.md`);
      if (w.t && !T.includes(w.t)) err(where, `неизвестный тип t: «${w.t}»`);
      if (w.job && w.t) warn(where, 'профессия с флагом t не попадёт в упражнения на 이에요/예요');
    } else if (!w.c) warn(where, 'у фразы нет темы c');
    const prev = seenKo.get(w.ko);
    if (prev && prev.ru !== w.ru) warn(where, `в ${prev.where} перевод «${prev.ru}», здесь «${w.ru}» (в словаре останется первый)`);
    if (!prev) seenKo.set(w.ko, { ru: w.ru, where: at });
  };
  (l.words || []).forEach((w, i) => entry(w, 'words', i));
  (l.phrases || []).forEach((w, i) => entry(w, 'phrases', i));

  (l.grammar || []).forEach((g, i) => {
    const where = `${at} grammar[${i}] ${g.id || ''}`;
    if (!g.id || !g.title) err(where, 'нужны id и title');
    if (g.id && !GRAMMAR.includes(g.id)) warn(where, 'для этого id нет генератора упражнений в app/practice.js');
    if (!Array.isArray(g.body) || !g.body.length) err(where, 'пустой body');
    (g.examples || []).forEach((x, k) => (!x.ko || !x.ru) && err(`${where} examples[${k}]`, 'нужны ko и ru'));
  });

  (l.dialogues || []).forEach((d, i) => {
    const where = `${at} dialogues[${i}] ${d.title || ''}`;
    if (!d.title) err(where, 'нет title');
    if (!Array.isArray(d.lines) || !d.lines.length) { err(where, 'нет реплик'); return; }
    d.lines.forEach((x, k) => {
      if (!x.ko || !x.ru) err(`${where} lines[${k}]`, 'нужны ko и ru');
      // фразы из нескольких предложений делятся для сборки, только если перевод делится так же
      else if (sentences(x.ko).length > 1 && sentences(x.ko).length !== sentences(x.ru).length) warn(`${where} lines[${k}]`, 'в ko и ru разное число предложений: фраза не разобьётся для сборки');
    });
    (d.questions || []).forEach((q, k) => {
      const w = `${where} questions[${k}]`;
      if (!q.q || !q.a || !Array.isArray(q.wrong) || !q.wrong.length) err(w, 'нужны q, a и wrong');
      else {
        if (q.wrong.includes(q.a)) err(w, 'верный ответ есть среди неверных');
        if (new Set(q.wrong).size !== q.wrong.length) err(w, 'повторы среди неверных ответов');
      }
      if (q.at != null && !d.lines[q.at]) err(w, `нет реплики с индексом at=${q.at}`);
    });
  });
}
for (const id of listed) if (!files.includes(id + '.js')) err('data/index.js', `нет файла data/lessons/${id}.js`);

warns.forEach((m) => console.log('предупреждение  ' + m));
errors.forEach((m) => console.log('ОШИБКА  ' + m));
console.log(`\nУроков: ${lessons.length}, ошибок: ${errors.length}, предупреждений: ${warns.length}`);
process.exit(errors.length ? 1 : 0);
