/* Rogue Bastion - pure game logic (no Phaser dependency, Node-testable).
   Design numbers harvested from battle-city-roguelike (player 120HP, bullet
   dmg 38, enemy classes scout/assault/heavy, eagle 100HP+50 shield). */
(function (global) {
  'use strict';

  var TILE = 32, COLS = 15, ROWS = 20;
  var TOTAL_FLOORS = 3;

  var FLOOR_NAMES = ['绿野前线', '河谷裂带', '钢铁要塞'];

  // Map legend: '.' ground '#' brick 'S' steel '~' river 'T' bush 'E' base
  var MAPS = [
    [ // Floor 1 - 绿野前线
      '...............',
      '..##...###...##',
      '..##...###...##',
      '...............',
      '.###..T...T..##',
      '.###.........##',
      '......#####....',
      '......#...#....',
      '~~~~..~~~~~..~~',
      '~~~~..~~~~~..~~',
      '...............',
      '..T....###....T',
      '......##.##....',
      '.###..#...#..##',
      '.###.........##',
      '......#####....',
      '...............',
      '..##.......##..',
      '..##...E...##..',
      '...............'
    ],
    [ // Floor 2 - 河谷裂带
      '...............',
      '.###..~~~..###.',
      '.###..~~~..###.',
      '......~~~......',
      '..T...~~~...T..',
      '......~~~......',
      '.####.~~~.####.',
      '......~~~......',
      '~~....~~~....~~',
      '~~....~~~....~~',
      '......~~~......',
      '.###..~~~..###.',
      '.###..~~~..###.',
      '......~~~......',
      '..T...~~~...T..',
      '...............',
      '.####.....####.',
      '...............',
      '..##...E...##..',
      '...............'
    ],
    [ // Floor 3 - 钢铁要塞
      '...............',
      '.SS...###...SS.',
      '.SS...###...SS.',
      '......#S#......',
      '.###..SSS..###.',
      '.###.......###.',
      '..S...###...S..',
      '..S...#.#...S..',
      '~~S...###...S~~',
      '~~S...###...S~~',
      '..S....T....S..',
      '.###..###..###.',
      '.###..#.#..###.',
      '..S...###...S..',
      '..S....T....S..',
      '.###..###..###.',
      '...............',
      '..SS.......SS..',
      '..SS...E...SS..',
      '...............'
    ]
  ];

  var PLAYER = { hp: 120, maxHp: 120, speed: 175, bulletSpeed: 460, damage: 38, fireCooldown: 0.32, radius: 13 };

  var ENEMIES = {
    scout:   { hp: 22, speed: 145, damage: 8,  bulletSpeed: 220, fireInterval: 2.2, score: 10, color: 'scout' },
    assault: { hp: 45, speed: 105, damage: 10, bulletSpeed: 240, fireInterval: 1.9, score: 20, color: 'assault' },
    heavy:   { hp: 95, speed: 65,  damage: 15, bulletSpeed: 200, fireInterval: 2.6, score: 40, color: 'heavy' }
  };

  var BASE = { hp: 100, maxHp: 100, shield: 50, maxShield: 50 };

  function floorEnemyCount(floor) { return 10 + (floor - 1) * 2; }

  function floorComposition(floor) {
    var n = floorEnemyCount(floor), list = [];
    var heavy = floor >= 3 ? 4 : (floor >= 2 ? 2 : 0);
    var assault = Math.floor(n * 0.4);
    var scout = n - heavy - assault;
    var i;
    for (i = 0; i < scout; i++) list.push('scout');
    for (i = 0; i < assault; i++) list.push('assault');
    for (i = 0; i < heavy; i++) list.push('heavy');
    // shuffle (Fisher-Yates)
    for (i = list.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = list[i]; list[i] = list[j]; list[j] = t;
    }
    return list;
  }

  var UPGRADES = [
    { id: 'split',   name: '分裂炮管', rarity: 'rare',  rarityZh: '稀有·蓝色', color: '#2f9df0', dark: '#1c6ec2',
      desc: '每次射击额外增发 1 枚炮弹', tags: '伤害提升 | 射速提升', icon: 'split' },
    { id: 'explosive', name: '高爆弹', rarity: 'epic', rarityZh: '史诗·紫色', color: '#a855f7', dark: '#7c3aed',
      desc: '命中范围爆炸，对周围敌人造成伤害', tags: '爆炸范围扩大 | 范围伤害', icon: 'bomb' },
    { id: 'nano',    name: '纳米修复', rarity: 'rare',  rarityZh: '稀有·橙色', color: '#f97316', dark: '#c2570b',
      desc: '每秒恢复装甲 8 点，持续 10 秒', tags: '护甲提升 | 持续恢复', icon: 'nano' },
    { id: 'velocity', name: '高膛压穿甲弹', rarity: 'common', rarityZh: '普通·青色', color: '#22c55e', dark: '#15803d',
      desc: '炮弹速度 +35%，伤害 +15%', tags: '弹速提升 | 伤害提升', icon: 'bolt' },
    { id: 'armor',   name: '加厚复合装甲', rarity: 'common', rarityZh: '普通·青色', color: '#22c55e', dark: '#15803d',
      desc: '装甲上限 +40，并立即修复 40 点', tags: '生命上限 | 立即修复', icon: 'shield' },
    { id: 'rapid',   name: '双路自动装弹机', rarity: 'common', rarityZh: '普通·青色', color: '#22c55e', dark: '#15803d',
      desc: '主炮装填冷却缩短 25%', tags: '射速提升 | 持续输出', icon: 'clock' }
  ];

  function byId(id) {
    for (var i = 0; i < UPGRADES.length; i++) if (UPGRADES[i].id === id) return UPGRADES[i];
    return null;
  }

  // Pick `count` distinct upgrades, optionally excluding already-owned ids.
  // `rand` is an injectable rng (Math.random by default) for tests.
  function draftChoices(count, excludeIds, rand) {
    rand = rand || Math.random;
    excludeIds = excludeIds || [];
    var pool = UPGRADES.filter(function (u) { return excludeIds.indexOf(u.id) < 0; });
    if (pool.length <= count) return pool.slice();
    // Fisher-Yates with injected rng, then take first `count` (always terminates).
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(rand() * (i + 1));
      var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    return pool.slice(0, count);
  }

  // Apply one upgrade to a player stat block; returns a new object.
  function applyUpgrade(stats, id) {
    var s = {};
    for (var k in stats) s[k] = stats[k];
    if (id === 'split') s.projectiles = (s.projectiles || 1) + 1;
    else if (id === 'explosive') s.explosive = true;
    else if (id === 'nano') { s.nanoUntil = (s.nanoUntil || 0) + 10; s.nanoRate = 8; }
    else if (id === 'velocity') { s.bulletSpeed = Math.round(s.bulletSpeed * 1.35); s.damage = Math.round(s.damage * 1.15); }
    else if (id === 'armor') { s.maxHp += 40; s.hp = Math.min(s.maxHp, s.hp + 40); }
    else if (id === 'rapid') s.fireCooldown = +(s.fireCooldown * 0.75).toFixed(3);
    return s;
  }

  function scrapForKill(type) { return ENEMIES[type] ? ENEMIES[type].score : 10; }

  // Kill-streak: kills chained with gaps under `windowMs` count as one streak.
  function streakTracker(windowMs) {
    var last = -Infinity, cur = 0, best = 0;
    return {
      kill: function (nowMs) {
        cur = (nowMs - last <= windowMs) ? cur + 1 : 1;
        last = nowMs;
        if (cur > best) best = cur;
        return { current: cur, best: best };
      },
      best: function () { return best; }
    };
  }

  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function validateMaps() {
    var errors = [];
    MAPS.forEach(function (m, fi) {
      if (m.length !== ROWS) errors.push('floor ' + (fi + 1) + ': ' + m.length + ' rows, want ' + ROWS);
      m.forEach(function (row, ri) {
        if (row.length !== COLS) errors.push('floor ' + (fi + 1) + ' row ' + ri + ': ' + row.length + ' cols, want ' + COLS);
      });
      var flat = m.join('');
      if ((flat.match(/E/g) || []).length !== 1) errors.push('floor ' + (fi + 1) + ': must have exactly 1 base');
    });
    return errors;
  }

  function findBase(floor) {
    var m = MAPS[floor - 1];
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++)
      if (m[r][c] === 'E') return { col: c, row: r };
    return null;
  }

  var api = {
    TILE: TILE, COLS: COLS, ROWS: ROWS, TOTAL_FLOORS: TOTAL_FLOORS,
    FLOOR_NAMES: FLOOR_NAMES, MAPS: MAPS, PLAYER: PLAYER, ENEMIES: ENEMIES, BASE: BASE,
    UPGRADES: UPGRADES, byId: byId, draftChoices: draftChoices, applyUpgrade: applyUpgrade,
    floorEnemyCount: floorEnemyCount, floorComposition: floorComposition,
    scrapForKill: scrapForKill, streakTracker: streakTracker, fmtTime: fmtTime,
    validateMaps: validateMaps, findBase: findBase
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else global.RBLogic = api;
})(typeof window !== 'undefined' ? window : globalThis);
