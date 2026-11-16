/* Rogue Bastion - DOM screens, HUD, touch controls, run flow. */
(function (global) {
  'use strict';
  var L = global.RBLogic, S = global.RBSprites, G = global.RBGame;

  var SAVE_KEY = 'rogue-bastion-save-v1';
  var save = loadSave();
  var run = null;
  var draftState = null; // { choices, refreshes }

  function loadSave() {
    try {
      var s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      return { scrapTotal: s.scrapTotal || 0, bestFloor: s.bestFloor || 0, runs: s.runs || 0 };
    } catch (e) { return { scrapTotal: 0, bestFloor: 0, runs: 0 }; }
  }
  function storeSave() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {}
  }

  function $(id) { return document.getElementById(id); }
  function el(tag, cls, text) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (text !== undefined && text !== null) d.textContent = text;
    return d;
  }
  function showScreen(id) {
    ['screen-menu', 'screen-battle', 'screen-draft', 'screen-result', 'screen-placeholder'].forEach(function (s) {
      $(s).classList.toggle('active', s === id);
    });
    if (id === 'screen-draft' || id === 'screen-result') $('screen-battle').classList.add('active');
  }
  var toastTimer = null;
  function toast(msg) {
    var t = $('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 1600);
  }

  /* ---------- menu ---------- */
  function buildMenu() {
    var bg = S.menuBackdrop(480, 800);
    bg.id = 'menu-bg';
    $('menu-backdrop').appendChild(bg);

    var side = S.tankSideCanvas(4);
    side.className = 'menu-btn-icon';
    $('btn-start-icon').appendChild(side);
    $('btn-armory-icon').appendChild(S.iconCanvas('cube', 4)).className = 'menu-btn-icon';
    $('btn-rank-icon').appendChild(S.iconCanvas('trophy', 4)).className = 'menu-btn-icon';
    $('btn-settings-icon').appendChild(S.iconCanvas('gear', 4)).className = 'menu-btn-icon';
    updateMenuStats();

    $('btn-start').addEventListener('click', startRun);
    $('btn-armory').addEventListener('click', function () { openPlaceholder('军械库', '武器、模块与永久升级，敬请期待。'); });
    $('btn-rank').addEventListener('click', function () { openPlaceholder('排行榜', '赛季排名与好友榜，敬请期待。'); });
    $('btn-settings').addEventListener('click', function () { openPlaceholder('设置', '画面、音效与操作设置，敬请期待。'); });
    $('btn-ph-back').addEventListener('click', function () { showScreen('screen-menu'); });
  }

  function updateMenuStats() {
    $('stat-scrap').textContent = save.scrapTotal;
    $('stat-floor').textContent = save.bestFloor > 0 ? 'FLOOR ' + save.bestFloor : '—';
  }

  function openPlaceholder(title, desc) {
    $('ph-title').textContent = title;
    $('ph-desc').textContent = desc;
    showScreen('screen-placeholder');
  }

  /* ---------- battle HUD + weapon bar ---------- */
  var WEAPONS = [
    { name: '重装穿甲', icon: 'bullet', locked: false },
    { name: 'EMP脉冲', icon: 'lock', locked: true },
    { name: '榴弹轰击', icon: 'lock', locked: true },
    { name: '高爆破片', icon: 'lock', locked: true },
    { name: '烟雾遮蔽', icon: 'lock', locked: true },
    { name: '导弹齐射', icon: 'lock', locked: true }
  ];

  function buildWeaponBar() {
    var bar = $('weapon-bar');
    bar.innerHTML = '';
    WEAPONS.forEach(function (w, i) {
      var slot = el('button', 'wslot' + (w.locked ? ' locked' : ' active'));
      var num = el('span', 'wslot-num', String(i + 1));
      var ic = S.iconCanvas(w.icon, 3);
      ic.className = 'wslot-icon';
      var nm = el('span', 'wslot-name', w.name);
      slot.appendChild(num); slot.appendChild(ic); slot.appendChild(nm);
      slot.addEventListener('click', function () {
        if (w.locked) toast('「' + w.name + '」后续版本开放');
        else toast('当前武器：重装穿甲');
      });
      bar.appendChild(slot);
    });
  }

  function updateHud(h) {
    if (!h) return;
    var coreMax = h.baseMax || 150;
    var coreNow = h.baseHp + h.baseShield;
    var corePct = Math.max(0, Math.min(100, coreNow / coreMax * 100));
    $('hud-core-fill').style.width = corePct + '%';
    $('hud-core-fill').classList.toggle('low', corePct < 30);
    $('hud-core-num').textContent = coreNow + ' / ' + coreMax;
    var armorPct = Math.max(0, Math.min(100, h.playerHp / h.playerMaxHp * 100));
    $('hud-armor-fill').style.width = armorPct + '%';
    $('hud-armor-fill').classList.toggle('low', armorPct < 30);
    $('hud-armor-num').textContent = h.playerHp + ' / ' + h.playerMaxHp;
    $('hud-enemies').textContent = '敌军剩余装甲：' + h.enemiesLeft + ' 机';
    $('hud-floor').textContent = L.FLOOR_NAMES[h.floor - 1] + ' // FLOOR ' + h.floor + ' / ' + L.TOTAL_FLOORS;
    $('hud-kills').textContent = '击毁 ' + h.kills + ' · 废料 ' + h.scrap;
  }

  /* ---------- touch controls ---------- */
  function buildControls() {
    var joy = $('joy-base'), knob = $('joy-knob');
    var joyId = null;
    function joyVec(e) {
      var r = joy.getBoundingClientRect();
      var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      var dx = (e.clientX - cx) / (r.width / 2), dy = (e.clientY - cy) / (r.height / 2);
      var len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      return { x: dx, y: dy, len: Math.min(1, len) };
    }
    joy.addEventListener('pointerdown', function (e) {
      joyId = e.pointerId;
      joy.setPointerCapture(e.pointerId);
      var v = joyVec(e);
      G.input.mx = v.x; G.input.my = v.y;
      knob.style.transform = 'translate(' + (v.x * 30) + 'px,' + (v.y * 30) + 'px)';
    });
    joy.addEventListener('pointermove', function (e) {
      if (e.pointerId !== joyId) return;
      var v = joyVec(e);
      G.input.mx = v.x; G.input.my = v.y;
      knob.style.transform = 'translate(' + (v.x * 30) + 'px,' + (v.y * 30) + 'px)';
    });
    function joyEnd(e) {
      if (e.pointerId !== joyId) return;
      joyId = null;
      G.input.mx = 0; G.input.my = 0;
      knob.style.transform = 'translate(0,0)';
    }
    joy.addEventListener('pointerup', joyEnd);
    joy.addEventListener('pointercancel', joyEnd);

    var fire = $('btn-fire');
    fire.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      G.input.firing = true;
      fire.classList.add('pressed');
    });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach(function (ev) {
      fire.addEventListener(ev, function () { G.input.firing = false; fire.classList.remove('pressed'); });
    });
    fire.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    $('aim-toggle').addEventListener('change', function (e) {
      G.input.autoAim = e.target.checked;
      toast(e.target.checked ? '自动瞄准：开' : '自动瞄准：关（鼠标瞄准）');
    });
    $('btn-quit').addEventListener('click', function () {
      G.destroy();
      showScreen('screen-menu');
      updateMenuStats();
    });
  }

  function detectTouch() {
    if (('ontouchstart' in window) || (window.matchMedia && matchMedia('(pointer: coarse)').matches)) {
      document.body.classList.add('touch');
    }
    window.addEventListener('touchstart', function once() {
      document.body.classList.add('touch');
      window.removeEventListener('touchstart', once);
    }, { passive: true });
  }

  /* ---------- run flow ---------- */
  function freshStats() {
    return {
      hp: L.PLAYER.hp, maxHp: L.PLAYER.maxHp, speed: L.PLAYER.speed,
      bulletSpeed: L.PLAYER.bulletSpeed, damage: L.PLAYER.damage,
      fireCooldown: L.PLAYER.fireCooldown, projectiles: 1, explosive: false,
      nanoUntil: 0, nanoRate: 0
    };
  }

  function startRun() {
    run = {
      floor: 1, kills: 0, scrap: 0, waves: 1, bestStreak: 0,
      startTime: Date.now(), endTime: 0, owned: [], stats: freshStats()
    };
    save.runs++;
    storeSave();
    showScreen('screen-battle');
    G.input.autoAim = $('aim-toggle').checked;
    // wait a tick so the battle container has size before Phaser measures it
    setTimeout(function () {
      G.start($('game-container'), { floor: 1, stats: run.stats, run: run, owned: run.owned }, {
        onHud: updateHud,
        onFloorClear: onFloorClear,
        onDefeat: onDefeat
      });
    }, 30);
  }

  function onFloorClear() {
    G.setPaused(true);
    run.stats.hp = run.stats.maxHp; // full repair between floors (base game rule)
    if (run.floor >= L.TOTAL_FLOORS) {
      finishRun(true, '全部楼层已通关');
      return;
    }
    draftState = { choices: L.draftChoices(3, run.owned), refreshes: 1 };
    buildDraft();
    showScreen('screen-draft');
  }

  function buildDraft() {
    var list = $('draft-list');
    list.innerHTML = '';
    draftState.choices.forEach(function (u) {
      var card = el('button', 'draft-card');
      card.style.setProperty('--card', u.color);
      card.style.setProperty('--card-dark', u.dark);
      var top = el('div', 'draft-card-top');
      var ic = S.iconCanvas(u.icon, 4);
      ic.className = 'draft-icon';
      var nameBox = el('div', 'draft-name-box');
      nameBox.appendChild(el('div', 'draft-name', u.name));
      nameBox.appendChild(el('div', 'draft-rarity', u.rarityZh));
      top.appendChild(ic); top.appendChild(nameBox);
      var desc = el('div', 'draft-desc', u.desc);
      var tags = el('div', 'draft-tags', u.tags);
      card.appendChild(top); card.appendChild(desc); card.appendChild(tags);
      card.addEventListener('click', function () { pickUpgrade(u); });
      list.appendChild(card);
    });
    var rb = $('btn-refresh');
    rb.disabled = draftState.refreshes <= 0;
    rb.textContent = draftState.refreshes > 0 ? '剩余刷新次数 ' + draftState.refreshes + ' 次' : '刷新已用完';
  }

  function pickUpgrade(u) {
    run.stats = L.applyUpgrade(run.stats, u.id);
    run.owned.push(u.id);
    toast('获得强化：' + u.name);
    run.floor++;
    showScreen('screen-battle');
    G.nextFloor({ floor: run.floor, stats: run.stats, run: run, owned: run.owned });
  }

  function onDefeat(runStats, reason) {
    var subtitle = reason === 'base' ? '基地核心已被摧毁' : '你的战车被击毁了';
    finishRun(false, subtitle);
  }

  function finishRun(victory, subtitle) {
    run.endTime = Date.now();
    save.scrapTotal += run.scrap;
    if (run.floor > save.bestFloor) save.bestFloor = run.floor;
    storeSave();
    G.setPaused(true);
    buildResult(victory, subtitle);
    showScreen('screen-result');
  }

  function buildResult(victory, subtitle) {
    var screen = $('screen-result');
    screen.classList.toggle('victory', victory);
    screen.classList.toggle('defeat', !victory);
    $('result-title').textContent = victory ? '任务完成' : '任务失败';
    $('result-sub').textContent = subtitle;
    $('result-tag').textContent = victory ? 'BASTION TACTICAL HUD · 作战胜利' : 'BASTION TACTICAL HUD · 作战失败';
    var secs = Math.max(0, Math.round((run.endTime - run.startTime) / 1000));
    var rows = [
      { icon: 'shield', label: '到达楼层', value: 'FLOOR ' + run.floor + ' / ' + L.TOTAL_FLOORS },
      { icon: 'bullet', label: '击毁敌军', value: run.kills + ' 机' },
      { icon: 'clock', label: '存活波次', value: run.waves + ' 波' },
      { icon: 'gear', label: '获得废料', value: String(run.scrap) },
      { icon: 'bolt', label: '最高连杀', value: String(run.bestStreak || 0) }
    ];
    var list = $('result-stats');
    list.innerHTML = '';
    rows.forEach(function (r) {
      var row = el('div', 'stat-row');
      var ic = S.iconCanvas(r.icon, 2);
      ic.className = 'stat-icon';
      row.appendChild(ic);
      row.appendChild(el('span', 'stat-label', r.label));
      row.appendChild(el('span', 'stat-value', r.value));
      list.appendChild(row);
    });
    var rev = $('result-upgrades');
    rev.innerHTML = '';
    if (!run.owned.length) {
      rev.appendChild(el('div', 'upg-empty', '本局未获得强化'));
    } else {
      run.owned.forEach(function (id) {
        var u = L.byId(id);
        if (!u) return;
        var box = el('div', 'upg-box');
        var ic = S.iconCanvas(u.icon, 3);
        ic.className = 'upg-icon';
        box.appendChild(ic);
        box.appendChild(el('div', 'upg-name', u.name));
        rev.appendChild(box);
      });
    }
    $('result-foot').textContent = '本次作战时长 ' + L.fmtTime(secs) + ' · 坚持了 ' + run.waves + ' 波 · 获得废料 +' + run.scrap;
  }

  function init() {
    buildMenu();
    buildWeaponBar();
    buildControls();
    detectTouch();
    $('btn-refresh').addEventListener('click', function () {
      if (!draftState || draftState.refreshes <= 0) return;
      draftState.refreshes--;
      draftState.choices = L.draftChoices(3, run.owned);
      buildDraft();
    });
    $('btn-again').addEventListener('click', function () { G.destroy(); startRun(); });
    $('btn-to-menu').addEventListener('click', function () {
      G.destroy();
      showScreen('screen-menu');
      updateMenuStats();
    });
  }

  global.RBUI = { init: init, startRun: startRun, updateHud: updateHud, toast: toast, getRun: function () { return run; } };
})(typeof window !== 'undefined' ? window : globalThis);
