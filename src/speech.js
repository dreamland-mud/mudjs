let currentRecognition = null;

export function setupSpeechRecognition({
  lang = 'en-US',
  onResult,
  onError,
  buttonSelector,
}) {
  const isSupported =
    'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;

  if (!isSupported) {
    console.warn('Speech recognition not supported.');
    if (buttonSelector) {
      document.querySelector(buttonSelector)?.setAttribute('disabled', true);
    }
    return null;
  }

  // Завершаем старую сессию
  if (currentRecognition) {
    currentRecognition.abort();
    currentRecognition = null;
  }

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognition = new SpeechRecognition();
  currentRecognition = recognition;

  recognition.lang = lang;
  recognition.continuous = false;
  recognition.interimResults = false;

  recognition.onresult = event => {
    const transcript = event.results[0][0].transcript;
    onResult?.(transcript);
  };

  recognition.onerror = event => {
    console.error('Speech recognition error:', event.error);
    onError?.(event);
    toggleVoiceButtonClass(false);
  };

  recognition.onstart = () => {
    console.log('Speech input started');
    toggleVoiceButtonClass(true);
    playBeep(600); // старт
  };

  recognition.onend = () => {
    console.log('Speech input ended');
    toggleVoiceButtonClass(false);
    playBeep(800); // конец
  };

  const toggleVoiceButtonClass = state => {
    const btn = document.querySelector(buttonSelector);
    if (btn) btn.classList.toggle('mic-on', state);
  };

  if (buttonSelector) {
    const button = document.querySelector(buttonSelector);
    if (button) {
      // Удаляем старый обработчик
      const clone = button.cloneNode(true);
      button.parentNode.replaceChild(clone, button);

      clone.addEventListener('click', () => {
        try {
          recognition.start();
        } catch (err) {
          console.warn('Recognition start failed:', err.message);
        }
      });
    }
  }

  return recognition;
}

function playBeep(frequency = 800, duration = 150) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  const oscillator = ctx.createOscillator();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequency, ctx.currentTime);
  oscillator.connect(ctx.destination);
  oscillator.start();
  oscillator.stop(ctx.currentTime + duration / 1000);
}
