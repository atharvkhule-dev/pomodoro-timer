/* ==========================================================================
   ZenTime — Core Logic and Audio Synthesis
   ========================================================================== */

document.addEventListener('DOMContentLoaded', () => {
  
  // ========================== State & Variables ==========================
  let timerInterval = null;
  let timeLeft = 1500; // 25 minutes default
  let totalTime = 1500;
  let timerState = 'idle'; // idle, running, paused
  let activeMode = 'focus'; // focus, short, long
  let activeTaskId = null;
  
  // Custom Settings (defaults)
  let settings = {
    focusDuration: 25,
    shortDuration: 5,
    longDuration: 15,
    autoStartBreaks: false,
    autoStartFocus: false,
    soundVolume: 60
  };
  
  // Daily Statistics
  let stats = {
    pomodoros: 0,
    minutes: 0,
    tasks: 0,
    date: new Date().toDateString()
  };
  
  // Tasks Database
  let tasks = [];

  // Focus Quotes
  const quotes = [
    { text: "Quiet the mind and the soul will speak.", author: "Ma Jaya Sati Bhagavati" },
    { text: "Focus is a muscle, and you build it through exercise.", author: "Daniel Goleman" },
    { text: "Within you, there is a stillness and a sanctuary to which you can retreat at any time.", author: "Hermann Hesse" },
    { text: "One half of knowing what you want is knowing what you must must do before you get it.", author: "Sidonie Gabrielle Colette" },
    { text: "Slow down and everything you are chasing will come around and catch you.", author: "John De Paola" },
    { text: "Deep breaths are like little love notes to your body.", author: "Unknown" },
    { text: "The present moment is filled with joy and happiness. If you are attentive, you will see it.", author: "Thich Nhat Hanh" }
  ];

  // ========================== DOM Elements ==========================
  const bodyElement = document.body;
  const timerNumbers = document.getElementById('timer-numbers');
  const timerStateLabel = document.getElementById('timer-state-label');
  const progressBar = document.getElementById('progress-bar');
  const timerSection = document.querySelector('.timer-section');
  
  const playBtn = document.getElementById('timer-play-btn');
  const playIcon = playBtn.querySelector('.play-icon');
  const pauseIcon = playBtn.querySelector('.pause-icon');
  const resetBtn = document.getElementById('timer-reset-btn');
  const skipBtn = document.getElementById('timer-skip-btn');
  
  const tabFocus = document.getElementById('tab-focus');
  const tabShort = document.getElementById('tab-short');
  const tabLong = document.getElementById('tab-long');
  const timerTabs = [tabFocus, tabShort, tabLong];
  
  const quoteText = document.querySelector('.quote-text');
  const quoteAuthor = document.querySelector('.quote-author');
  
  const themeSelectorBtn = document.getElementById('theme-selector-btn');
  const themeDropdown = document.getElementById('theme-dropdown');
  const modeToggleBtn = document.getElementById('mode-toggle-btn');
  
  const settingsDialog = document.getElementById('settings-dialog');
  const settingsOpenBtn = document.getElementById('settings-open-btn');
  const settingsCloseBtnX = document.getElementById('settings-close-btn-x');
  const settingsForm = document.getElementById('settings-form');
  const settingsResetDefaults = document.getElementById('settings-reset-defaults');
  
  const soundRainItem = document.getElementById('sound-rain');
  const soundWindItem = document.getElementById('sound-wind');
  const soundNoiseItem = document.getElementById('sound-noise');
  
  const newTaskTitleInput = document.getElementById('new-task-title');
  const taskInputForm = document.getElementById('task-input-form');
  const taskListElement = document.getElementById('task-list-element');
  const activeTaskTitle = document.getElementById('active-task-title');
  const activeTaskBanner = document.getElementById('active-task-banner');
  
  const filterAll = document.getElementById('filter-all');
  const filterActive = document.getElementById('filter-active');
  const filterDone = document.getElementById('filter-done');
  
  const statsPomodoros = document.getElementById('stats-pomodoros');
  const statsMinutes = document.getElementById('stats-minutes');
  const statsTasks = document.getElementById('stats-tasks');
  const statsResetBtn = document.getElementById('stats-reset-btn');

  // ========================== Audio Synthesizer ==========================
  let audioCtx = null;
  let ambientRainNode = null;
  let ambientWindNode = null;
  let ambientNoiseNode = null;
  
  const ambientStates = {
    rain: { playing: false, volume: 40, node: null, gainNode: null },
    wind: { playing: false, volume: 30, node: null, gainNode: null },
    noise: { playing: false, volume: 25, node: null, gainNode: null }
  };

  function initAudioContext() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  /* Alarm synthesizers */
  function playGongChime() {
    initAudioContext();
    const now = audioCtx.currentTime;
    const destVol = settings.soundVolume / 100;
    
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(destVol * 0.8, now + 0.08);
    masterGain.gain.exponentialRampToValueAtTime(0.0001, now + 5.0);
    
    // Fundamental Zen Gong Hum (roughly F2 at ~87Hz with some harmonics)
    const baseFreq = 87.3;
    const harmonics = [1, 1.5, 2.5, 3.2, 4.1];
    const oscillators = [];

    harmonics.forEach((mult, index) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * mult, now);
      
      // Detune slightly for lush thickness
      if (index > 0) osc.detune.setValueAtTime((Math.random() - 0.5) * 15, now);
      
      // Decay individual overtones differently (higher frequencies decay faster)
      const relativeVolume = (1.0 / mult) * (index === 0 ? 1 : 0.4);
      gain.gain.setValueAtTime(relativeVolume, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 5.0 / (mult * 0.6));
      
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(now);
      osc.stop(now + 6.0);
      oscillators.push(osc);
    });

    // Gentle vibrato
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.frequency.setValueAtTime(4.2, now); // beating frequency
    lfoGain.gain.setValueAtTime(0.08, now); // vibrato depth
    lfo.connect(lfoGain);
    
    const volumeModNode = audioCtx.createGain();
    lfoGain.connect(volumeModNode.gain);
    
    masterGain.connect(volumeModNode);
    
    // Warm low-pass filter
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, now);
    
    volumeModNode.connect(filter);
    filter.connect(audioCtx.destination);
    
    lfo.start(now);
    lfo.stop(now + 6.0);
  }

  function playCrystalChime() {
    initAudioContext();
    const now = audioCtx.currentTime;
    const destVol = settings.soundVolume / 100;
    
    // Chime 1 (High Crystal)
    const osc1 = audioCtx.createOscillator();
    const gain1 = audioCtx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(987.77, now); // B5
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(destVol * 0.5, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
    
    // Chime 2 (High E, delayed)
    const osc2 = audioCtx.createOscillator();
    const gain2 = audioCtx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1318.51, now + 0.15); // E6
    gain2.gain.setValueAtTime(0, now + 0.15);
    gain2.gain.linearRampToValueAtTime(destVol * 0.4, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);

    osc1.connect(gain1);
    gain1.connect(audioCtx.destination);
    osc2.connect(gain2);
    gain2.connect(audioCtx.destination);

    osc1.start(now);
    osc2.start(now + 0.15);
    
    osc1.stop(now + 2.5);
    osc2.stop(now + 2.8);
  }

  function playSoftClick() {
    initAudioContext();
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.04);
    
    gainNode.gain.setValueAtTime(settings.soundVolume / 100 * 0.15, now);
    gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    
    osc.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    
    osc.start(now);
    osc.stop(now + 0.05);
  }

  /* Audio Noise Buffer Generators */
  function getPinkNoiseBuffer() {
    const bufferSize = audioCtx.sampleRate * 4; // 4 seconds loop
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    
    let b0, b1, b2, b3, b4, b5, b6;
    b0 = b1 = b2 = b3 = b4 = b5 = b6 = 0.0;
    
    for (let i = 0; i < bufferSize; i++) {
      let white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      let pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = pink * 0.11; 
    }
    return buffer;
  }

  function getBrownNoiseBuffer() {
    const bufferSize = audioCtx.sampleRate * 4; // 4 seconds loop
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    
    for (let i = 0; i < bufferSize; i++) {
      let white = Math.random() * 2 - 1;
      data[i] = (lastOut + (0.02 * white)) / 1.02;
      lastOut = data[i];
      data[i] *= 3.5; // Scale to decent level
    }
    return buffer;
  }

  /* Ambient synthesizers play / pause / volume */
  function startAmbientRain() {
    const now = audioCtx.currentTime;
    
    // Ambient Rain uses Pink/Brown noise + low-pass filter + slow amplitude sweep
    const sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = getBrownNoiseBuffer();
    sourceNode.loop = true;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(800, now);
    
    const rainGain = audioCtx.createGain();
    const targetVal = (ambientStates.rain.volume / 100) * 0.55;
    rainGain.gain.setValueAtTime(0, now);
    rainGain.gain.linearRampToValueAtTime(targetVal, now + 1.5);
    
    // Rain dynamics amplitude modulator
    const modulator = audioCtx.createGain();
    const lfo = audioCtx.createOscillator();
    const lfoGain = audioCtx.createGain();
    lfo.frequency.setValueAtTime(0.12, now); // slow rain surge (8 seconds per wave)
    lfoGain.gain.setValueAtTime(0.2, now); // modify amplitude by +/- 20%
    lfo.connect(lfoGain);
    lfoGain.connect(modulator.gain);
    
    sourceNode.connect(filter);
    filter.connect(modulator);
    modulator.connect(rainGain);
    rainGain.connect(audioCtx.destination);
    
    lfo.start(now);
    sourceNode.start(now);
    
    ambientStates.rain.node = sourceNode;
    ambientStates.rain.gainNode = rainGain;
    ambientStates.rain.lfo = lfo;
  }

  function stopAmbientRain() {
    const now = audioCtx.currentTime;
    if (ambientStates.rain.gainNode) {
      const currentGain = ambientStates.rain.gainNode.gain.value;
      ambientStates.rain.gainNode.gain.cancelScheduledValues(now);
      ambientStates.rain.gainNode.gain.setValueAtTime(currentGain, now);
      ambientStates.rain.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    }
    setTimeout(() => {
      try {
        if (ambientStates.rain.node) ambientStates.rain.node.stop();
        if (ambientStates.rain.lfo) ambientStates.rain.lfo.stop();
      } catch (e) {}
      ambientStates.rain.node = null;
      ambientStates.rain.gainNode = null;
      ambientStates.rain.lfo = null;
    }, 1300);
  }

  function startAmbientWind() {
    const now = audioCtx.currentTime;
    
    // Ambient Wind uses Pink Noise + swept Bandpass filter
    const sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = getPinkNoiseBuffer();
    sourceNode.loop = true;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.setValueAtTime(3.2, now);
    filter.frequency.setValueAtTime(450, now);
    
    // LFO sweeps the bandpass filter frequency back and forth
    const sweepLFO = audioCtx.createOscillator();
    sweepLFO.frequency.setValueAtTime(0.06, now); // wind cycle (16 seconds)
    
    const sweepGain = audioCtx.createGain();
    sweepGain.gain.setValueAtTime(180, now); // +/- 180Hz sweep
    
    sweepLFO.connect(sweepGain);
    sweepGain.connect(filter.frequency);
    
    const windGain = audioCtx.createGain();
    const targetVal = (ambientStates.wind.volume / 100) * 0.4;
    windGain.gain.setValueAtTime(0, now);
    windGain.gain.linearRampToValueAtTime(targetVal, now + 2.0);
    
    sourceNode.connect(filter);
    filter.connect(windGain);
    windGain.connect(audioCtx.destination);
    
    sweepLFO.start(now);
    sourceNode.start(now);
    
    ambientStates.wind.node = sourceNode;
    ambientStates.wind.gainNode = windGain;
    ambientStates.wind.lfo = sweepLFO;
  }

  function stopAmbientWind() {
    const now = audioCtx.currentTime;
    if (ambientStates.wind.gainNode) {
      const currentGain = ambientStates.wind.gainNode.gain.value;
      ambientStates.wind.gainNode.gain.cancelScheduledValues(now);
      ambientStates.wind.gainNode.gain.setValueAtTime(currentGain, now);
      ambientStates.wind.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    }
    setTimeout(() => {
      try {
        if (ambientStates.wind.node) ambientStates.wind.node.stop();
        if (ambientStates.wind.lfo) ambientStates.wind.lfo.stop();
      } catch (e) {}
      ambientStates.wind.node = null;
      ambientStates.wind.gainNode = null;
      ambientStates.wind.lfo = null;
    }, 1600);
  }

  function startAmbientNoise() {
    const now = audioCtx.currentTime;
    
    // Deep Focus Brown noise + low pass filter at ~120Hz
    const sourceNode = audioCtx.createBufferSource();
    sourceNode.buffer = getBrownNoiseBuffer();
    sourceNode.loop = true;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(140, now);
    
    const noiseGain = audioCtx.createGain();
    const targetVal = (ambientStates.noise.volume / 100) * 0.65;
    noiseGain.gain.setValueAtTime(0, now);
    noiseGain.gain.linearRampToValueAtTime(targetVal, now + 1.0);
    
    sourceNode.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    
    sourceNode.start(now);
    
    ambientStates.noise.node = sourceNode;
    ambientStates.noise.gainNode = noiseGain;
  }

  function stopAmbientNoise() {
    const now = audioCtx.currentTime;
    if (ambientStates.noise.gainNode) {
      const currentGain = ambientStates.noise.gainNode.gain.value;
      ambientStates.noise.gainNode.gain.cancelScheduledValues(now);
      ambientStates.noise.gainNode.gain.setValueAtTime(currentGain, now);
      ambientStates.noise.gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);
    }
    setTimeout(() => {
      try {
        if (ambientStates.noise.node) ambientStates.noise.node.stop();
      } catch (e) {}
      ambientStates.noise.node = null;
      ambientStates.noise.gainNode = null;
    }, 1100);
  }

  function toggleSound(type) {
    initAudioContext();
    const state = ambientStates[type];
    state.playing = !state.playing;
    
    const itemEl = document.getElementById(`sound-${type}`);
    const toggleBtn = itemEl.querySelector('.sound-toggle-btn');
    const playIcon = toggleBtn.querySelector('.icon-play');
    const muteIcon = toggleBtn.querySelector('.icon-mute');
    
    if (state.playing) {
      itemEl.classList.add('active');
      playIcon.classList.add('hidden');
      muteIcon.classList.remove('hidden');
      
      if (type === 'rain') startAmbientRain();
      if (type === 'wind') startAmbientWind();
      if (type === 'noise') startAmbientNoise();
    } else {
      itemEl.classList.remove('active');
      playIcon.classList.remove('hidden');
      muteIcon.classList.add('hidden');
      
      if (type === 'rain') stopAmbientRain();
      if (type === 'wind') stopAmbientWind();
      if (type === 'noise') stopAmbientNoise();
    }
  }

  function updateAmbientVolume(type, val) {
    ambientStates[type].volume = val;
    if (ambientStates[type].playing && ambientStates[type].gainNode && audioCtx) {
      const now = audioCtx.currentTime;
      let multiplier = 0.5;
      if (type === 'wind') multiplier = 0.4;
      if (type === 'noise') multiplier = 0.65;
      
      ambientStates[type].gainNode.gain.linearRampToValueAtTime((val / 100) * multiplier, now + 0.1);
    }
  }

  // ========================== Quotes Module ==========================
  function updateQuote() {
    const randomIndex = Math.floor(Math.random() * quotes.length);
    const selectedQuote = quotes[randomIndex];
    
    quoteText.style.opacity = 0;
    quoteAuthor.style.opacity = 0;
    
    setTimeout(() => {
      quoteText.textContent = `"${selectedQuote.text}"`;
      quoteAuthor.textContent = selectedQuote.author;
      quoteText.style.opacity = 1;
      quoteAuthor.style.opacity = 1;
    }, 400);
  }

  // Set initial quote
  updateQuote();
  // Rotate quote every 5 minutes
  setInterval(updateQuote, 300000);

  // ========================== Themes & Modes ==========================
  themeSelectorBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    themeDropdown.classList.toggle('show');
  });

  document.addEventListener('click', () => {
    themeDropdown.classList.remove('show');
  });

  const themeOpts = document.querySelectorAll('.theme-opt');
  themeOpts.forEach(btn => {
    btn.addEventListener('click', () => {
      const themeVal = btn.dataset.themeVal;
      document.documentElement.setAttribute('data-theme', themeVal);
      localStorage.setItem('zen-theme', themeVal);
      playSoftClick();
    });
  });

  modeToggleBtn.addEventListener('click', () => {
    const isDark = document.documentElement.classList.toggle('dark-mode');
    localStorage.setItem('zen-mode', isDark ? 'dark' : 'light');
    playSoftClick();
  });

  // Handle system color scheme adjustments
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const savedMode = localStorage.getItem('zen-mode') || 'system';
    if (savedMode === 'system') {
      if (e.matches) {
        document.documentElement.classList.add('dark-mode');
      } else {
        document.documentElement.classList.remove('dark-mode');
      }
    }
  });

  // ========================== Timer Module ==========================
  function getTimerDuration(mode) {
    if (mode === 'focus') return settings.focusDuration * 60;
    if (mode === 'short') return settings.shortDuration * 60;
    if (mode === 'long') return settings.longDuration * 60;
    return 1500;
  }

  function setTimerMode(mode) {
    if (timerState === 'running') {
      if (!confirm('Switching modes will reset the active timer. Continue?')) {
        return;
      }
    }
    
    stopTimer();
    activeMode = mode;
    
    // Toggle active state on tabs
    timerTabs.forEach(tab => {
      if (tab.dataset.mode === mode) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    timeLeft = getTimerDuration(mode);
    totalTime = timeLeft;
    
    // Label
    if (mode === 'focus') {
      timerStateLabel.textContent = 'BREATHE & FOCUS';
    } else if (mode === 'short') {
      timerStateLabel.textContent = 'MINDFUL RESET';
    } else {
      timerStateLabel.textContent = 'DEEP REJUVENATION';
    }
    
    updateTimerDisplay();
  }

  function updateTimerDisplay() {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    
    timerNumbers.textContent = formattedTime;
    
    // Update SVG stroke-dashoffset: 
    // Max stroke-dasharray = 628.3
    const progress = totalTime > 0 ? (timeLeft / totalTime) : 0;
    const strokeOffset = 628.3 * (1 - progress);
    progressBar.style.strokeDashoffset = strokeOffset;
    
    // Document Title status
    const labelChar = activeMode === 'focus' ? '⏳' : '🍃';
    document.title = `${formattedTime} ${labelChar} ZenTime`;
  }

  function startTimer() {
    initAudioContext();
    timerState = 'running';
    timerSection.classList.add('breathing');
    
    playIcon.classList.add('hidden');
    pauseIcon.classList.remove('hidden');
    
    playSoftClick();
    
    timerInterval = setInterval(() => {
      timeLeft--;
      
      if (timeLeft <= 0) {
        timerFinished();
      } else {
        updateTimerDisplay();
      }
    }, 1000);
  }

  function pauseTimer() {
    timerState = 'paused';
    timerSection.classList.remove('breathing');
    
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    
    playSoftClick();
    clearInterval(timerInterval);
  }

  function stopTimer() {
    timerState = 'idle';
    timerSection.classList.remove('breathing');
    
    playIcon.classList.remove('hidden');
    pauseIcon.classList.add('hidden');
    
    clearInterval(timerInterval);
    timerInterval = null;
  }

  function skipTimer() {
    playSoftClick();
    
    let nextMode = 'focus';
    if (activeMode === 'focus') {
      // Alternate between short break and long break based on streak (every 4th)
      const nextIsLong = (stats.pomodoros + 1) % 4 === 0;
      nextMode = nextIsLong ? 'long' : 'short';
    }
    
    setTimerMode(nextMode);
  }

  function resetTimer() {
    playSoftClick();
    stopTimer();
    timeLeft = getTimerDuration(activeMode);
    updateTimerDisplay();
  }

  function timerFinished() {
    stopTimer();
    
    // Logic for finished round
    if (activeMode === 'focus') {
      playGongChime();
      
      // Update statistics
      stats.pomodoros++;
      stats.minutes += settings.focusDuration;
      
      // If there is an active focus task, increase its focus count or leave it
      if (activeTaskId) {
        const task = tasks.find(t => t.id === activeTaskId);
        if (task) {
          task.focusCount = (task.focusCount || 0) + 1;
          saveTasks();
          renderTasks();
        }
      }
      
      saveStats();
      updateStatsUI();
      
      // Transition mode
      const nextIsLong = stats.pomodoros % 4 === 0;
      const nextMode = nextIsLong ? 'long' : 'short';
      
      setTimeout(() => {
        setTimerMode(nextMode);
        if (settings.autoStartBreaks) {
          startTimer();
        }
      }, 1000);
      
    } else {
      // Break end
      playCrystalChime();
      
      setTimeout(() => {
        setTimerMode('focus');
        if (settings.autoStartFocus) {
          startTimer();
        }
      }, 1000);
    }
  }

  // Timer controls event bindings
  playBtn.addEventListener('click', () => {
    if (timerState === 'running') {
      pauseTimer();
    } else {
      startTimer();
    }
  });

  resetBtn.addEventListener('click', resetTimer);
  skipBtn.addEventListener('click', skipTimer);

  timerTabs.forEach(tab => {
    tab.addEventListener('click', () => {
      setTimerMode(tab.dataset.mode);
    });
  });

  // ========================== Settings Module ==========================
  settingsOpenBtn.addEventListener('click', () => {
    playSoftClick();
    
    // Hydrate form values
    document.getElementById('input-focus-duration').value = settings.focusDuration;
    document.getElementById('input-short-duration').value = settings.shortDuration;
    document.getElementById('input-long-duration').value = settings.longDuration;
    document.getElementById('input-auto-breaks').checked = settings.autoStartBreaks;
    document.getElementById('input-auto-focus').checked = settings.autoStartFocus;
    document.getElementById('input-sound-volume').value = settings.soundVolume;
    
    settingsDialog.showModal();
  });

  settingsCloseBtnX.addEventListener('click', () => {
    playSoftClick();
    settingsDialog.close();
  });

  settingsResetDefaults.addEventListener('click', () => {
    playSoftClick();
    document.getElementById('input-focus-duration').value = 25;
    document.getElementById('input-short-duration').value = 5;
    document.getElementById('input-long-duration').value = 15;
    document.getElementById('input-auto-breaks').checked = false;
    document.getElementById('input-auto-focus').checked = false;
    document.getElementById('input-sound-volume').value = 60;
  });

  settingsForm.addEventListener('submit', (e) => {
    // Form default submission is closed since method="dialog"
    settings.focusDuration = parseInt(document.getElementById('input-focus-duration').value, 10);
    settings.shortDuration = parseInt(document.getElementById('input-short-duration').value, 10);
    settings.longDuration = parseInt(document.getElementById('input-long-duration').value, 10);
    settings.autoStartBreaks = document.getElementById('input-auto-breaks').checked;
    settings.autoStartFocus = document.getElementById('input-auto-focus').checked;
    settings.soundVolume = parseInt(document.getElementById('input-sound-volume').value, 10);
    
    // Save configurations
    localStorage.setItem('zen-settings', JSON.stringify(settings));
    
    // Refresh timer display based on settings if idle
    if (timerState === 'idle') {
      timeLeft = getTimerDuration(activeMode);
      totalTime = timeLeft;
      updateTimerDisplay();
    }
    
    playSoftClick();
  });

  // Sound listeners
  soundRainItem.querySelector('.sound-toggle-btn').addEventListener('click', () => toggleSound('rain'));
  soundWindItem.querySelector('.sound-toggle-btn').addEventListener('click', () => toggleSound('wind'));
  soundNoiseItem.querySelector('.sound-toggle-btn').addEventListener('click', () => toggleSound('noise'));

  soundRainItem.querySelector('.sound-volume').addEventListener('input', (e) => updateAmbientVolume('rain', parseInt(e.target.value, 10)));
  soundWindItem.querySelector('.sound-volume').addEventListener('input', (e) => updateAmbientVolume('wind', parseInt(e.target.value, 10)));
  soundNoiseItem.querySelector('.sound-volume').addEventListener('input', (e) => updateAmbientVolume('noise', parseInt(e.target.value, 10)));

  // ========================== Tasks Module ==========================
  let activeFilter = 'all';

  function renderTasks() {
    taskListElement.innerHTML = '';
    
    const filteredTasks = tasks.filter(task => {
      if (activeFilter === 'active') return !task.completed;
      if (activeFilter === 'done') return task.completed;
      return true;
    });

    if (filteredTasks.length === 0) {
      taskListElement.innerHTML = `<li class="task-empty">No tasks in this category</li>`;
      // Center styling for empty items
      taskListElement.querySelector('.task-empty').style.cssText = `
        text-align: center;
        padding: 20px;
        font-size: 0.8rem;
        color: var(--color-text-muted);
        font-style: italic;
      `;
      return;
    }

    filteredTasks.forEach(task => {
      const taskItem = document.createElement('li');
      taskItem.className = `task-item ${task.completed ? 'completed' : ''} ${task.id === activeTaskId ? 'focused-item' : ''}`;
      
      const checkIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
      
      const countBadge = task.focusCount && task.focusCount > 0 
        ? `<span class="task-focus-badge" title="Focus sessions completed for this task" style="font-size: 0.65rem; background: rgba(var(--color-primary-rgb), 0.1); padding: 2px 6px; border-radius: 4px; margin-left: 8px; color: var(--color-primary); font-weight: 600;">🍅 ${task.focusCount}</span>` 
        : '';
        
      taskItem.innerHTML = `
        <div class="task-item-content">
          <div class="task-checkbox-container" aria-label="Toggle task completed">
            ${checkIcon}
          </div>
          <span class="task-title" title="${task.title}">${task.title}</span>
          ${countBadge}
        </div>
        <div class="task-actions">
          <button class="task-action-btn focus-task-btn" title="Focus on this task" aria-label="Focus on this task">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <circle cx="12" cy="12" r="3"></circle>
            </svg>
          </button>
          <button class="task-action-btn delete-btn" title="Delete task" aria-label="Delete task">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              <line x1="10" y1="11" x2="10" y2="17"></line>
              <line x1="14" y1="11" x2="14" y2="17"></line>
            </svg>
          </button>
        </div>
      `;

      // Event: Toggle check box
      const checkbox = taskItem.querySelector('.task-checkbox-container');
      checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        playSoftClick();
        toggleTaskComplete(task.id);
      });

      // Event: Select task to focus
      const contentSection = taskItem.querySelector('.task-item-content');
      contentSection.addEventListener('click', () => {
        selectFocusTask(task.id);
      });
      
      const focusBtn = taskItem.querySelector('.focus-task-btn');
      focusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectFocusTask(task.id);
      });

      // Event: Delete task
      const deleteBtn = taskItem.querySelector('.delete-btn');
      deleteBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        playSoftClick();
        deleteTask(task.id);
      });

      taskListElement.appendChild(taskItem);
    });
  }

  function addNewTask(title) {
    const newTask = {
      id: Date.now().toString(),
      title: title,
      completed: false,
      focusCount: 0
    };
    
    tasks.push(newTask);
    saveTasks();
    renderTasks();
    
    // Auto focus if it's the first task
    if (tasks.length === 1 || !activeTaskId) {
      selectFocusTask(newTask.id);
    }
  }

  function toggleTaskComplete(id) {
    const task = tasks.find(t => t.id === id);
    if (task) {
      task.completed = !task.completed;
      
      // Update statistics
      if (task.completed) {
        stats.tasks++;
      } else {
        stats.tasks = Math.max(0, stats.tasks - 1);
      }
      
      // If completed task was active focus task, clear it
      if (task.completed && activeTaskId === id) {
        clearFocusTask();
      }
      
      saveStats();
      updateStatsUI();
      saveTasks();
      renderTasks();
    }
  }

  function selectFocusTask(id) {
    playSoftClick();
    const task = tasks.find(t => t.id === id);
    if (task) {
      if (task.completed) return; // Don't focus completed tasks
      
      activeTaskId = id;
      activeTaskTitle.textContent = `Focusing on: ${task.title}`;
      activeTaskBanner.style.background = 'rgba(var(--color-primary-rgb), 0.1)';
      activeTaskBanner.style.borderColor = 'rgba(var(--color-primary-rgb), 0.2)';
      
      renderTasks();
    }
  }

  function clearFocusTask() {
    activeTaskId = null;
    activeTaskTitle.textContent = 'No task selected for focus';
    activeTaskBanner.style.background = 'rgba(var(--color-primary-rgb), 0.05)';
    activeTaskBanner.style.borderColor = 'rgba(var(--color-primary-rgb), 0.05)';
    renderTasks();
  }

  function deleteTask(id) {
    const taskIndex = tasks.findIndex(t => t.id === id);
    if (taskIndex > -1) {
      const deletedTask = tasks[taskIndex];
      tasks.splice(taskIndex, 1);
      
      if (activeTaskId === id) {
        clearFocusTask();
      }
      
      saveTasks();
      renderTasks();
    }
  }

  function saveTasks() {
    localStorage.setItem('zen-tasks', JSON.stringify(tasks));
  }

  // Filter bindings
  const filters = [
    { btn: filterAll, type: 'all' },
    { btn: filterActive, type: 'active' },
    { btn: filterDone, type: 'done' }
  ];

  filters.forEach(f => {
    f.btn.addEventListener('click', () => {
      playSoftClick();
      filters.forEach(x => x.btn.classList.remove('active'));
      f.btn.classList.add('active');
      activeFilter = f.type;
      renderTasks();
    });
  });

  taskInputForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const title = newTaskTitleInput.value.trim();
    if (title) {
      addNewTask(title);
      newTaskTitleInput.value = '';
    }
  });

  // ========================== Statistics persistence ==========================
  function saveStats() {
    localStorage.setItem('zen-stats', JSON.stringify(stats));
  }

  function updateStatsUI() {
    statsPomodoros.textContent = stats.pomodoros;
    statsMinutes.textContent = stats.minutes;
    statsTasks.textContent = stats.tasks;
  }

  function resetDailyStats() {
    if (confirm('Are you sure you want to clear your daily metrics?')) {
      playSoftClick();
      stats.pomodoros = 0;
      stats.minutes = 0;
      stats.tasks = 0;
      saveStats();
      updateStatsUI();
    }
  }

  statsResetBtn.addEventListener('click', resetDailyStats);

  // ========================== Initial Hydration ==========================
  function hydrateApp() {
    // 1. Settings load
    const savedSettings = localStorage.getItem('zen-settings');
    if (savedSettings) {
      settings = JSON.parse(savedSettings);
    }
    
    // 2. Load Stats
    const savedStats = localStorage.getItem('zen-stats');
    if (savedStats) {
      const tempStats = JSON.parse(savedStats);
      // Only retain stats if they are from today, otherwise reset but keep track (or simple reset since it's "daily")
      if (tempStats.date === new Date().toDateString()) {
        stats = tempStats;
      } else {
        stats.date = new Date().toDateString();
        saveStats();
      }
    }
    updateStatsUI();
    
    // 3. Load Tasks
    const savedTasks = localStorage.getItem('zen-tasks');
    if (savedTasks) {
      tasks = JSON.parse(savedTasks);
      renderTasks();
    }
    
    // 4. Init timer
    timeLeft = getTimerDuration('focus');
    totalTime = timeLeft;
    updateTimerDisplay();
  }

  hydrateApp();

});
