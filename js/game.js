/* Rogue Bastion - Phaser 3 battle engine.
   Zero-build: Phaser 3.90 vendored locally (js/phaser.min.js).
   DOM owns menus/HUD; this module owns the battlefield canvas only. */
(function (global) {
  'use strict';
  var L = global.RBLogic, S = global.RBSprites, Snd = global.RBSound;

  var W = 480, H = 640, TILE = 32;
  var SPAWN_COLS = [1, 7, 13];

  var phaserGame = null;
  var sceneRef = null;
  var hooks = {};
  var input = { mx: 0, my: 0, firing: false, autoAim: true };

  function angleTo(x1, y1, x2, y2) { return Math.atan2(y2 - y1, x2 - x1); }
  function lerpAngle(a, b, t) {
    var d = b - a;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  }
  function dist(x1, y1, x2, y2) { return Math.hypot(x2 - x1, y2 - y1); }

  /* Ground texture pick per theme, from a deterministic 0..1 hash. */
  function pickGroundTex(theme, h) {
    if (theme === 'grass') {
      if (h > 0.90) return 'tile-flowers';
      if (h > 0.64) return 'tile-grass';
      if (h > 0.40) return 'tile-ground2';
      if (h > 0.34) return 'tile-path';
      if (h > 0.30) return 'tile-crater';
      return 'tile-ground';
    }
    if (theme === 'steel') {
      if (h > 0.78) return 'tile-gravel';
      if (h > 0.52) return 'tile-ground2';
      if (h > 0.44) return 'tile-crater';
      if (h > 0.38) return 'tile-path';
      if (h > 0.33) return 'tile-grass';
      return 'tile-ground';
    }
    // valley
    if (h > 0.88) return 'tile-grass';
    if (h > 0.62) return 'tile-ground2';
    if (h > 0.52) return 'tile-path';
    if (h > 0.44) return 'tile-crater';
    if (h > 0.36) return 'tile-gravel';
    return 'tile-ground';
  }

  var BattleScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize: function BattleScene() { Phaser.Scene.call(this, { key: 'Battle' }); },

    init: function (data) {
      this.floor = data.floor;
      this.stats = data.stats;      // player stat block (mutated by upgrades)
      this.run = data.run;          // { kills, scrap, waves, startTime, ... }
      this.owned = data.owned || [];
      this.bestFloor = data.bestFloor || 1;
      this.weapon = data.weapon || 'pierce';
      this.weaponCds = {};
      this.smokeZones = [];
      this.clearing = false;
      this.over = false;
      this.fireCd = 0;
      this.nanoTimer = 0;
      this.invulnUntil = 0;
      this.hudTimer = 0;
      this.streak = L.streakTracker(4000);
      this.spawnQueue = L.floorComposition(this.floor);
      this.spawnTimer = 800;
      this.enemies = [];
      this.wave = 1;
      this._spawnedAny = false;
      this._waveCounted = false;
      this.baseShield = this.stats.baseShield || L.BASE.shield;
      this.baseHp = L.BASE.hp;
    },

    create: function () {
      var self = this;
      sceneRef = this;
      this.physics.resume();
      S.buildTextures(this);
      this.theme = L.floorTheme(this.floor);
      S.buildGroundTextures(this, this.theme);
      this.cameras.main.setBackgroundColor(this.theme === 'grass' ? '#79ad54' : (this.theme === 'steel' ? '#7d7768' : '#8a6a45'));

      var map = L.MAPS[this.floor - 1];
      // mutable char grid (bricks removed on destruction) for enemy navigation
      this.mapGrid = map.map(function (row) { return row.split(''); });
      var basePos = L.findBase(this.floor);

      // --- ground + tiles ---
      this.walls = this.physics.add.staticGroup();
      this.rivers = this.physics.add.staticGroup();
      for (var r = 0; r < L.ROWS; r++) {
        for (var c = 0; c < L.COLS; c++) {
          var ch = map[r][c];
          var x = c * TILE + TILE / 2, y = r * TILE + TILE / 2;
          var h = S.hash2(c, r);
          var gtex = pickGroundTex(this.theme, h);
          this.add.image(x, y, gtex).setDepth(0);
          // decorations on open ground (never on spawn row, player spawn, or near base)
          if (ch === '.' && r > 0 && !(c === 7 && r === basePos.row - 2) &&
              Math.abs(c - basePos.col) + Math.abs(r - basePos.row) > 2) {
            var dh = S.hash2(c * 3 + 1, r * 7 + 2);
            if (dh < 0.07) {
              var dk = S.hash2(c * 11 + 5, r * 13 + 3);
              var kind = dk < 0.15 ? 'wreck' : (dk < 0.4 ? 'barrel' : (dk < 0.6 ? 'sandbag' : (dk < 0.8 ? 'rock' : 'tuft')));
              this.add.image(x, y, 'decor-' + kind).setDepth(0.5);
            }
          }
          if (ch === '#') {
            var b = this.walls.create(x, y, 'tile-brick');
            b.setData('brick', true); b.refreshBody(); b.setDepth(1);
          } else if (ch === 'S') {
            var s = this.walls.create(x, y, 'tile-steel');
            s.setData('brick', false); s.refreshBody(); s.setDepth(1);
          } else if (ch === '~') {
            this.add.image(x, y, 'tile-river').setDepth(0);
            var rv = this.rivers.create(x, y, 'tile-river');
            rv.setVisible(false); rv.refreshBody();
          } else if (ch === 'T') {
            this.add.image(x, y, 'tile-bush').setDepth(1);
          }
        }
      }

      // --- base (shield core) ---
      var bx = basePos.col * TILE + TILE / 2, by = basePos.row * TILE + TILE / 2;
      this.base = this.add.image(bx, by, 'base').setDepth(2).setDisplaySize(56, 56);
      this.physics.add.existing(this.base, true);
      this.base.body.setSize(44, 44);
      this.base.body.setOffset(6, 6);

      // --- player ---
      var px = bx, py = (basePos.row - 2) * TILE + TILE / 2;
      this.player = this.physics.add.image(px, py, 'chassis-player').setDepth(5);
      this.player.body.setSize(26, 26);
      this.player.body.setOffset(3, 3);
      this.player.setCollideWorldBounds(true);
      this.playerHp = this.stats.hp;
      this.playerMaxHp = this.stats.maxHp;
      this.turret = this.add.image(px, py, 'turret-player').setDepth(6);
      this.chassisAngle = -Math.PI / 2;
      this.turretAngle = -Math.PI / 2;
      this.playerBarBg = this.add.rectangle(px, py - 24, 30, 5, 0x101018).setDepth(7);
      this.playerBarFg = this.add.rectangle(px, py - 24, 28, 3, 0x3ecf5a).setDepth(7);

      // --- groups ---
      this.playerBullets = this.physics.add.group({ defaultKey: 'bullet-player' });
      this.enemyBullets = this.physics.add.group({ defaultKey: 'bullet-enemy' });
      this.enemyGroup = this.physics.add.group();

      // --- collisions ---
      this.physics.add.collider(this.player, this.walls);
      this.physics.add.collider(this.player, this.rivers);
      this.physics.add.collider(this.player, this.base);
      this.physics.add.collider(this.enemyGroup, this.walls);
      this.physics.add.collider(this.enemyGroup, this.rivers);
      this.physics.add.collider(this.enemyGroup, this.base);
      this.physics.add.collider(this.enemyGroup, this.enemyGroup);
      this.physics.add.collider(this.player, this.enemyGroup);
      // homing missiles arc over walls (process callback skips them in the collider)
      this.physics.add.collider(this.playerBullets, this.walls, function (bul, wall) { self.onBulletWall(bul, wall); },
        function (bul) { return !bul.getData('homing'); });
      this.physics.add.collider(this.enemyBullets, this.walls, function (bul, wall) { self.onBulletWall(bul, wall); });
      this.physics.add.overlap(this.playerBullets, this.enemyGroup, function (bul, en) { self.onPlayerBulletHit(bul, en); });
      this.physics.add.overlap(this.enemyBullets, this.player, function (pl, bul) { self.onEnemyBulletHitPlayer(bul); });
      this.physics.add.overlap(this.enemyBullets, this.base, function (bs, bul) { self.onEnemyBulletHitBase(bul); });

      // --- particles ---
      this.boom1 = this.add.particles(0, 0, 'px', { speed: { min: 40, max: 170 }, lifespan: 450, quantity: 0, scale: { start: 3, end: 0 }, tint: 0xff9a1f });
      this.boom2 = this.add.particles(0, 0, 'px', { speed: { min: 20, max: 110 }, lifespan: 300, quantity: 0, scale: { start: 2, end: 0 }, tint: 0xffd23e });
      this.smoke = this.add.particles(0, 0, 'px', { speed: { min: 5, max: 26 }, lifespan: 850, quantity: 0, scale: { start: 4, end: 9 }, tint: 0x6b7280, alpha: { start: 0.55, end: 0 }, gravityY: -28 });
      this.boom1.setDepth(9); this.boom2.setDepth(9); this.smoke.setDepth(8);

      // --- input ---
      this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT,SPACE,ONE,TWO,THREE,FOUR,FIVE,SIX');
      this.input.on('pointerdown', function (p) { if (p.event.target === self.sys.canvas) input.firing = true; });
      this.input.on('pointerup', function () { input.firing = false; });

      this.floorText = this.add.text(W / 2, 120, 'FLOOR ' + this.floor + '  ' + L.FLOOR_NAMES[this.floor - 1], {
        fontFamily: '"Fusion Pixel", sans-serif', fontSize: '26px', color: '#ffd23e',
        stroke: '#101018', strokeThickness: 5
      }).setOrigin(0.5).setDepth(10);
      this.tweens.add({ targets: this.floorText, alpha: 0, y: 90, duration: 1400, delay: 900 });

      if (hooks.onHud) hooks.onHud(this.getHud());
    },

    tileAt: function (x, y) {
      var c = Math.floor(x / TILE), r = Math.floor(y / TILE);
      if (c < 0 || c >= L.COLS || r < 0 || r >= L.ROWS) return '#';
      return this.mapGrid[r][c];
    },

    isBlockingTile: function (x, y) {
      var t = this.tileAt(x, y);
      return t === '#' || t === 'S' || t === '~';
    },

    getHud: function () {
      return {
        playerHp: Math.max(0, Math.ceil(this.playerHp || 0)), playerMaxHp: this.playerMaxHp,
        baseHp: Math.max(0, Math.ceil(this.baseHp)), baseShield: Math.max(0, Math.ceil(this.baseShield)),
        baseMax: L.BASE.hp + (this.stats.baseShield || L.BASE.shield),
        enemiesLeft: (this.spawnQueue ? this.spawnQueue.length : 0) + this.enemies.length,
        floor: this.floor, kills: this.run.kills, scrap: this.run.scrap, waves: this.wave,
        weapon: this.weapon,
        weaponCd: Math.max(0, ((this.weaponCds && this.weaponCds[this.weapon]) || 0) - (this.time ? this.time.now : 0)) / 1000
      };
    },

    spawnOne: function () {
      if (!this.spawnQueue.length) return;
      this._spawnedAny = true;
      var type = this.spawnQueue.shift();
      var col = SPAWN_COLS[Math.floor(Math.random() * SPAWN_COLS.length)];
      this.makeEnemy(type, col * TILE + TILE / 2, TILE / 2);
    },

    // boss-summoned escort (not from the spawn queue)
    spawnEscort: function (x, y) {
      var e = this.makeEnemy('scout', x, y);
      if (e) e.escort = true;
      return e;
    },

    makeEnemy: function (type, x, y) {
      var def = L.ENEMIES[type];
      if (!def) return null;
      // floor HP scaling applies to regular enemies, not the boss (flat 600)
      var hp = type === 'boss' ? def.hp : Math.round(def.hp * L.floorHpScale(this.floor));
      var chassis = this.enemyGroup.create(x, y, 'chassis-' + type);
      chassis.body.setSize(26, 26);
      chassis.body.setOffset(3, 3);
      chassis.setCollideWorldBounds(true);
      chassis.setDepth(5);
      var turret = this.add.image(x, y, 'turret-' + type).setDepth(6);
      // per-type silhouette scale (scout small/nimble, heavy big, boss huge)
      var escale = { scout: 0.88, assault: 1, heavy: 1.06, missile: 0.92, boss: 1.4 }[type] || 1;
      chassis.setScale(escale);
      turret.setScale(escale);
      var barBg = this.add.rectangle(x, y - 24, 30, 5, 0x101018).setDepth(7).setVisible(false);
      var barFg = this.add.rectangle(x, y - 24, 28, 3, 0xe5484d).setDepth(7).setVisible(false);
      var e = {
        chassis: chassis, turret: turret, type: type, def: def,
        hp: hp, maxHp: hp, barBg: barBg, barFg: barFg,
        angle: Math.PI / 2, turretAngle: Math.PI / 2,
        retargetAt: 0, fireAt: this.time.now + 1200 + Math.random() * 1200,
        escapeUntil: 0, escapeAngle: 0, stuckAt: this.time.now + 600,
        lastX: x, lastY: y, target: 'player',
        summonAt: this.time.now + 8000
      };
      chassis.setData('enemy', e);
      this.enemies.push(e);
      var star = this.add.image(x, y, 'star').setDepth(8).setScale(1.6).setAlpha(0.9);
      this.tweens.add({ targets: star, scale: 0.4, alpha: 0, duration: 350, onComplete: function () { star.destroy(); } });
      return e;
    },

    fireBullet: function (x, y, angle, friendly, damage, speed, explosive, opts) {
      opts = opts || {};
      var group = friendly ? this.playerBullets : this.enemyBullets;
      var b = group.get(x, y, friendly ? 'bullet-player' : 'bullet-enemy');
      if (!b) return;
      b.setActive(true).setVisible(true).setDepth(7);
      b.body.enable = true;
      b.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
      if (opts.tint) b.setTint(opts.tint); else b.clearTint();
      b.setData({ damage: damage, explosive: !!explosive, friendly: friendly,
        range: opts.range || 0, sx: x, sy: y, homing: opts.homing || null, speed: speed });
      b.setRotation(angle + Math.PI / 2);
    },

    setWeapon: function (id) {
      var w = L.weaponById(id);
      if (!w) return false;
      if (L.unlockedWeapons(this.bestFloor).indexOf(id) < 0) return false;
      this.weapon = id;
      // small switch delay so spamming keys can't bypass cooldowns
      this.weaponCds[id] = Math.max(this.weaponCds[id] || 0, this.time.now + 150);
      if (Snd) Snd.play('click');
      return true;
    },

    playerFire: function () {
      var now = this.time.now;
      var w = L.weaponById(this.weapon) || L.WEAPONS[0];
      var cd = (this.weapon === 'pierce') ? this.stats.fireCooldown : w.cooldown;
      if (now < (this.weaponCds[this.weapon] || 0)) return;
      this.weaponCds[this.weapon] = now + cd * 1000;
      var fn = this['fire_' + this.weapon];
      if (fn) fn.call(this);
    },

    fire_pierce: function () {
      var n = this.stats.projectiles || 1;
      var mx = this.player.x + Math.cos(this.turretAngle) * 18;
      var my = this.player.y + Math.sin(this.turretAngle) * 18;
      for (var i = 0; i < n; i++) {
        var off = (i - (n - 1) / 2) * 0.09;
        this.fireBullet(mx, my, this.turretAngle + off, true, this.stats.damage, this.stats.bulletSpeed, !!this.stats.explosive);
      }
      if (Snd) Snd.play('fire');
      // muzzle flash: bright star + expanding glow
      var fl = this.add.image(mx, my, 'star').setDepth(8).setScale(0.9).setAlpha(1);
      this.tweens.add({ targets: fl, scale: 1.5, alpha: 0, duration: 140, onComplete: function () { fl.destroy(); } });
      var glow = this.add.circle(mx, my, 5, 0xffd23e, 0.55).setDepth(8);
      this.tweens.add({ targets: glow, scale: 2.6, alpha: 0, duration: 160, onComplete: function () { glow.destroy(); } });
    },

    // EMP: stun + chip damage in a radius around the player
    fire_emp: function () {
      var now = this.time.now, self = this;
      if (Snd) Snd.play('emp');
      var ring = this.add.circle(this.player.x, this.player.y, 8).setStrokeStyle(4, 0x35c8f0).setDepth(8);
      this.tweens.add({ targets: ring, scale: 14, alpha: 0, duration: 420, onComplete: function () { ring.destroy(); } });
      this.boom2.explode(16, this.player.x, this.player.y);
      this.enemies.slice().forEach(function (e) {
        if (dist(self.player.x, self.player.y, e.chassis.x, e.chassis.y) <= 110) {
          e.stunnedUntil = now + 2500;
          self.damageEnemy(e, 10);
        }
      });
    },

    // Grenade: lobbed shell to the aim point, AoE 70 / 60 dmg, flies over walls
    fire_grenade: function () {
      var self = this;
      var tgt = this.aimPoint(300);
      var g = this.add.image(this.player.x, this.player.y, 'icon-grenade').setDepth(8).setScale(2);
      if (Snd) Snd.play('fire');
      this.tweens.add({
        targets: g, x: tgt.x, y: tgt.y, duration: 420, ease: 'Quad.easeOut',
        onUpdate: function () { g.setScale(2 + Math.sin(this.progress * Math.PI) * 1.2); },
        onComplete: function () {
          g.destroy();
          if (self.over) return;
          if (Snd) Snd.play('explosion', true);
          self.explodeAt(tgt.x, tgt.y, true);
          self.cameras.main.shake(120, 0.006);
          self.enemies.slice().forEach(function (e) {
            if (dist(tgt.x, tgt.y, e.chassis.x, e.chassis.y) <= 70) self.damageEnemy(e, 60);
          });
        }
      });
    },

    // Frag: 5-pellet spread, short range
    fire_frag: function () {
      var mx = this.player.x + Math.cos(this.turretAngle) * 18;
      var my = this.player.y + Math.sin(this.turretAngle) * 18;
      for (var i = 0; i < 5; i++) {
        var off = (i - 2) * 0.13;
        this.fireBullet(mx, my, this.turretAngle + off, true, 12, 520, false, { range: 260 });
      }
      if (Snd) Snd.play('fire');
      var fl = this.add.image(mx, my, 'star').setDepth(8).setScale(1.1).setAlpha(1);
      this.tweens.add({ targets: fl, scale: 1.8, alpha: 0, duration: 140, onComplete: function () { fl.destroy(); } });
    },

    // Smoke: 5s concealment zone at the player's feet
    fire_smoke: function () {
      var now = this.time.now;
      if (Snd) Snd.play('explosion', false);
      var c = this.add.circle(this.player.x, this.player.y, 70, 0xb8bec6, 0.38).setDepth(7);
      this.smoke.explode(14, this.player.x, this.player.y);
      this.smokeZones.push({ x: this.player.x, y: this.player.y, until: now + 5000, circle: c });
      this.floatText(this.player.x, this.player.y - 30, '烟雾遮蔽', '#a5ecff', 13);
    },

    // Missiles: up to 4 homing missiles at nearest enemies
    fire_missiles: function () {
      var self = this;
      var targets = this.enemies.slice().sort(function (a, b) {
        return dist(self.player.x, self.player.y, a.chassis.x, a.chassis.y) -
               dist(self.player.x, self.player.y, b.chassis.x, b.chassis.y);
      }).filter(function (e) {
        return dist(self.player.x, self.player.y, e.chassis.x, e.chassis.y) <= 480;
      }).slice(0, 4);
      if (!targets.length) { this.floatText(this.player.x, this.player.y - 30, '无锁定目标', '#ff9a1f', 13); return; }
      if (Snd) Snd.play('missile');
      targets.forEach(function (e, i) {
        var a = angleTo(self.player.x, self.player.y, e.chassis.x, e.chassis.y) + (i - (targets.length - 1) / 2) * 0.2;
        self.time.delayedCall(i * 120, function () {
          if (self.over) return;
          self.fireBullet(self.player.x, self.player.y, a, true, 30, 380, false,
            { homing: e, tint: 0xff9a1f });
        });
      });
    },

    // aim point for lobbed weapons: nearest enemy in range, else turret direction
    aimPoint: function (maxRange) {
      var best = null, bd = maxRange || 300;
      for (var i = 0; i < this.enemies.length; i++) {
        var e = this.enemies[i];
        var d = dist(this.player.x, this.player.y, e.chassis.x, e.chassis.y);
        if (d < bd) { bd = d; best = e; }
      }
      if (best) return { x: best.chassis.x, y: best.chassis.y };
      return {
        x: Phaser.Math.Clamp(this.player.x + Math.cos(this.turretAngle) * 200, 16, W - 16),
        y: Phaser.Math.Clamp(this.player.y + Math.sin(this.turretAngle) * 200, 16, H - 16)
      };
    },

    playerInSmoke: function () {
      var now = this.time.now, self = this;
      return this.smokeZones.some(function (z) {
        return now < z.until && dist(self.player.x, self.player.y, z.x, z.y) <= 70;
      });
    },

    explodeAt: function (x, y, big) {
      this.boom1.explode(big ? 22 : 12, x, y);
      this.boom2.explode(big ? 14 : 8, x, y);
      this.smoke.explode(big ? 10 : 5, x, y);
      // shockwave ring
      var ring = this.add.circle(x, y, 6).setStrokeStyle(big ? 4 : 3, big ? 0xff9a1f : 0xffd23e).setDepth(8);
      this.tweens.add({ targets: ring, scale: big ? 4.5 : 2.8, alpha: 0, duration: big ? 380 : 260, onComplete: function () { ring.destroy(); } });
    },

    floatText: function (x, y, str, color, size) {
      var t = this.add.text(x, y, str, {
        fontFamily: '"Fusion Pixel", sans-serif', fontSize: (size || 15) + 'px', color: color || '#ffd23e',
        stroke: '#101018', strokeThickness: 4
      }).setOrigin(0.5).setDepth(10);
      this.tweens.add({ targets: t, y: y - 26, alpha: 0, duration: 850, onComplete: function () { t.destroy(); } });
    },

    onBulletWall: function (bul, wall) {
      var x = bul.x, y = bul.y;
      bul.disableBody(true, true);
      if (wall.getData('brick')) {
        wall.disableBody(true, true);
        var bc = Math.floor(wall.x / TILE), br = Math.floor(wall.y / TILE);
        if (this.mapGrid[br] && this.mapGrid[br][bc] === '#') this.mapGrid[br][bc] = '.';
        this.explodeAt(x, y, false);
      } else {
        var s = this.add.image(x, y, 'star').setDepth(8).setScale(0.5);
        this.tweens.add({ targets: s, scale: 0.9, alpha: 0, duration: 150, onComplete: function () { s.destroy(); } });
      }
    },

    onPlayerBulletHit: function (bul, chassis) {
      var e = chassis.getData('enemy');
      var dmg = bul.getData('damage'), boom = bul.getData('explosive');
      var x = bul.x, y = bul.y;
      bul.disableBody(true, true);
      if (!e) return;
      this.floatText(x, y - 12, '-' + dmg, '#ffffff', 12);
      if (Snd) Snd.play('hit');
      this.damageEnemy(e, dmg);
      if (boom) {
        this.explodeAt(x, y, true);
        var self = this;
        this.enemies.slice().forEach(function (o) {
          if (o !== e && o.hp > 0 && dist(x, y, o.chassis.x, o.chassis.y) < 78) self.damageEnemy(o, Math.round(dmg * 0.6));
        });
      } else {
        this.explodeAt(x, y, false);
      }
    },

    damageEnemy: function (e, dmg) {
      if (e.hp <= 0) return;
      e.hp -= dmg;
      e.chassis.setTintFill(0xffffff);
      e.turret.setTintFill(0xffffff);
      var self = this;
      this.time.delayedCall(60, function () { e.chassis.clearTint(); e.turret.clearTint(); });
      if (e.hp <= 0) {
        var x = e.chassis.x, y = e.chassis.y;
        if (Snd) Snd.play('explosion', e.type === 'heavy' || e.type === 'boss');
        this.explodeAt(x, y, e.type === 'heavy' || e.type === 'boss');
        if (e.type === 'boss') {
          this.cameras.main.shake(400, 0.02);
          this.floatText(x, y - 30, 'BOSS 击破！ +500', '#ffd23e', 18);
        }
        this.cameras.main.shake(90, 0.006);
        var scrap = L.scrapForKill(e.type);
        this.run.kills++;
        this.run.scrap += scrap;
        var st = this.streak.kill(this.time.now);
        if (st.best > (this.run.bestStreak || 0)) this.run.bestStreak = st.best;
        this.floatText(x, y - 20, '+' + scrap + ' 废料', '#ffd23e');
        e.chassis.disableBody(true, true);
        e.turret.destroy();
        e.barBg.destroy(); e.barFg.destroy();
        this.enemies.splice(this.enemies.indexOf(e), 1);
      } else {
        e.barBg.setVisible(true); e.barFg.setVisible(true);
      }
    },

    onEnemyBulletHitPlayer: function (bul) {
      var dmg = bul.getData('damage');
      bul.disableBody(true, true);
      this.damagePlayer(dmg);
    },

    damagePlayer: function (dmg) {
      if (this.over || this.clearing) return;
      if (this.time.now < this.invulnUntil) return;
      this.invulnUntil = this.time.now + 600;
      this.playerHp -= dmg;
      if (Snd) Snd.play('explosion', false);
      this.player.setTintFill(0xff4444);
      this.turret.setTintFill(0xff4444);
      var self = this;
      this.time.delayedCall(120, function () { self.player.clearTint(); self.turret.clearTint(); });
      this.cameras.main.shake(120, 0.01);
      this.explodeAt(this.player.x, this.player.y, false);
      if (this.playerHp <= 0) {
        this.playerHp = 0;
        this.defeat('player');
      }
    },

    onEnemyBulletHitBase: function (bul) {
      var dmg = bul.getData('damage');
      var x = bul.x, y = bul.y;
      bul.disableBody(true, true);
      this.damageBase(dmg, x, y);
    },

    damageBase: function (dmg, x, y) {
      if (this.over || this.clearing) return;
      var rest = dmg;
      if (this.baseShield > 0) {
        var absorbed = Math.min(this.baseShield, rest);
        this.baseShield -= absorbed; rest -= absorbed;
      }
      if (rest > 0) this.baseHp -= rest;
      if (Snd) Snd.play('explosion', true);
      this.cameras.main.shake(140, 0.012);
      this.explodeAt(x, y, true);
      this.base.setTintFill(0xff4444);
      var self = this;
      this.time.delayedCall(120, function () { self.base.clearTint(); });
      if (this.baseHp <= 0) {
        this.baseHp = 0;
        this.defeat('base');
      }
    },

    defeat: function (reason) {
      if (this.over) return;
      this.over = true;
      if (Snd) Snd.play('defeat');
      var x = reason === 'base' ? this.base.x : this.player.x;
      var y = reason === 'base' ? this.base.y : this.player.y;
      this.explodeAt(x, y, true);
      this.explodeAt(x, y, true);
      if (reason === 'player') { this.player.setVisible(false); this.turret.setVisible(false); }
      else this.base.setAlpha(0.35);
      this.physics.pause();
      var self = this;
      this.time.delayedCall(1300, function () {
        self.run.endTime = Date.now();
        if (hooks.onDefeat) hooks.onDefeat(self.run, reason);
      });
    },

    floorClear: function () {
      if (this.clearing || this.over) return;
      this.clearing = true;
      if (Snd) Snd.play('floorClear');
      this.wave = this.wave; // waves counted on spawn exhaustion
      var t = this.add.text(W / 2, H / 2 - 40, '楼层清理完成!', {
        fontFamily: '"Fusion Pixel", sans-serif', fontSize: '30px', color: '#7ded8a',
        stroke: '#101018', strokeThickness: 6
      }).setOrigin(0.5).setDepth(10);
      this.tweens.add({ targets: t, scale: 1.15, duration: 300, yoyo: true });
      this.physics.pause();
      var self = this;
      this.time.delayedCall(1100, function () {
        if (hooks.onFloorClear) hooks.onFloorClear(self.run);
      });
    },

    update: function (time, delta) {
      if (!this.player || this.over || this.clearing) return;
      var dt = delta / 1000;

      // --- spawning ---
      if (this.spawnQueue.length) {
        this.spawnTimer -= delta;
        if (this.spawnTimer <= 0 && this.enemies.length < 4) {
          this.spawnTimer = 1500 + Math.random() * 700;
          this.spawnOne();
        }
      } else if (this.enemies.length === 0) {
        this.floorClear();
        return;
      }
      // wave counting: alive hit 0 while queue remains (only after first spawn)
      if (this._spawnedAny && this.spawnQueue.length && this.enemies.length === 0 && !this._waveCounted) {
        this._waveCounted = true;
        this.wave++;
      }
      if (this.enemies.length > 0) this._waveCounted = false;

      // --- player movement ---
      var mx = 0, my = 0;
      var k = this.keys;
      if (k.A.isDown || k.LEFT.isDown) mx -= 1;
      if (k.D.isDown || k.RIGHT.isDown) mx += 1;
      if (k.W.isDown || k.UP.isDown) my -= 1;
      if (k.S.isDown || k.DOWN.isDown) my += 1;
      if (mx === 0 && my === 0) { mx = input.mx; my = input.my; }
      var len = Math.hypot(mx, my);
      if (len > 1) { mx /= len; my /= len; }
      var spd = this.stats.speed;
      this.player.setVelocity(mx * spd, my * spd);
      if (len > 0.1) {
        var targetA = Math.atan2(my, mx);
        this.chassisAngle = lerpAngle(this.chassisAngle, targetA, Math.min(1, dt * 14));
      }
      this.player.setRotation(this.chassisAngle + Math.PI / 2);

      // --- turret aim ---
      var aimA = null;
      if (input.autoAim) {
        var best = null, bd = 460;
        for (var i = 0; i < this.enemies.length; i++) {
          var e = this.enemies[i];
          var d = dist(this.player.x, this.player.y, e.chassis.x, e.chassis.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) aimA = angleTo(this.player.x, this.player.y, best.chassis.x, best.chassis.y);
      }
      if (aimA === null) {
        var p = this.input.activePointer;
        if (p && p.isDown || (p && p.x !== 0 && !input.autoAim)) {
          // mouse aim (desktop): pointer world coords
          aimA = angleTo(this.player.x, this.player.y, p.worldX, p.worldY);
        } else if (len > 0.1) {
          aimA = Math.atan2(my, mx);
        }
      }
      if (aimA !== null && aimA !== undefined) {
        this.turretAngle = lerpAngle(this.turretAngle, aimA, Math.min(1, dt * 18));
      }
      this.turret.setPosition(this.player.x, this.player.y);
      this.turret.setRotation(this.turretAngle + Math.PI / 2);

      // --- weapon switching (keys 1-6) ---
      var numKeys = ['ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX'];
      for (var ni = 0; ni < numKeys.length; ni++) {
        if (Phaser.Input.Keyboard.JustDown(k[numKeys[ni]])) {
          if (this.setWeapon(L.WEAPONS[ni].id) && hooks.onWeaponSwitch) hooks.onWeaponSwitch(this.weapon);
        }
      }

      // --- firing ---
      if ((input.firing || k.SPACE.isDown) && !this.over) this.playerFire();

      // --- smoke zones expire ---
      if (this.smokeZones.length) {
        this.smokeZones = this.smokeZones.filter(function (z) {
          if (time >= z.until) { z.circle.destroy(); return false; }
          return true;
        });
      }

      // --- nano regen ---
      if (this.stats.nanoUntil > 0) {
        this.stats.nanoUntil -= dt;
        this.nanoTimer += dt;
        if (this.nanoTimer >= 1) {
          this.nanoTimer = 0;
          this.playerHp = Math.min(this.playerMaxHp, this.playerHp + (this.stats.nanoRate || 8));
        }
      }

      // --- invuln blink ---
      if (time < this.invulnUntil) {
        var a = 0.45 + 0.4 * Math.sin(time / 40);
        this.player.setAlpha(a); this.turret.setAlpha(a);
      } else { this.player.setAlpha(1); this.turret.setAlpha(1); }

      // --- player hp bar ---
      var pr = Math.max(0, this.playerHp / this.playerMaxHp);
      this.playerBarBg.setPosition(this.player.x, this.player.y - 24);
      this.playerBarFg.setPosition(this.player.x - 14 + 14 * pr, this.player.y - 24);
      this.playerBarFg.setScale(pr, 1);
      this.playerBarFg.setFillStyle(pr > 0.35 ? 0x3ecf5a : 0xe5484d);

      // --- enemies ---
      var self = this;
      this.enemies.slice().forEach(function (e) { self.updateEnemy(e, time, dt); });

      // --- bullet bounds / homing / range ---
      [this.playerBullets, this.enemyBullets].forEach(function (g) {
        g.getChildren().forEach(function (b) {
          if (!b.active) return;
          var tgt = b.getData('homing');
          if (tgt && tgt.hp > 0) {
            var ha = Math.atan2(tgt.chassis.y - b.y, tgt.chassis.x - b.x);
            var hs = b.getData('speed') || 380;
            b.setVelocity(Math.cos(ha) * hs, Math.sin(ha) * hs);
            b.setRotation(ha + Math.PI / 2);
          }
          if (b.x < -10 || b.x > W + 10 || b.y < -10 || b.y > H + 10) { b.disableBody(true, true); return; }
          var rg = b.getData('range');
          if (rg > 0) {
            var dx = b.x - b.getData('sx'), dy = b.y - b.getData('sy');
            if (dx * dx + dy * dy > rg * rg) b.disableBody(true, true);
          }
        });
      });

      // --- hud push ---
      this.hudTimer -= delta;
      if (this.hudTimer <= 0) {
        this.hudTimer = 120;
        if (hooks.onHud) hooks.onHud(this.getHud());
      }
    },

    updateEnemy: function (e, time, dt) {
      var c = e.chassis;
      if (!c.active) return;
      // EMP stun: frozen, cyan tint, cannot fire
      if (time < (e.stunnedUntil || 0)) {
        c.setVelocity(0, 0);
        c.setTintFill(0x35c8f0);
        if (e.turret) e.turret.setTintFill(0x35c8f0);
        return;
      }
      if (e.stunnedUntil) { e.stunnedUntil = 0; c.clearTint(); if (e.turret) e.turret.clearTint(); }
      // boss summon: every 8s call a scout escort (max 3 alive)
      if (e.type === 'boss' && time > (e.summonAt || 0)) {
        e.summonAt = time + 8000;
        var escorts = 0;
        for (var ei = 0; ei < this.enemies.length; ei++) if (this.enemies[ei].escort) escorts++;
        if (escorts < 3 && !this.over && !this.clearing) {
          var sx = Phaser.Math.Clamp(c.x + (Math.random() - 0.5) * 96, 24, W - 24);
          var sy = Phaser.Math.Clamp(c.y + (Math.random() - 0.5) * 96, 24, H - 24);
          this.spawnEscort(sx, sy);
          this.floatText(c.x, c.y - 34, '召唤增援', '#ff9a1f', 13);
        }
      }
      // retarget
      if (time > e.retargetAt) {
        e.retargetAt = time + 2000 + Math.random() * 2000;
        e.target = Math.random() < 0.7 ? 'player' : 'base';
      }
      var tx = e.target === 'player' ? this.player.x : this.base.x;
      var ty = e.target === 'player' ? this.player.y : this.base.y;
      var dx = tx - c.x, dy = ty - c.y;
      var d = Math.hypot(dx, dy) || 1;
      var nx = dx / d, ny = dy / d;
      var want = e.target === 'player' ? 190 : 30;
      var vx = 0, vy = 0;
      var blockedAhead = this.isBlockingTile(c.x + nx * 38, c.y + ny * 38);
      if (time < e.escapeUntil) {
        // wall-following: slide perpendicular until the direct path clears
        vx = Math.cos(e.escapeAngle) * e.def.speed;
        vy = Math.sin(e.escapeAngle) * e.def.speed;
        if (!blockedAhead && time > (e.escapeMinUntil || 0)) e.escapeUntil = 0;
      } else if (d > want) {
        if (blockedAhead) {
          // pick the perpendicular slide direction that is open and closer to target
          var px = -ny, py = nx;
          var p1x = c.x + px * 48, p1y = c.y + py * 48;
          var p2x = c.x - px * 48, p2y = c.y - py * 48;
          var b1 = this.isBlockingTile(p1x, p1y), b2 = this.isBlockingTile(p2x, p2y);
          var d1 = Math.hypot(tx - p1x, ty - p1y), d2 = Math.hypot(tx - p2x, ty - p2y);
          var sign = 1;
          if (b1 && !b2) sign = -1;
          else if (!b1 && b2) sign = 1;
          else sign = d1 <= d2 ? 1 : -1;
          e.escapeAngle = Math.atan2(py * sign, px * sign);
          e.escapeUntil = time + 2400;
          e.escapeMinUntil = time + 450;
          vx = Math.cos(e.escapeAngle) * e.def.speed;
          vy = Math.sin(e.escapeAngle) * e.def.speed;
        } else {
          vx = nx * e.def.speed; vy = ny * e.def.speed;
        }
      } else {
        // strafe around the player
        var s = (e.strafeDir || 1);
        vx = -ny * e.def.speed * 0.6 * s;
        vy = nx * e.def.speed * 0.6 * s;
        if (Math.random() < dt * 0.3) e.strafeDir = -s;
      }
      c.setVelocity(vx, vy);
      // stuck fallback (physics-blocked, e.g. by other tanks): random escape
      if (time > e.stuckAt) {
        e.stuckAt = time + 600;
        var moved = Math.hypot(c.x - e.lastX, c.y - e.lastY);
        if (moved < 5 && (Math.abs(vx) > 1 || Math.abs(vy) > 1) && time >= e.escapeUntil) {
          e.escapeAngle = Math.random() * Math.PI * 2;
          e.escapeUntil = time + 900;
          e.escapeMinUntil = time + 400;
        }
        e.lastX = c.x; e.lastY = c.y;
      }
      // chassis faces movement
      if (Math.hypot(vx, vy) > 10) {
        e.angle = lerpAngle(e.angle, Math.atan2(vy, vx), Math.min(1, dt * 10));
      }
      c.setRotation(e.angle + Math.PI / 2);
      // turret aims at player (or base)
      var aimX = e.target === 'player' ? this.player.x : this.base.x;
      var aimY = e.target === 'player' ? this.player.y : this.base.y;
      e.turretAngle = lerpAngle(e.turretAngle, angleTo(c.x, c.y, aimX, aimY), Math.min(1, dt * 8));
      e.turret.setPosition(c.x, c.y);
      e.turret.setRotation(e.turretAngle + Math.PI / 2);
      // hp bar
      if (e.hp < e.maxHp) {
        var r = Math.max(0, e.hp / e.maxHp);
        e.barBg.setPosition(c.x, c.y - 24);
        e.barFg.setPosition(c.x - 14 + 14 * r, c.y - 24);
        e.barFg.setScale(r, 1);
      }
      // fire
      if (time > e.fireAt && !this.over) {
        var pd = dist(c.x, c.y, this.player.x, this.player.y);
        var bd = dist(c.x, c.y, this.base.x, this.base.y);
        var range = e.def.range || 420;
        var tgt = null;
        var smoked = this.playerInSmoke();
        if (e.target === 'base' && bd < 320) tgt = { x: this.base.x, y: this.base.y };
        else if (pd < range && !smoked) tgt = { x: this.player.x, y: this.player.y };
        if (tgt) {
          e.fireAt = time + e.def.fireInterval * 1000 * (0.8 + Math.random() * 0.5);
          var self = this;
          // boss fires a 3-way spread; missile fires a 3-round burst
          var shots = e.type === 'boss' ? 3 : (e.def.burst || 1);
          for (var bi = 0; bi < shots; bi++) {
            (function (k) {
              self.time.delayedCall(k * 130, function () {
                if (e.hp <= 0 || self.over || self.clearing) return;
                var spread = e.type === 'boss' ? (k - 1) * 0.28 : 0;
                var a = angleTo(c.x, c.y, tgt.x, tgt.y) + spread + (Math.random() - 0.5) * 0.14;
                if (k === 0 && Snd) Snd.play('enemyFire');
                self.fireBullet(c.x + Math.cos(a) * 18, c.y + Math.sin(a) * 18, a, false, e.def.damage, e.def.bulletSpeed, false);
              });
            })(bi);
          }
        } else {
          e.fireAt = time + 500;
        }
      }
    }
  });

  function start(parentEl, data, hooksIn) {
    hooks = hooksIn || {};
    if (phaserGame) { try { phaserGame.destroy(true); } catch (err) {} phaserGame = null; }
    phaserGame = new Phaser.Game({
      type: Phaser.AUTO,
      parent: parentEl,
      width: W, height: H,
      backgroundColor: '#8a6a45',
      pixelArt: true,
      physics: { default: 'arcade', arcade: { debug: false } },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      scene: [BattleScene]
    });
    phaserGame.scene.start('Battle', data);
    return phaserGame;
  }

  function destroy() {
    if (phaserGame) { try { phaserGame.destroy(true); } catch (err) {} }
    phaserGame = null; sceneRef = null;
  }

  function setPaused(p) {
    if (!phaserGame) return;
    var sc = phaserGame.scene.getScene('Battle');
    if (!sc) return;
    if (p) { phaserGame.scene.pause('Battle'); if (sc.physics) sc.physics.pause(); }
    else { phaserGame.scene.resume('Battle'); if (sc.physics) sc.physics.resume(); }
  }

  function nextFloor(data) {
    if (!phaserGame) return;
    setPaused(false);
    // NOTE: SceneManager has no restart(); the ScenePlugin of the scene does.
    var sc = phaserGame.scene.getScene('Battle');
    if (sc) sc.scene.restart(data);
  }

  function getHud() {
    if (sceneRef && sceneRef.getHud) return sceneRef.getHud();
    return null;
  }

  function setWeapon(id) {
    var sc = sceneRef;
    if (sc && sc.setWeapon) return sc.setWeapon(id);
    return false;
  }

  global.RBGame = {
    start: start, destroy: destroy, setPaused: setPaused, nextFloor: nextFloor,
    getHud: getHud, setWeapon: setWeapon, input: input, W: W, H: H,
    _scene: function () { return sceneRef; } // test accessor
  };
})(typeof window !== 'undefined' ? window : globalThis);
