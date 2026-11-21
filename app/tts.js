// Озвучка через встроенный синтез речи браузера (корейский голос).
(function () {
  let voice = null;
  const synth = window.speechSynthesis;
  function pick() {
    if (!synth) return;
    const vs = synth.getVoices().filter((v) => v.lang && v.lang.toLowerCase().startsWith('ko'));
    voice = vs.find((v) => /google|natural|online/i.test(v.name)) || vs[0] || null;
  }
  if (synth) { pick(); synth.onvoiceschanged = pick; }
  let seq = 0, current = null; // номер текущей озвучки (новая останавливает очередь реплик) и кому сообщить об остановке
  const interrupt = () => { seq++; const c = current; current = null; if (c) c(-1); };
  function utter(text, rate) {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice; u.lang = voice.lang;
    u.rate = rate ?? Store.settings().rate;
    return u;
  }

  window.TTS = {
    available: () => !!voice,
    supported: () => !!synth,
    voiceName: () => voice?.name || '',
    speak(text, rate) {
      if (!synth || !voice) return false;
      interrupt(); synth.cancel();
      synth.speak(utter(text, rate));
      return true;
    },
    // Реплики по очереди с паузой; onLine(i) — какая звучит, onLine(-1) — закончили или остановили
    speakAll(texts, onLine) {
      if (!synth || !voice) return false;
      interrupt(); const my = ++seq; let i = 0; current = onLine;
      const next = () => {
        if (my !== seq) return;
        if (i >= texts.length) { current = null; onLine(-1); return; }
        onLine(i);
        const u = utter(texts[i++]);
        u.onend = () => setTimeout(next, 450);
        u.onerror = () => { if (my === seq) { current = null; onLine(-1); } };
        synth.speak(u);
      };
      synth.cancel(); next();
      return true;
    },
    stop() { interrupt(); synth?.cancel(); },
  };
})();
