/* Rogue Bastion - synthesized sound effects (Web Audio API, no audio files).
   Node-safe: without AudioContext every call is a no-op (testable). */
(function (global) {
  'use strict';

  var KEY = 'rogue-bastion-sound-v1';
  var ctx = null;
  var master = null;
  var enabled = true;
  try {
    var v = global.localStorage && global.localStorage.getItem(KEY);
    if (v === 'off') enabled = false;
  } catch (e) { /* private mode */ }

  function ensureCtx() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    }
    var AC = global.AudioContext || global.webkitAudioContext;
    if (!AC) return null;
    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.45;
      master.connect(ctx.destination);
    } catch (e) { ctx = null; }
    return ctx;
  }

  function tone(opts) {
    if (!enabled || !ensureCtx()) return;
    var t0 = ctx.currentTime + (opts.delay || 0);
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = opts.type || 'square';
    o.frequency.setValueAtTime(opts.f0, t0);
    if (opts.f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, opts.f1), t0 + opts.dur);
    g.gain.setValueAtTime(opts.vol || 0.5, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + opts.dur);
    o.connect(g); g.connect(master);
    o.start(t0); o.stop(t0 + opts.dur + 0.02);
  }

  function noise(opts) {
    if (!enabled || !ensureCtx()) return;
    var t0 = ctx.currentTime + (opts.delay || 0);
    var len = Math.floor(ctx.sampleRate * opts.dur);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(opts.cutoff || 1200, t0);
    f.frequency.exponentialRampToValueAtTime(120, t0 + opts.dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(opts.vol || 0.6, t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + opts.dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
  }

  var SFX = {
    fire: function () { tone({ f0: 720, f1: 180, dur: 0.09, vol: 0.35 }); },
    enemyFire: function () { tone({ f0: 320, f1: 140, dur: 0.07, vol: 0.16 }); },
    hit: function () { tone({ f0: 1400, f1: 900, dur: 0.04, vol: 0.2, type: 'square' }); },
    explosion: function (big) {
      noise({ dur: big ? 0.45 : 0.28, vol: big ? 0.8 : 0.5, cutoff: big ? 900 : 1400 });
      tone({ f0: 150, f1: 38, dur: big ? 0.4 : 0.25, vol: 0.55, type: 'sine' });
    },
    pickup: function () {
      tone({ f0: 660, dur: 0.09, vol: 0.35, type: 'sine' });
      tone({ f0: 880, dur: 0.14, vol: 0.35, type: 'sine', delay: 0.08 });
    },
    floorClear: function () {
      [523, 659, 784].forEach(function (f, i) {
        tone({ f0: f, dur: 0.14, vol: 0.35, type: 'triangle', delay: i * 0.1 });
      });
    },
    victory: function () {
      [523, 659, 784, 1046].forEach(function (f, i) {
        tone({ f0: f, dur: 0.18, vol: 0.4, type: 'triangle', delay: i * 0.12 });
      });
    },
    defeat: function () {
      [392, 311, 233].forEach(function (f, i) {
        tone({ f0: f, dur: 0.25, vol: 0.4, type: 'sawtooth', delay: i * 0.16 });
      });
    },
    click: function () { tone({ f0: 980, dur: 0.05, vol: 0.25, type: 'sine' }); },
    denied: function () { tone({ f0: 220, f1: 160, dur: 0.12, vol: 0.3, type: 'square' }); }
  };

  function play(name, arg) {
    if (!enabled) return;
    var fn = SFX[name];
    if (fn) { try { fn(arg); } catch (e) { /* never break the game for sound */ } }
  }

  function setEnabled(on) {
    enabled = !!on;
    try { if (global.localStorage) global.localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch (e) {}
    if (enabled) ensureCtx();
  }

  var api = {
    play: play, setEnabled: setEnabled,
    isEnabled: function () { return enabled; },
    unlock: function () { ensureCtx(); },
    _names: function () { return Object.keys(SFX); }
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.RBSound = api;
})(typeof window !== 'undefined' ? window : globalThis);
