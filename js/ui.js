/* Rogue Bastion - DOM screens, HUD, touch controls, run flow. */
(function (global) {
  'use strict';
  var L = global.RBLogic, S = global.RBSprites, G = global.RBGame, Snd = global.RBSound;

  var SAVE_KEY = 'rogue-bastion-save-v1';
  var save = loadSave();
  var run = null;
  var draftState = null; // { choices, refreshes }

  function loadSave() {
    try {
      var s = JSON.parse(localStorage.getItem(SAVE_KEY) || '{}');
      return {
        scrapTotal: s.scrapTotal || 0, bestFloor: s.bestFloor || 0, runs: s.runs || 0,
        armory: s.armory || {}, runsHistory: s.runsHistory || []
      };
    } catch (e) { return { scrapTotal: 0, bestFloor: 0, runs: 0, armory: {}, runsHistory: [] }; }
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
    ['screen-menu', 'screen-battle', 'screen-draft', 'screen-result', 'screen-placeholder', 'screen-settings', 'screen-armory', 'screen-rank'].forEach(function (s) {
      var n = $(s);
      if (n) n.classList.toggle('active', s === id);
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
    $('btn-armory').addEventListener('click', function () { if (Snd) Snd.play('click'); buildArmory(); showScreen('screen-armory'); });
    $('btn-rank').addEventListener('click', function () { if (Snd) Snd.play('click'); buildRank(); showScreen('screen-rank'); });
    $('btn-settings').addEventListener('click', function () { if (Snd) Snd.play('click'); showScreen('screen-settings'); });
    $('btn-ph-back').addEventListener('click', function () { showScreen('screen-menu'); });
    buildSettings();
  }

  function buildSettings() {
    var snd = $('set-sound'), aim = $('set-aim');
    if (Snd) snd.checked = Snd.isEnabled();
    aim.checked = $('aim-toggle').checked;
    snd.addEventListener('change', function () {
      if (Snd) { Snd.setEnabled(snd.checked); if (snd.checked) Snd.play('click'); }
      toast(snd.checked ? '音效：开' : '音效：关');
    });
    aim.addEventListener('change', function () {
      $('aim-toggle').checked = aim.checked;
      G.input.autoAim = aim.checked;
      toast(aim.checked ? '自动瞄准：开' : '自动瞄准：关（鼠标瞄准）');
    });
    $('btn-set-back').addEventListener('click', function () { if (Snd) Snd.play('click'); showScreen('screen-menu'); });
  }

  function updateMenuStats() {
    $('stat-scrap').textContent = save.scrapTotal;
    $('stat-floor').textContent = save.bestFloor > 0 ? 'FLOOR ' + save.bestFloor : '—';
  }

  /* ---------- armory (permanent upgrades) ---------- */
  function buildArmory() {
    $('armory-scrap').textContent = save.scrapTotal;
    var list = $('armory-list');
    list.innerHTML = '';
    L.ARMORY_ITEMS.forEach(function (item) {
      var lvl = L.armoryLevel(save.armory, item.id);
      var maxed = lvl >= item.max;
      var cost = L.armoryCost(item, lvl);
      var row = el('div', 'arm-row');
      var ic = S.iconCanvas(item.icon, 3);
      ic.className = 'arm-icon';
      var info = el('div', 'arm-info');
      var nameRow = el('div', 'arm-name-row');
      nameRow.appendChild(el('span', 'arm-name', item.name));
      var pips = el('span', 'arm-pips');
      for (var i = 0; i < item.max; i++) pips.appendChild(el('span', 'arm-pip' + (i < lvl ? ' on' : '')));
      nameRow.appendChild(pips);
      info.appendChild(nameRow);
      info.appendChild(el('div', 'arm-desc', item.desc + ' · 当前 Lv.' + lvl));
      row.appendChild(ic);
      row.appendChild(info);
      var btn = el('button', 'arm-buy', maxed ? '已满级' : cost + ' 废料');
      btn.disabled = maxed || save.scrapTotal < cost;
      btn.addEventListener('click', function () {
        if (maxed || save.scrapTotal < cost) return;
        save.scrapTotal -= cost;
        save.armory[item.id] = lvl + 1;
        storeSave();
        updateMenuStats();
        if (Snd) Snd.play('pickup');
        toast('「' + item.name + '」升至 Lv.' + (lvl + 1));
        buildArmory();
      });
      row.appendChild(btn);
      list.appendChild(row);
    });
    $('btn-arm-back').onclick = function () { if (Snd) Snd.play('click'); showScreen('screen-menu'); };
  }

  function openPlaceholder(title, desc) {
    $('ph-title').textContent = title;
    $('ph-desc').textContent = desc;
    showScreen('screen-placeholder');
  }

  /* ---------- battle HUD + weapon bar ---------- */
  var currentWeapon = 'pierce';

  function buildWeaponBar() {
    var bar = $('weapon-bar');
    bar.innerHTML = '';
    var unlocked = L.unlockedWeapons(save.bestFloor);
    L.WEAPONS.forEach(function (w, i) {
      var isLocked = unlocked.indexOf(w.id) < 0;
      var slot = el('button', 'wslot' + (isLocked ? ' locked' : '') + (w.id === currentWeapon ? ' active' : ''));
      slot.dataset.weapon = w.id;
      var num = el('span', 'wslot-num', String(i + 1));
      var ic = S.iconCanvas(isLocked ? 'lock' : w.icon, 3);
      ic.className = 'wslot-icon';
      var nm = el('span', 'wslot-name', w.name);
      slot.appendChild(num); slot.appendChild(ic); slot.appendChild(nm);
      slot.addEventListener('click', function () {
        if (isLocked) {
          if (Snd) Snd.play('denied');
          toast('「' + w.name + '」到达 FLOOR ' + w.unlockFloor + ' 解锁（' + w.short + '）');
        } else {
          if (G.setWeapon(w.id)) {
            currentWeapon = w.id;
            if (run) run.weapon = w.id;
            refreshWeaponBar();
            toast('「' + w.name + '」' + w.desc);
          }
        }
      });
      bar.appendChild(slot);
    });
  }

  function refreshWeaponBar() {
    var slots = $('weapon-bar').querySelectorAll('.wslot');
    slots.forEach(function (s) {
      s.classList.toggle('active', s.dataset.weapon === currentWeapon);
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
    // weapon bar sync: active weapon + cooldown dim
    if (h.weapon && h.weapon !== currentWeapon) { currentWeapon = h.weapon; refreshWeaponBar(); }
    if (h.weapon) {
      var active = $('weapon-bar').querySelector('.wslot.active');
      if (active) active.classList.toggle('cooling', (h.weaponCd || 0) > 0.05);
    }
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

  /* ---------- leaderboard (local) ---------- */
  function buildRank() {
    var stats = L.rankStats(save.runsHistory);
    $('rank-best-floor').textContent = stats.bestFloor > 0 ? 'FLOOR ' + stats.bestFloor : '—';
    $('rank-best-kills').textContent = stats.bestKills > 0 ? stats.bestKills + ' 机' : '—';
    $('rank-best-time').textContent = stats.bestTime !== null ? L.fmtTime(stats.bestTime) : '—';
    $('rank-runs').textContent = '共 ' + stats.runs + ' 场战绩（本地保存）';
    var list = $('rank-list');
    list.innerHTML = '';
    if (!save.runsHistory.length) {
      list.appendChild(el('div', 'rank-empty', '暂无战绩，快去出击！'));
    }
    save.runsHistory.forEach(function (r) {
      var row = el('div', 'rank-row');
      var d = new Date(r.date);
      var dateStr = (d.getMonth() + 1) + '-' + d.getDate() + ' ' +
        String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
      row.appendChild(el('span', 'rank-date', dateStr));
      row.appendChild(el('span', 'rank-floor', 'F' + r.floor));
      row.appendChild(el('span', 'rank-kills', r.kills + ' 击毁'));
      row.appendChild(el('span', 'rank-time', L.fmtTime(r.timeSec || 0)));
      row.appendChild(el('span', 'rank-badge' + (r.victory ? ' win' : ' lose'), r.victory ? '通关' : '战败'));
      list.appendChild(row);
    });
    $('btn-rank-back').onclick = function () { if (Snd) Snd.play('click'); showScreen('screen-menu'); };
  }

  /* ---------- run flow ---------- */
  function freshStats() {
    return L.applyArmory(L.freshStats(), save.armory);
  }

  function startRun() {
    if (Snd) { Snd.unlock(); Snd.play('click'); }
    run = {
      floor: 1, kills: 0, scrap: 0, waves: 1, bestStreak: 0, weapon: 'pierce',
      startTime: Date.now(), endTime: 0, owned: [], stats: freshStats()
    };
    currentWeapon = 'pierce';
    buildWeaponBar();
    save.runs++;
    storeSave();
    showScreen('screen-battle');
    G.input.autoAim = $('aim-toggle').checked;
    // wait a tick so the battle container has size before Phaser measures it
    setTimeout(function () {
      G.start($('game-container'), { floor: 1, stats: run.stats, run: run, owned: run.owned, bestFloor: save.bestFloor, weapon: run.weapon }, {
        onHud: updateHud,
        onFloorClear: onFloorClear,
        onDefeat: onDefeat,
        onWeaponSwitch: function (id) { run.weapon = id; currentWeapon = id; refreshWeaponBar(); }
      });
    }, 30);
  }

  function onFloorClear() {
    G.setPaused(true);
    run.stats.hp = run.stats.maxHp; // full repair between floors (base game rule)
    // trust the scene's floor (authoritative) over the UI counter
    var hud = G.getHud();
    if (hud && hud.floor) run.floor = hud.floor;
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
    if (Snd) Snd.play('pickup');
    run.stats = L.applyUpgrade(run.stats, u.id);
    run.owned.push(u.id);
    toast('获得强化：' + u.name);
    run.floor++;
    showScreen('screen-battle');
    G.nextFloor({ floor: run.floor, stats: run.stats, run: run, owned: run.owned, bestFloor: save.bestFloor, weapon: run.weapon });
  }

  function onDefeat(runStats, reason) {
    var subtitle = reason === 'base' ? '基地核心已被摧毁' : '你的战车被击毁了';
    finishRun(false, subtitle);
  }

  function finishRun(victory, subtitle) {
    if (victory && Snd) Snd.play('victory');
    run.endTime = Date.now();
    save.scrapTotal += run.scrap;
    if (run.floor > save.bestFloor) save.bestFloor = run.floor;
    save.runsHistory = L.recordRun(save.runsHistory, {
      date: new Date().toISOString(), floor: run.floor, kills: run.kills,
      scrap: run.scrap, timeSec: Math.round((run.endTime - run.startTime) / 1000), victory: victory
    });
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
      if (Snd) Snd.play('click');
      draftState.refreshes--;
      draftState.choices = L.draftChoices(3, run.owned);
      buildDraft();
    });
    $('btn-again').addEventListener('click', function () { G.destroy(); startRun(); });
    $('btn-to-menu').addEventListener('click', function () {
      if (Snd) Snd.play('click');
      G.destroy();
      showScreen('screen-menu');
      updateMenuStats();
    });
  }

  global.RBUI = { init: init, startRun: startRun, updateHud: updateHud, toast: toast, getRun: function () { return run; } };
})(typeof window !== 'undefined' ? window : globalThis);
