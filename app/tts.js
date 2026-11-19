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

  window.TTS = {
    available: () => !!voice,
    supported: () => !!synth,
    voiceName: () => voice?.name || '',
    speak(text, rate) {
      if (!synth || !voice) return false;
      synth.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.voice = voice; u.lang = voice.lang;
      u.rate = rate ?? Store.settings().rate;
      synth.speak(u);
      return true;
    },
  };
})();
