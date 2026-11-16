/* Node tests for js/logic.js (pure logic). Run: node tests/test-logic.js */
'use strict';
const L = require('../js/logic.js');
let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

// maps
t('maps validate', L.validateMaps().length === 0);
t('map size 15x20', L.COLS === 15 && L.ROWS === 20 && L.MAPS.length === 3);
t('base exists each floor', [1, 2, 3].every(f => !!L.findBase(f)));
t('base bottom area', L.findBase(1).row >= 17 && L.findBase(1).col === 7);
t('top row clear for spawns', L.MAPS.every(m => m[0] === '...............'));
t('player spawn (7,16) open ground', L.MAPS.every(m => m[16][7] === '.'));
t('no river above player spawn', L.MAPS.every(m => m[15][7] !== '~'));

// floors & composition
t('F1 count 10', L.floorEnemyCount(1) === 10);
t('F2 count 12', L.floorEnemyCount(2) === 12);
t('F3 count 14', L.floorEnemyCount(3) === 14);
t('F1 no heavy', L.floorComposition(1).indexOf('heavy') === -1);
t('F3 has 4 heavy', L.floorComposition(3).filter(x => x === 'heavy').length === 4);
t('composition length matches count', L.floorComposition(2).length === 12);

// phase 1: missile enemy + floor themes
t('missile def exists with burst+range', L.ENEMIES.missile && L.ENEMIES.missile.burst === 3 && L.ENEMIES.missile.range === 520);
t('F1 no missile', L.floorComposition(1).indexOf('missile') === -1);
t('F2 has 2 missile', L.floorComposition(2).filter(x => x === 'missile').length === 2);
t('F3 has 3 missile', L.floorComposition(3).filter(x => x === 'missile').length === 3);
t('composition length still matches', L.floorComposition(3).length === 14 && L.floorComposition(2).length === 12);
t('scrap missile 30', L.scrapForKill('missile') === 30);
t('floorTheme cycles', L.floorTheme(1) === 'grass' && L.floorTheme(2) === 'valley' && L.floorTheme(3) === 'steel' && L.floorTheme(4) === 'grass');

// phase 3: weapons
t('6 weapons, unique ids', L.WEAPONS.length === 6 && new Set(L.WEAPONS.map(w => w.id)).size === 6);
t('weaponById emp', L.weaponById('emp') && L.weaponById('emp').name === 'EMP脉冲');
t('weaponById unknown null', L.weaponById('nope') === null);
t('all weapons have desc+cooldown', L.WEAPONS.every(w => w.desc && w.cooldown > 0 && w.icon));
t('unlock F1 only pierce', eq(L.unlockedWeapons(1), ['pierce']));
t('unlock F2 adds emp', L.unlockedWeapons(2).indexOf('emp') >= 0 && L.unlockedWeapons(2).length === 2);
t('unlock F10 all 6', L.unlockedWeapons(10).length === 6);
t('unlock floors ascending', L.WEAPONS.every((w, i) => i === 0 || w.unlockFloor >= L.WEAPONS[i - 1].unlockFloor));

// draft
t('draft 3 distinct', (() => { const d = L.draftChoices(3, []); return d.length === 3 && new Set(d.map(u => u.id)).size === 3; })());
t('draft respects exclusions', (() => {
  const d = L.draftChoices(3, ['split', 'explosive', 'nano']);
  return d.every(u => ['velocity', 'armor', 'rapid'].indexOf(u.id) >= 0);
})());
t('draft terminates on degenerate rng', L.draftChoices(3, [], () => 0.5).length === 3);
t('draft pool small returns all', L.draftChoices(3, ['split', 'explosive', 'nano', 'velocity']).length === 2);
t('byId finds split', L.byId('split') && L.byId('split').name === '分裂炮管');
t('byId unknown null', L.byId('nope') === null);

// upgrades
const base = { hp: 100, maxHp: 120, projectiles: 1, bulletSpeed: 460, damage: 38, fireCooldown: 0.32, nanoUntil: 0 };
t('split +1 projectile', L.applyUpgrade(base, 'split').projectiles === 2);
t('explosive flag', L.applyUpgrade(base, 'explosive').explosive === true);
t('nano sets timer+rate', (() => { const s = L.applyUpgrade(base, 'nano'); return s.nanoUntil === 10 && s.nanoRate === 8; })());
t('velocity scales', (() => { const s = L.applyUpgrade(base, 'velocity'); return s.bulletSpeed === 621 && s.damage === 44; })());
t('armor +40 max and heal', (() => { const s = L.applyUpgrade(base, 'armor'); return s.maxHp === 160 && s.hp === 140; })());
t('armor heal capped', (() => { const s = L.applyUpgrade(Object.assign({}, base, { hp: 115 }), 'armor'); return s.hp === 155; })());
t('rapid -25% cooldown', L.applyUpgrade(base, 'rapid').fireCooldown === 0.24);
t('applyUpgrade does not mutate', base.projectiles === 1 && base.maxHp === 120);
t('unknown upgrade is identity', eq(L.applyUpgrade(base, 'zzz'), base));

// scrap & streak
t('scrap scout 10', L.scrapForKill('scout') === 10);
t('scrap heavy 40', L.scrapForKill('heavy') === 40);
t('scrap unknown 10', L.scrapForKill('zzz') === 10);
t('streak chains within window', (() => {
  const st = L.streakTracker(4000);
  st.kill(0); st.kill(3000); st.kill(6000);
  return st.best() === 3;
})());
t('streak resets after gap', (() => {
  const st = L.streakTracker(4000);
  st.kill(0); st.kill(3000); st.kill(9000); st.kill(12000);
  return st.best() === 2;
})());

// fmt
t('fmt 0:00', L.fmtTime(0) === '00:00');
t('fmt 14:23', L.fmtTime(863) === '14:23');
t('fmt 61:05', L.fmtTime(3665) === '61:05');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
