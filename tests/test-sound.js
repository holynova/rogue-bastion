/* Node tests for js/sound.js: must load and no-op safely without AudioContext. */
'use strict';
const S = require('../js/sound.js');
let pass = 0, fail = 0;
function t(name, cond) {
  if (cond) { pass++; console.log('PASS', name); }
  else { fail++; console.log('FAIL', name); }
}
t('loads in Node', !!S);
t('has all sfx names', ['fire', 'enemyFire', 'hit', 'explosion', 'pickup', 'floorClear', 'victory', 'defeat', 'click', 'denied', 'emp', 'missile'].every(n => S._names().indexOf(n) >= 0));
t('play unknown is safe', (() => { S.play('nope'); return true; })());
t('play each sfx is safe', (() => { S._names().forEach(n => S.play(n, true)); return true; })());
t('setEnabled toggles', (() => { S.setEnabled(false); const a = S.isEnabled(); S.setEnabled(true); return a === false && S.isEnabled() === true; })());
t('unlock is safe', (() => { S.unlock(); return true; })());
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
