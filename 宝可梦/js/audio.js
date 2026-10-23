/* ============================================================
   芯片音乐：原创循环曲与音效
   ============================================================ */
window.PKM = window.PKM || {};

(function () {
  const PKM = window.PKM;

  const TRACKS = {
    title: {
      bpm: 72, melody: [69, -1, 72, -1, 76, -1, 72, -1, 74, -1, 72, -1, 69, -1, 67, -1, 65, -1, 69, -1, 72, -1, 69, -1, 67, -1, 64, -1, 65, -1, -1, -1],
      chords: [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]],
      wave: 'triangle', leadVol: .10, padVol: .045, drums: 'soft'
    },
    town: {
      bpm: 104, melody: [76, -1, 79, -1, 81, -1, 79, 76, 74, -1, 72, -1, 74, 76, -1, -1, 72, -1, 76, -1, 79, -1, 77, 76, 74, -1, 72, 74, 76, -1, -1, -1],
      chords: [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]],
      wave: 'square', leadVol: .075, padVol: .035, drums: 'soft'
    },
    route: {
      bpm: 132, melody: [79, 81, 83, -1, 83, 81, 79, -1, 76, 79, 81, -1, 83, 81, 79, -1, 74, 76, 79, -1, 81, 79, 76, -1, 74, 71, 74, 76, 79, -1, -1, -1],
      chords: [[43, 47, 50], [50, 54, 57], [52, 55, 59], [48, 52, 55]],
      wave: 'square', leadVol: .075, padVol: .03, drums: 'walk'
    },
    brook: {
      bpm: 112, melody: [77, -1, 81, -1, 84, -1, 81, 77, 76, -1, 74, -1, 72, 74, 76, -1, 77, -1, 81, -1, 84, 86, 84, 81, 79, -1, 77, 76, 74, -1, -1, -1],
      chords: [[41, 45, 48], [50, 53, 57], [46, 50, 53], [48, 52, 55]],
      wave: 'triangle', leadVol: .095, padVol: .04, drums: 'soft'
    },
    forest: {
      bpm: 88, melody: [76, -1, -1, 74, 71, -1, 74, -1, 76, -1, 79, -1, 78, -1, 76, 74, 71, -1, 67, -1, 71, -1, 74, -1, 76, 78, 79, -1, 76, -1, -1, -1],
      chords: [[40, 43, 47], [48, 52, 55], [43, 47, 50], [50, 54, 57]],
      wave: 'triangle', leadVol: .09, padVol: .05, drums: 'soft'
    },
    gym: {
      bpm: 128, melody: [74, 77, 81, -1, 81, 77, 74, -1, 72, 74, 77, -1, 81, 79, 77, -1, 74, 77, 81, 84, 81, 77, 74, -1, 72, 74, 77, 79, 81, -1, -1, -1],
      chords: [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 49, 52]],
      wave: 'square', leadVol: .08, padVol: .03, drums: 'walk'
    },
    battle: {
      bpm: 156, melody: [69, 72, 76, 72, 69, 72, 76, 79, 77, 74, 72, 69, 67, 69, 72, -1, 69, 72, 76, 79, 81, 79, 76, 72, 74, 76, 77, 79, 81, -1, 79, -1],
      chords: [[45, 48, 52], [41, 45, 48], [48, 52, 55], [40, 44, 47]],
      wave: 'square', leadVol: .075, padVol: .028, drums: 'battle'
    },
    ending: {
      bpm: 96, melody: [72, -1, 76, -1, 79, -1, 76, -1, 74, -1, 72, -1, 69, -1, 67, -1, 65, -1, 69, -1, 72, -1, 76, -1, 74, -1, 72, -1, -1, -1, -1, -1],
      chords: [[48, 52, 55], [45, 48, 52], [41, 45, 48], [43, 47, 50]],
      wave: 'triangle', leadVol: .10, padVol: .045, drums: 'soft'
    }
  };

  const midiToFreq = (n) => 440 * Math.pow(2, (n - 69) / 12);

  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.musicGain = null;
      this.sfxGain = null;
      this.noiseBuffer = null;
      this.musicOn = true;
      this.sfxOn = true;
      this.trackName = null;
      this.track = null;
      this.step = 0;
      this.nextTime = 0;
      this.timer = null;
      this.pending = null;
      this.playing = false;
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume();
        return;
      }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = .55;
      this.master.connect(this.ctx.destination);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.musicOn ? .8 : 0;
      this.musicGain.connect(this.master);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.sfxOn ? .9 : 0;
      this.sfxGain.connect(this.master);
      this.noiseBuffer = this.makeNoise();
      if (this.pending) {
        const name = this.pending; this.pending = null;
        this.playMusic(name);
      }
    }

    makeNoise() {
      const len = this.ctx.sampleRate * .5;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      return buf;
    }

    setMusic(on) {
      this.musicOn = on;
      if (this.musicGain) this.musicGain.gain.setTargetAtTime(on ? .8 : 0, this.ctx.currentTime, .04);
    }
    setSfx(on) {
      this.sfxOn = on;
      if (this.sfxGain) this.sfxGain.gain.setTargetAtTime(on ? .9 : 0, this.ctx.currentTime, .04);
    }

    playMusic(name) {
      if (!this.ctx) { this.pending = name; return; }
      if (this.trackName === name && this.playing) return;
      this.trackName = name;
      this.track = TRACKS[name] || TRACKS.town;
      this.step = 0;
      this.nextTime = this.ctx.currentTime + .06;
      this.playing = true;
      if (!this.timer) this.timer = setInterval(() => this.schedule(), 25);
    }

    stopMusic() {
      this.playing = false;
      this.trackName = null;
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    }

    schedule() {
      if (!this.ctx || !this.playing || !this.track) return;
      const lookahead = .12;
      const sixteenth = 60 / this.track.bpm / 4;
      while (this.nextTime < this.ctx.currentTime + lookahead) {
        this.scheduleStep(this.step, this.nextTime);
        this.step++;
        this.nextTime += sixteenth;
      }
    }

    scheduleStep(step, time) {
      const tr = this.track;
      const step16 = step % 16;
      const bar = Math.floor(step / 32) % tr.chords.length;
      const chord = tr.chords[bar];
      // melody (32-step loop)
      const note = tr.melody[step % 32];
      if (note > 0) {
        this.tone(midiToFreq(note), time, 60 / tr.bpm / 4 * 1.65, tr.wave, tr.leadVol, this.musicGain, 1600 + bar * 180);
        // subtle echo one octave up
        this.tone(midiToFreq(note + 12), time + .07, .05, 'sine', tr.leadVol * .22, this.musicGain, 3000);
      }
      // bass
      if (step16 % 8 === 0) {
        this.tone(midiToFreq(chord[0] - 12), time, .16, 'triangle', .10, this.musicGain, 420);
      }
      // pad chord on bar
      if (step % 32 === 0) {
        chord.forEach((n, i) => {
          this.tone(midiToFreq(n + 12), time, 1.35, 'sine', tr.padVol * (i === 0 ? 1 : .6), this.musicGain, 900);
        });
      }
      // arpeggio sparkle
      if (step16 % 4 === 2) {
        const n = chord[(step16 / 4 | 0) % chord.length] + 24;
        this.tone(midiToFreq(n), time, .05, 'triangle', .018, this.musicGain, 4200);
      }
      // drums
      const d = tr.drums;
      if (d !== 'soft') {
        if (step16 === 0 || step16 === 8) this.drum(time, 'kick', d === 'battle' ? .10 : .065);
        if (step16 === 4 || step16 === 12) this.drum(time, 'snare', d === 'battle' ? .06 : .04);
        if (step16 % 2 === 0) this.drum(time, 'hat', .015);
      } else {
        if (step16 === 0) this.drum(time, 'kick', .04);
        if (step16 === 8) this.drum(time, 'hat', .012);
      }
    }

    tone(freq, time, dur, wave, vol, dest, cutoff) {
      if (!this.ctx) return;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      const f = this.ctx.createBiquadFilter();
      o.type = wave;
      o.frequency.setValueAtTime(freq, time);
      f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff || 2200, time);
      g.gain.setValueAtTime(0.0001, time);
      g.gain.exponentialRampToValueAtTime(Math.max(.0002, vol), time + .012);
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      o.connect(f); f.connect(g); g.connect(dest);
      o.start(time); o.stop(time + dur + .02);
    }

    drum(time, kind, vol) {
      if (!this.ctx) return;
      if (kind === 'kick') {
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(130, time);
        o.frequency.exponentialRampToValueAtTime(48, time + .10);
        g.gain.setValueAtTime(vol, time);
        g.gain.exponentialRampToValueAtTime(.0001, time + .12);
        o.connect(g); g.connect(this.musicGain); o.start(time); o.stop(time + .14);
      } else {
        const src = this.ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const f = this.ctx.createBiquadFilter();
        const g = this.ctx.createGain();
        f.type = kind === 'snare' ? 'bandpass' : 'highpass';
        f.frequency.value = kind === 'snare' ? 1600 : 6000;
        g.gain.setValueAtTime(vol, time);
        g.gain.exponentialRampToValueAtTime(.0001, time + (kind === 'snare' ? .11 : .04));
        src.connect(f); f.connect(g); g.connect(this.musicGain);
        src.start(time); src.stop(time + .14);
      }
    }

    /* ---------- 音效 ---------- */
    blip(freq, dur, wave = 'square', vol = .10, slide = 0) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.type = wave; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      o.connect(g); g.connect(this.sfxGain);
      o.start(t); o.stop(t + dur + .02);
    }

    seq(notes, gap = .07, wave = 'square', vol = .09) {
      if (!this.ctx) return;
      const base = this.ctx.currentTime;
      notes.forEach((n, i) => {
        if (n < 0) return;
        const t = base + i * gap;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = wave; o.frequency.setValueAtTime(midiToFreq(n), t);
        g.gain.setValueAtTime(.0001, t);
        g.gain.exponentialRampToValueAtTime(vol, t + .008);
        g.gain.exponentialRampToValueAtTime(.0001, t + gap * .9);
        o.connect(g); g.connect(this.sfxGain);
        o.start(t); o.stop(t + gap);
      });
    }

    noiseHit(dur = .12, vol = .12, freq = 1200) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource(); src.buffer = this.noiseBuffer;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(this.sfxGain);
      src.start(t); src.stop(t + dur);
    }

    sfx(name) {
      if (!this.ctx || !this.sfxOn) return;
      switch (name) {
        case 'move': this.blip(720, .03, 'square', .035); break;
        case 'select': this.blip(880, .06, 'square', .06, 260); break;
        case 'cancel': this.blip(440, .07, 'square', .05, -120); break;
        case 'bump': this.blip(110, .06, 'triangle', .08, -30); break;
        case 'door': this.seq([60, 65, 72], .05, 'triangle', .06); break;
        case 'encounter': this.seq([76, 79, 83, 88], .065, 'square', .075); break;
        case 'hit': this.noiseHit(.10, .10, 900); this.blip(180, .09, 'square', .06, -70); break;
        case 'superhit': this.noiseHit(.16, .13, 1800); this.seq([84, 88], .05, 'square', .06); break;
        case 'weakhit': this.noiseHit(.08, .06, 500); break;
        case 'ball': this.blip(520, .06, 'square', .06, 180); break;
        case 'shake': this.blip(320, .04, 'square', .03); break;
        case 'catch': this.seq([72, 76, 79, 84, 88], .085, 'square', .085); break;
        case 'faint': this.seq([64, 60, 55, 48], .10, 'triangle', .075); break;
        case 'heal': this.seq([76, 79, 84, 88, 91], .075, 'sine', .075); break;
        case 'level': this.seq([72, 76, 79, 84, 88, 91], .07, 'square', .075); break;
        case 'victory': this.seq([72, 74, 76, 79, 84, 88], .11, 'square', .07); break;
        case 'save': this.seq([79, 84, 88], .08, 'sine', .06); break;
        case 'run': this.noiseHit(.05, .03, 500); break;
        case 'sparkle': this.seq([88, 91, 95], .06, 'sine', .045); break;
        case 'open': this.seq([67, 72], .05, 'square', .045); break;
      }
    }
  }

  PKM.AUDIO = new AudioEngine();
})();
