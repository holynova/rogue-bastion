/* Rogue Bastion - code-drawn cartoon pixel art.
   Visual benchmark: v2 prototypes in ~/workspace/tank-compare/ui-prototypes/
   (a-battle-v2 / a-draft-v2 / a-menu-v2 / a-result-v2). Colors sampled from
   those images. Chunky pixels, thick black outlines, bright flat colors.
   Nothing here is cropped from the prototype images. */
(function (global) {
  'use strict';

  var K = '#101018'; // outline black

  /* ---------- palettes ---------- */
  var TANK_PALETTES = {
    player:  { G: '#3ecf5a', g: '#2a9e46', L: '#7ded8a', T: '#14532d', t: '#1f7a33', C: '#3a3f4a', Y: '#ffd23e', K: K },
    scout:   { G: '#b8bec6', g: '#8a919c', L: '#e8ecf0', T: '#4a4f58', t: '#646b75', C: '#3a3f4a', Y: '#e5484d', K: K },
    assault: { G: '#8a8f98', g: '#6b7078', L: '#b8bec6', T: '#3a3f4a', t: '#4a4f58', C: '#2b2f36', Y: '#ff9a1f', K: K },
    heavy:   { G: '#5b6068', g: '#43484f', L: '#8a919c', T: '#23262b', t: '#33373d', C: '#1d1f24', Y: '#e5484d', K: K },
    missile: { G: '#9a7bd6', g: '#7a5bb0', L: '#c4a8f0', T: '#3d2d5c', t: '#52407a', C: '#3a3f4a', Y: '#ff5c8a', K: K },
    boss:    { G: '#c23b4e', g: '#96283a', L: '#ff7a6b', T: '#3d1220', t: '#571a2c', C: '#1d1f24', Y: '#ffd23e', K: K }
  };

  /* 16x16 top-down tank, facing up. Cannon cols 7-8. */
  var TANK_MAP = [
    '.......KK.......',
    '.......CC.......',
    '.......CC.......',
    '..KKKKKKKKKKKK..',
    '..KTTKGGGGKTTK..',
    '..KTtKGGGGKTtK..',
    '..KTTKLCCLKTTK..',
    '..KTTKLCCLKTTK..',
    '..KTTKLLYLKTTK..',
    '..KTtKLLLLKTtK..',
    '..KTTKGGGGKTTK..',
    '..KTTKGGGGKTTK..',
    '..KTtKGGGGKTtK..',
    '..KTTKGGGGKTTK..',
    '..KKKKKKKKKKKK..',
    '................'
  ];

  /* Heavy variant: twin barrels (cols 6-9). */
  var HEAVY_MAP = [
    '......KKKK......',
    '......CCCC......',
    '......CCCC......',
    '..KKKKKKKKKKKK..',
    '..KTTKGGGGKTTK..',
    '..KTtKGGGGKTtK..',
    '..KTTKCCCCKTTK..',
    '..KTTKCCCCKTTK..',
    '..KTTKLLYLKTTK..',
    '..KTtKLLLLKTtK..',
    '..KTTKGGGGKTTK..',
    '..KTTKGGGGKTTK..',
    '..KTtKGGGGKTtK..',
    '..KTTKGGGGKTTK..',
    '..KKKKKKKKKKKK..',
    '................'
  ];

  /* Chassis (no cannon) + separate rotating turret, for independent aim. */
  var CHASSIS_MAP = [
    '................',
    '................',
    '................',
    '..KKKKKKKKKKKK..',
    '..KTTKGGGGKTTK..',
    '..KTtKGGGGKTtK..',
    '..KTTKKKKKKTTK..',
    '..KTTKKggKKTTK..',
    '..KTTKKggKKTTK..',
    '..KTTKKKKKKTTK..',
    '..KTTKGGGGKTTK..',
    '..KTTKGGGGKTTK..',
    '..KTtKGGGGKTtK..',
    '..KTTKGGGGKTTK..',
    '..KKKKKKKKKKKK..',
    '................'
  ];

  var TURRET_MAP = [
    '.......KK.......',
    '.......CC.......',
    '.......CC.......',
    '.......CC.......',
    '.......CC.......',
    '.....KKKKKK.....',
    '....KLLLLLLK....',
    '....KLLYYLLK....',
    '....KLLLLLLK....',
    '.....KKKKKK.....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................'
  ];

  var HEAVY_TURRET_MAP = [
    '......KKKK......',
    '......CCCC......',
    '......CCCC......',
    '......CCCC......',
    '......CCCC......',
    '.....KKKKKK.....',
    '....KLLLLLLK....',
    '....KLLYYLLK....',
    '....KLLLLLLK....',
    '.....KKKKKK.....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................'
  ];

  /* Scout turret: thin barrel + antenna with red tip. */
  var SCOUT_TURRET_MAP = [
    '.......KK...Y...',
    '.......CC...K...',
    '.......CC...K...',
    '.......CC.......',
    '.......CC.......',
    '.....KKKKKK.....',
    '....KLLLLLLK....',
    '....KLLYYLLK....',
    '....KLLLLLLK....',
    '.....KKKKKK.....',
    '................',
    '................',
    '................',
    '................',
    '................',
    '................'
  ];

  /* Missile turret: 3-tube rocket pod (no single cannon). */
  var MISSILE_TURRET_MAP = [
    '................',
    '................',
    '.....KKKKKK.....',
    '....KCCCCCCK....',
    '....KCYCCYCK....',
    '....KCCCCCCK....',
    '....KKKKKKKK....',
    '....KLLLLLLK....',
    '....KLLYYLLK....',
    '....KLLLLLLK....',
    '.....KKKKKK.....',
    '................',
    '................',
    '................',
    '................',
    '................'
  ];

  /* 8x8 bullets. */
  var BULLET_PLAYER = [
    '...YY...',
    '..YOOY..',
    '.YOOOWY.',
    '.YOWWWY.',
    '.YOOOWY.',
    '..YOOY..',
    '...YY...',
    '........'
  ];
  var BULLET_ENEMY = [
    '...RR...',
    '..RWWR..',
    '.RWWWWR.',
    '.RWWWWR.',
    '.RWWWWR.',
    '..RWWR..',
    '...RR...',
    '........'
  ];
  var BULLET_PAL = { Y: '#ffd23e', O: '#ff9a1f', W: '#fff7d6', R: '#e5484d', K: K };

  /* 12x12 muzzle / spawn star. */
  var STAR_MAP = [
    '.....YY.....',
    '.....YY.....',
    '..Y..YY..Y..',
    '..YYYWWYYY..',
    '....WWWW....',
    'YYYYWWWWYYYY',
    'YYYYWWWWYYYY',
    '....WWWW....',
    '..YYYWWYYY..',
    '..Y..YY..Y..',
    '.....YY.....',
    '.....YY.....'
  ];
  var STAR_PAL = { Y: '#ffd23e', W: '#fff7d6', K: K };

  /* ---------- DOM icon maps (12x12 unless noted) ---------- */
  var ICONS = {
    bullet: { pal: { Y: '#ffd23e', O: '#ff9a1f', K: K }, map: [
      '.....KK.....',
      '....KYYK....',
      '....KYYK....',
      '...KOYYOK...',
      '...KOYYOK...',
      '...KOYYOK...',
      '...KOYYOK...',
      '...KOOOOK...',
      '....KKKK....',
      '............',
      '............',
      '............'
    ] },
    lock: { pal: { S: '#8a919c', s: '#5b6068', K: K, Y: '#ffd23e' }, map: [
      '....KKKK....',
      '...K....K...',
      '...K....K...',
      '...K....K...',
      '..KKKKKKKK..',
      '..KSSSSSSK..',
      '..KSSYYSSK..',
      '..KSSYYSSK..',
      '..KSSSSSSK..',
      '..KSSSSSSK..',
      '..KKKKKKKK..',
      '............'
    ] },
    split: { pal: { B: '#2f9df0', b: '#1c6ec2', W: '#eaf7ff', K: K }, map: [
      'KK........KK',
      'KBK......KBK',
      '.KBK....KBK.',
      '..KBK..KBK..',
      '...KBKKBK...',
      '....KBBK....',
      '...KBKKBK...',
      '..KBK..KBK..',
      '.KBK....KBK.',
      'KBK......KBK',
      'KK........KK',
      '............'
    ] },
    bomb: { pal: { B: '#2b2f36', b: '#4a4f58', W: '#fff7d6', Y: '#ffd23e', K: K }, map: [
      '.....YY.....',
      '....KYWK....',
      '.....KK.....',
      '....KKKK....',
      '...KBBBBK...',
      '..KBBWBBBK..',
      '..KBBBBBBK..',
      '..KBBbBBBK..',
      '..KBBBBBBK..',
      '...KBBBBK...',
      '....KKKK....',
      '............'
    ] },
    nano: { pal: { G: '#f97316', g: '#c2570b', W: '#fff7d6', K: K }, map: [
      '.....KK.....',
      '..K.KGGK.K..',
      '..KGGGGGGK..',
      '.KGGWGGGGGK.',
      '.KGGGGGGGGK.',
      'KKGGKWWKGGKK',
      'KKGGKWWKGGKK',
      '.KGGGGGGGGK.',
      '.KGGWGGGGGK.',
      '..KGGGGGGK..',
      '..K.KGGK.K..',
      '.....KK.....'
    ] },
    bolt: { pal: { Y: '#ffd23e', O: '#ff9a1f', K: K }, map: [
      '......KKK...',
      '.....KYYYK..',
      '....KYYYK...',
      '...KYYYYK...',
      '..KKKYYYK...',
      '....KYYYK...',
      '....KYYYK...',
      '...KYYYK....',
      '...KYYYK....',
      '..KYYYK.....',
      '..KYYK......',
      '..KKK.......'
    ] },
    shield: { pal: { B: '#35c8f0', b: '#1a8fc0', W: '#eaf7ff', K: K }, map: [
      '..KKKKKKKK..',
      '.KBBBBBBBBK.',
      '.KBWWBBWWBK.',
      '.KBWWBBWWBK.',
      '.KBBBBBBBBK.',
      '.KBBWWBBBBK.',
      '.KBBBWWBBBK.',
      '..KBBWWBBK..',
      '..KBBBWBK...',
      '...KBBBBK...',
      '....KBBK....',
      '.....KK.....'
    ] },
    clock: { pal: { W: '#eaf7ff', B: '#35c8f0', K: K }, map: [
      '....KKKK....',
      '..KKWWWWKK..',
      '.KWWWWWWWWK.',
      '.KWWKKWWWWK.',
      '.KWWKWWWWWK.',
      '.KWWKWWWWWK.',
      '.KWWKWWWKKK.',
      '.KWWWWWWWWK.',
      '..KKWWWWKK..',
      '....KKKK....',
      '............',
      '............'
    ] },
    gear: { pal: { B: '#35c8f0', b: '#1a8fc0', K: K }, map: [
      '.....KK.....',
      '..K.KBBK.K..',
      '..KBBBBBBK..',
      '.KBBBKKBBBK.',
      '.KBBKBBKBBK.',
      'KKBBKBBKBBKK',
      'KKBBKBBKBBKK',
      '.KBBKBBKBBK.',
      '.KBBBKKBBBK.',
      '..KBBBBBBK..',
      '..K.KBBK.K..',
      '.....KK.....'
    ] },
    trophy: { pal: { Y: '#ffd23e', O: '#ff9a1f', K: K }, map: [
      'K.KKKKKKKK.K',
      'KYKYYYYYYKYK',
      'KYKYYYYYYKYK',
      '.KYKYYYYKYK.',
      '..KYYYYYYK..',
      '...KYYYYK...',
      '....KYYK....',
      '...KKYYKK...',
      '..KYYYYYYK..',
      '..KKKKKKKK..',
      '............',
      '............'
    ] },
    emp: { pal: { B: '#35c8f0', b: '#1a8fc0', Y: '#ffd23e', K: K }, map: [
      '....KKKK....',
      '..KKBBBBKK..',
      '.KBKYYYYKBK.',
      '.KBKYYYKBBK.',
      '.KBKYYKBBBK.',
      '.KBKYYKBBBK.',
      '.KBKYYKBBBK.',
      '.KBKYYKBBBK.',
      '..KBBBBBBK..',
      '....KKKK....',
      '............',
      '............'
    ] },
    grenade: { pal: { G: '#3ecf5a', g: '#2a9e46', Y: '#ffd23e', K: K }, map: [
      '.....KK.....',
      '....KYYK....',
      '....KYYK....',
      '...KKKKKK...',
      '..KGGGGGGK..',
      '.KGGGGGGGGK.',
      '.KGGgGGgGGK.',
      '.KGGGGGGGGK.',
      '..KGGGGGGK..',
      '...KKKKKK...',
      '............',
      '............'
    ] },
    frag: { pal: { O: '#ff9a1f', Y: '#ffd23e', K: K }, map: [
      'KK........KK',
      'KYKK....KKYK',
      '.KYK....KYK.',
      '..KYK..KYK..',
      '...KYKYK....',
      '....KYK.....',
      '...KYOYK....',
      '..KYOOOYK...',
      '..KYOYYYK...',
      '...KKKKK....',
      '............',
      '............'
    ] },
    smoke: { pal: { S: '#b8bec6', s: '#8a919c', K: K }, map: [
      '....KKKK....',
      '..KKSSSSKK..',
      '.KSSSSSSSSK.',
      '.KSSssSSSSK.',
      'KSSSSSSSSSSK',
      'KSSssSSssSSK',
      'KSSSSSSSSSSK',
      '.KSSSSSSSSK.',
      '..KKKKKKKK..',
      '............',
      '............',
      '............'
    ] },
    missiles: { pal: { W: '#eaf7ff', R: '#e5484d', O: '#ff9a1f', K: K }, map: [
      '..K...K...K.',
      '.KWK.KWK.KWK',
      '.KWK.KWK.KWK',
      '.KWK.KRK.KWK',
      '.KWK.KWK.KWK',
      '..K...K...K.',
      '.KOK.KOK.KOK',
      '.KOK.KOK.KOK',
      '..K...K...K.',
      '............',
      '............',
      '............'
    ] },
    cube: { pal: { B: '#35c8f0', b: '#1a8fc0', L: '#a5ecff', K: K }, map: [
      '.....KK.....',
      '...KKLLKK...',
      '.KKLLLLLLKK.',
      '.KLLLLLLLLK.',
      '.KLLKKKKLLK.',
      '.KLKBBBBKLK.',
      '.KLKBBBBKLK.',
      '.KLLKBBBKLLK',
      '..KKLLLLKK..',
      '....KKKK....',
      '............',
      '............'
    ] }
  };

  /* Side-view Q tank for the menu button (16x12). Bright hull + cannon. */
  var TANK_SIDE_MAP = [
    '................',
    '......KKKK......',
    '.....KYYYYK.....',
    '....KYYYYYYK.CCC',
    '....KYKYYKYK.CCC',
    '..KKKKKKKKKKKK..',
    '..KGGGGGGGGGGK..',
    '..KGGGGGGGGGGK..',
    '..KTTTTTTTTTTK..',
    '..KKKKKKKKKKKK..',
    '................',
    '................'
  ];
  var TANK_SIDE_PAL = { Y: '#ffb020', G: '#3ecf5a', T: '#14532d', C: '#3a3f4a', K: K };

  /* ---------- helpers ---------- */
  function hash2(x, y) {
    var h = (x * 374761393 + y * 668265263) | 0;
    h = (h ^ (h >> 13)) | 0;
    h = Math.imul(h, 1274126177);
    return ((h ^ (h >> 16)) >>> 0) / 4294967295;
  }

  function makeCanvas(w, h) {
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function renderMap(map, pal, scale) {
    scale = scale || 1;
    var h = map.length, w = map[0].length;
    var c = makeCanvas(w * scale, h * scale);
    var ctx = c.getContext('2d');
    for (var y = 0; y < h; y++) {
      var row = map[y];
      if (row.length !== w) throw new Error('sprite row ' + y + ' length ' + row.length + ' != ' + w);
      for (var x = 0; x < w; x++) {
        var ch = row[x];
        if (ch === '.' || ch === ' ') continue;
        var col = pal[ch];
        if (!col) throw new Error('sprite char "' + ch + '" has no palette color');
        ctx.fillStyle = col;
        ctx.fillRect(x * scale, y * scale, scale, scale);
      }
    }
    return c;
  }

  /* Ground palettes per floor theme. */
  var GROUND_PAL = {
    grass:  { base: '#79ad54', dark: '#649640', light: '#93c46d', tuft: '#4e8a35' },
    valley: { base: '#8a6a45', dark: '#75572f', light: '#a07d52', tuft: '#5da24a' },
    steel:  { base: '#7d7768', dark: '#68625a', light: '#948d7e', tuft: '#5d7a4a' }
  };

  /* Procedural 16x16 tiles, drawn at `scale` (2 => 32px).
     `theme` ('grass'|'valley'|'steel') tints the ground family. */
  function drawTile(type, scale, tx, ty, theme) {
    scale = scale || 2;
    var S = 16 * scale;
    var c = makeCanvas(S, S);
    var ctx = c.getContext('2d');
    function px(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x * scale, y * scale, scale, scale); }
    function rect(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x * scale, y * scale, w * scale, h * scale); }
    var i, x, y;
    var gp = GROUND_PAL[theme] || GROUND_PAL.valley;
    if (type === 'ground') {
      rect(0, 0, 16, 16, gp.base);
      for (i = 0; i < 14; i++) {
        x = Math.floor(hash2(tx * 31 + i, ty * 17 + i) * 16);
        y = Math.floor(hash2(tx * 13 + i * 3, ty * 29 + i) * 16);
        px(x, y, hash2(i, tx + ty) > 0.5 ? gp.dark : gp.light);
      }
      for (i = 0; i < 4; i++) {
        x = Math.floor(hash2(tx * 7 + i * 11, ty * 3 + i) * 16);
        y = Math.floor(hash2(tx * 5 + i, ty * 11 + i * 7) * 16);
        px(x, y, gp.tuft);
      }
    } else if (type === 'grass') {
      rect(0, 0, 16, 16, theme === 'steel' ? '#5d8a4a' : '#6db654');
      for (i = 0; i < 16; i++) {
        x = Math.floor(hash2(tx * 31 + i, ty * 17 + i) * 16);
        y = Math.floor(hash2(tx * 13 + i * 3, ty * 29 + i) * 16);
        px(x, y, hash2(i, tx + ty) > 0.5 ? '#5da24a' : '#82cc6a');
      }
      // grass blades
      for (i = 0; i < 5; i++) {
        x = 1 + Math.floor(hash2(tx * 11 + i, ty * 5) * 14);
        y = 1 + Math.floor(hash2(tx * 5 + i, ty * 11) * 13);
        px(x, y, '#4e8a35'); px(x, y + 1, '#82cc6a');
      }
    } else if (type === 'path') {
      // packed dirt road with wheel ruts
      rect(0, 0, 16, 16, '#a8895c');
      rect(0, 4, 16, 2, '#7a6242');
      rect(0, 11, 16, 2, '#7a6242');
      for (i = 0; i < 10; i++) {
        x = Math.floor(hash2(tx * 29 + i, ty * 19 + i) * 16);
        y = Math.floor(hash2(tx * 17 + i * 3, ty * 23 + i) * 16);
        px(x, y, hash2(i, tx + ty) > 0.5 ? '#8a6f4a' : '#c2a878');
      }
    } else if (type === 'crater') {
      // shell crater: dark pit with raised rim
      rect(0, 0, 16, 16, gp.base);
      for (i = 0; i < 8; i++) {
        x = Math.floor(hash2(tx * 31 + i, ty * 17 + i) * 16);
        y = Math.floor(hash2(tx * 13 + i * 3, ty * 29 + i) * 16);
        px(x, y, gp.dark);
      }
      rect(4, 3, 8, 10, '#5d4630');
      rect(5, 4, 6, 8, '#4a3626');
      rect(6, 5, 4, 6, '#3a2a1e');
      rect(4, 12, 8, 1, gp.light);
      px(5, 6, '#6b5138'); px(10, 9, '#6b5138');
    } else if (type === 'gravel') {
      rect(0, 0, 16, 16, '#8d8880');
      for (i = 0; i < 18; i++) {
        x = Math.floor(hash2(tx * 31 + i, ty * 17 + i) * 16);
        y = Math.floor(hash2(tx * 13 + i * 3, ty * 29 + i) * 16);
        var gcol = ['#6b6660', '#a8a39c', '#7a756e', '#b5b0a8'][Math.floor(hash2(i, tx + ty) * 4)];
        px(x, y, gcol);
      }
      rect(3, 4, 2, 2, '#5d5852'); rect(11, 10, 2, 2, '#5d5852'); rect(6, 12, 2, 1, '#a8a39c');
    } else if (type === 'flowers') {
      rect(0, 0, 16, 16, '#6db654');
      for (i = 0; i < 10; i++) {
        x = Math.floor(hash2(tx * 31 + i, ty * 17 + i) * 16);
        y = Math.floor(hash2(tx * 13 + i * 3, ty * 29 + i) * 16);
        px(x, y, hash2(i, tx + ty) > 0.5 ? '#5da24a' : '#82cc6a');
      }
      var petals = ['#ffffff', '#ffd23e', '#ff8ab0', '#ffffff'];
      for (i = 0; i < 4; i++) {
        x = 2 + Math.floor(hash2(tx * 7 + i * 5, ty * 3 + i) * 12);
        y = 2 + Math.floor(hash2(tx * 3 + i, ty * 7 + i * 5) * 12);
        px(x, y, petals[i]); px(x + 1, y, '#4e8a35'); px(x, y + 1, '#4e8a35');
      }
    } else if (type === 'brick') {
      rect(0, 0, 16, 16, '#c25a33');
      rect(0, 0, 16, 1, '#e07a4a');
      rect(0, 7, 16, 1, '#7c3418');
      rect(0, 15, 16, 1, '#7c3418');
      rect(7, 1, 1, 6, '#7c3418');
      rect(3, 8, 1, 7, '#7c3418');
      rect(11, 8, 1, 7, '#7c3418');
      rect(0, 0, 1, 16, '#7c3418');
      rect(15, 0, 1, 16, '#7c3418');
      px(2, 2, '#e07a4a'); px(10, 3, '#e07a4a'); px(5, 10, '#e07a4a'); px(13, 12, '#e07a4a');
    } else if (type === 'steel') {
      rect(0, 0, 16, 16, '#9aa3ad');
      rect(0, 0, 16, 2, '#c7ced6');
      rect(0, 14, 16, 2, '#6b7280');
      rect(0, 0, 1, 16, '#6b7280');
      rect(15, 0, 1, 16, '#6b7280');
      rect(0, 7, 16, 1, '#6b7280');
      px(2, 2, '#e8ecf0'); px(13, 2, '#e8ecf0'); px(2, 12, '#e8ecf0'); px(13, 12, '#e8ecf0');
      px(2, 2, '#4a4f58'); px(13, 2, '#4a4f58'); px(2, 12, '#4a4f58'); px(13, 12, '#4a4f58');
    } else if (type === 'river') {
      rect(0, 0, 16, 16, '#2b8ff0');
      rect(0, 3, 16, 1, '#35c8ff');
      rect(0, 11, 16, 1, '#1a5fc0');
      for (i = 0; i < 3; i++) {
        x = 2 + Math.floor(hash2(tx * 7 + i, ty * 3) * 11);
        y = 1 + Math.floor(hash2(tx * 3 + i, ty * 7) * 13);
        px(x, y, '#eaf7ff');
      }
      px(4, 6, '#35c8ff'); px(11, 8, '#35c8ff'); px(7, 13, '#35c8ff');
    } else if (type === 'bush') {
      rect(0, 0, 16, 16, '#8a6a45');
      var leaf = ['#3fae4e', '#2a8a3a', '#7ded8a'];
      for (y = 2; y < 14; y++) for (x = 1; x < 15; x++) {
        var r = hash2(tx * 16 + x, ty * 16 + y);
        if (r > 0.32) px(x, y, leaf[Math.floor(r * 3) % 3]);
      }
      px(3, 3, '#7ded8a'); px(12, 5, '#7ded8a'); px(6, 11, '#7ded8a');
    }
    return c;
  }

  /* 32x32 shield core base. */
  function drawBase(scale) {
    scale = scale || 2;
    var S = 32 * scale;
    var c = makeCanvas(S, S);
    var ctx = c.getContext('2d');
    function px(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x * scale, y * scale, scale, scale); }
    function rect(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x * scale, y * scale, w * scale, h * scale); }
    // pedestal
    rect(4, 24, 24, 6, '#3a3f4a');
    rect(4, 24, 24, 2, '#5b6068');
    rect(2, 28, 28, 2, '#23262b');
    // gold frame ring
    rect(8, 4, 16, 2, '#ffd23e');
    rect(8, 22, 16, 2, '#ffd23e');
    rect(6, 6, 2, 16, '#ffd23e');
    rect(24, 6, 2, 16, '#ffd23e');
    rect(6, 4, 4, 2, '#f59e0b'); rect(22, 4, 4, 2, '#f59e0b');
    rect(6, 22, 4, 2, '#f59e0b'); rect(22, 22, 4, 2, '#f59e0b');
    // crystal
    rect(10, 8, 12, 12, '#35c8f0');
    rect(12, 6, 8, 2, '#35c8f0');
    rect(12, 20, 8, 2, '#35c8f0');
    rect(13, 10, 6, 8, '#a5ecff');
    rect(14, 11, 3, 6, '#ffffff');
    px(11, 9, '#ffffff'); px(19, 18, '#1a8fc0'); px(19, 9, '#1a8fc0');
    // corner bolts
    px(8, 6, '#fff7d6'); px(23, 6, '#fff7d6'); px(8, 21, '#fff7d6'); px(23, 21, '#fff7d6');
    return c;
  }

  /* Battlefield decorations (16x16, transparent background, drawn at scale 2).
     Purely visual: no collision, placed on open ground tiles. */
  function drawDecor(kind, scale) {
    scale = scale || 2;
    var S = 16 * scale;
    var c = makeCanvas(S, S);
    var ctx = c.getContext('2d');
    function px(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x * scale, y * scale, scale, scale); }
    function rect(x, y, w, h, col) { ctx.fillStyle = col; ctx.fillRect(x * scale, y * scale, w * scale, h * scale); }
    if (kind === 'wreck') {
      // burnt-out tank hull, barrel snapped off
      rect(2, 5, 12, 7, '#23262b');
      rect(3, 6, 10, 5, '#3a3f4a');
      rect(4, 4, 6, 3, '#2b2f36');
      rect(5, 2, 5, 1, '#2b2f36');
      px(6, 1, '#4a4f58'); px(7, 1, '#4a4f58');
      rect(10, 7, 4, 1, '#1d1f24');
      px(3, 7, '#c2570b'); px(11, 9, '#c2570b'); px(6, 10, '#c2570b');
      px(2, 12, '#4a4f58'); px(13, 12, '#4a4f58'); px(5, 13, '#4a4f58');
    } else if (kind === 'barrel') {
      rect(5, 2, 6, 12, '#b3541e');
      rect(5, 2, 6, 2, '#e07a4a');
      rect(5, 6, 6, 1, '#7c3418');
      rect(5, 10, 6, 1, '#7c3418');
      rect(5, 13, 6, 1, '#7c3418');
      rect(5, 2, 1, 12, '#8a3c14');
      rect(10, 2, 1, 12, '#8a3c14');
      px(6, 4, '#ffd23e'); px(8, 8, '#ffd23e');
    } else if (kind === 'sandbag') {
      rect(2, 9, 12, 4, '#c2a878');
      rect(4, 5, 8, 4, '#c2a878');
      rect(6, 2, 4, 3, '#c2a878');
      rect(2, 12, 12, 1, '#8a6a45');
      rect(4, 8, 8, 1, '#8a6a45');
      px(4, 10, '#8a6a45'); px(9, 10, '#8a6a45'); px(6, 6, '#8a6a45');
      px(3, 9, '#e8d5a8'); px(10, 6, '#e8d5a8');
    } else if (kind === 'rock') {
      rect(4, 6, 8, 6, '#9aa3ad');
      rect(5, 4, 6, 2, '#b8bec6');
      rect(4, 11, 8, 1, '#5b6068');
      px(5, 6, '#e8ecf0'); px(10, 7, '#e8ecf0');
      px(3, 11, '#6b7280'); px(12, 11, '#6b7280');
    } else if (kind === 'tuft') {
      px(7, 10, '#2f9e44'); px(8, 10, '#2f9e44');
      px(6, 8, '#3ecf5a'); px(8, 7, '#3ecf5a'); px(9, 9, '#3ecf5a');
      px(7, 6, '#7ded8a'); px(10, 8, '#7ded8a'); px(5, 9, '#7ded8a');
      px(7, 11, '#1f7a33'); px(9, 11, '#1f7a33');
    }
    return c;
  }

  /* Menu backdrop: pixel sky, clouds, ruins, ground. w/h in CSS pixels. */
  function menuBackdrop(w, h) {
    var S = 4; // pixel size
    var cols = Math.ceil(w / S), rows = Math.ceil(h / S);
    var c = makeCanvas(cols * S, rows * S);
    var ctx = c.getContext('2d');
    function px(x, y, col) { ctx.fillStyle = col; ctx.fillRect(x * S, y * S, S, S); }
    function rect(x, y, rw, rh, col) { ctx.fillStyle = col; ctx.fillRect(x * S, y * S, rw * S, rh * S); }
    var x, y, i;
    // sky bands
    var sky = ['#2f9df0', '#38b0f5', '#42c2fa', '#54d2ff'];
    for (y = 0; y < rows; y++) {
      var band = Math.min(3, Math.floor(y / rows * 4));
      rect(0, y, cols, 1, sky[band]);
    }
    // clouds (pixel blobs)
    var clouds = [[4, 6, 14], [cols - 20, 10, 18], [Math.floor(cols * 0.45), 4, 12], [8, 22, 10], [cols - 14, 26, 12]];
    clouds.forEach(function (cl) {
      var cx = cl[0], cy = cl[1], cw = cl[2];
      rect(cx, cy + 1, cw, 2, '#ffffff');
      rect(cx + 2, cy, cw - 4, 1, '#ffffff');
      rect(cx + 1, cy + 3, cw - 2, 1, '#d6ecff');
    });
    // sparkles
    for (i = 0; i < 8; i++) {
      x = Math.floor(hash2(i, 7) * cols); y = Math.floor(hash2(i, 13) * rows * 0.4);
      px(x, y, '#fff7d6'); px(x + 1, y, '#ffd23e'); px(x, y + 1, '#ffd23e');
    }
    // ruins silhouette band
    var groundY = Math.floor(rows * 0.72);
    var bx = 0;
    while (bx < cols) {
      var bw = 8 + Math.floor(hash2(bx, 3) * 12);
      var bh = 8 + Math.floor(hash2(bx, 5) * 18);
      var shade = hash2(bx, 9) > 0.5 ? '#6b5a44' : '#7d6a52';
      rect(bx, groundY - bh, bw, bh, shade);
      // broken top notches
      rect(bx + 1, groundY - bh, 2, 2, sky[3]);
      if (bw > 12) rect(bx + bw - 4, groundY - bh, 2, 3, sky[3]);
      // windows
      var wy = groundY - bh + 4;
      if (bh > 12) { rect(bx + 2, wy, 2, 3, '#2b2f36'); if (bw > 12) rect(bx + bw - 4, wy, 2, 3, '#2b2f36'); }
      bx += bw + 2;
    }
    // ground
    rect(0, groundY, cols, rows - groundY, '#8a6a45');
    rect(0, groundY, cols, 1, '#a07d52');
    for (i = 0; i < 120; i++) {
      x = Math.floor(hash2(i, 21) * cols);
      y = groundY + Math.floor(hash2(i, 23) * (rows - groundY));
      px(x, y, hash2(i, 29) > 0.5 ? '#75572f' : '#a07d52');
    }
    // rubble blocks + gears
    for (i = 0; i < 10; i++) {
      x = Math.floor(hash2(i, 31) * (cols - 4));
      y = groundY + 2 + Math.floor(hash2(i, 37) * (rows - groundY - 4));
      rect(x, y, 3, 2, i % 2 ? '#5b6068' : '#9aa3ad');
      rect(x, y, 3, 1, '#c7ced6');
    }
    // Q版坦克停在地面上（原型主菜单同款）。
    // NOTE: backdrop is shown with object-fit: cover, so the sides get cropped
    // on narrow screens — keep the tank inside the middle 60% horizontally.
    var tank = tankSideCanvas(6); // 16x12 map -> 96x72 px
    ctx.drawImage(tank, Math.floor(cols * S * 0.56) - Math.floor(tank.width / 2), groundY * S - tank.height + 8);
    // grass tufts near the tank
    for (i = 0; i < 6; i++) {
      x = Math.floor(cols * 0.42) + Math.floor(hash2(i, 41) * 30);
      y = groundY + 1 + Math.floor(hash2(i, 43) * 4);
      rect(x, y, 1, 2, '#2f9e44'); rect(x + 1, y + 1, 1, 1, '#3ecf5a');
    }
    return c;
  }

  /* Build all Phaser textures from canvases. Call inside scene preload/create. */
  function buildTextures(scene) {
    var tex = scene.textures;
    function add(key, canvas) {
      if (tex.exists(key)) tex.remove(key);
      tex.addCanvas(key, canvas);
    }
    add('tank-player', renderMap(TANK_MAP, TANK_PALETTES.player, 2));
    add('tank-scout', renderMap(TANK_MAP, TANK_PALETTES.scout, 2));
    add('tank-assault', renderMap(TANK_MAP, TANK_PALETTES.assault, 2));
    add('tank-heavy', renderMap(HEAVY_MAP, TANK_PALETTES.heavy, 2));
    add('tank-missile', renderMap(TANK_MAP, TANK_PALETTES.missile, 2));
    add('tank-boss', renderMap(HEAVY_MAP, TANK_PALETTES.boss, 2));
    add('chassis-player', renderMap(CHASSIS_MAP, TANK_PALETTES.player, 2));
    add('chassis-scout', renderMap(CHASSIS_MAP, TANK_PALETTES.scout, 2));
    add('chassis-assault', renderMap(CHASSIS_MAP, TANK_PALETTES.assault, 2));
    add('chassis-heavy', renderMap(CHASSIS_MAP, TANK_PALETTES.heavy, 2));
    add('chassis-missile', renderMap(CHASSIS_MAP, TANK_PALETTES.missile, 2));
    add('chassis-boss', renderMap(CHASSIS_MAP, TANK_PALETTES.boss, 2));
    add('turret-player', renderMap(TURRET_MAP, TANK_PALETTES.player, 2));
    add('turret-scout', renderMap(SCOUT_TURRET_MAP, TANK_PALETTES.scout, 2));
    add('turret-assault', renderMap(TURRET_MAP, TANK_PALETTES.assault, 2));
    add('turret-heavy', renderMap(HEAVY_TURRET_MAP, TANK_PALETTES.heavy, 2));
    add('turret-missile', renderMap(MISSILE_TURRET_MAP, TANK_PALETTES.missile, 2));
    add('turret-boss', renderMap(HEAVY_TURRET_MAP, TANK_PALETTES.boss, 2));
    add('bullet-player', renderMap(BULLET_PLAYER, BULLET_PAL, 2));
    add('bullet-enemy', renderMap(BULLET_ENEMY, BULLET_PAL, 2));
    add('star', renderMap(STAR_MAP, STAR_PAL, 2));
    add('tile-ground', drawTile('ground', 2, 1, 1));
    add('tile-ground2', drawTile('ground', 2, 5, 9));
    add('tile-grass', drawTile('grass', 2, 3, 7));
    add('tile-path', drawTile('path', 2, 2, 6));
    add('tile-crater', drawTile('crater', 2, 8, 3));
    add('tile-gravel', drawTile('gravel', 2, 6, 2));
    add('tile-flowers', drawTile('flowers', 2, 4, 8));
    add('tile-brick', drawTile('brick', 2, 0, 0));
    add('tile-steel', drawTile('steel', 2, 0, 0));
    add('tile-river', drawTile('river', 2, 2, 2));
    add('tile-bush', drawTile('bush', 2, 4, 4));
    add('decor-wreck', drawDecor('wreck', 2));
    add('decor-barrel', drawDecor('barrel', 2));
    add('decor-sandbag', drawDecor('sandbag', 2));
    add('decor-rock', drawDecor('rock', 2));
    add('decor-tuft', drawDecor('tuft', 2));
    add('base', drawBase(2));
    // 4x4 white square for particles
    var p = makeCanvas(4, 4);
    var pctx = p.getContext('2d');
    pctx.fillStyle = '#ffffff'; pctx.fillRect(0, 0, 4, 4);
    add('px', p);
  }

  /* Rebuild the ground-family textures tinted for a floor theme.
     Call after buildTextures() inside scene create (textures are replaced). */
  function buildGroundTextures(scene, theme) {
    var tex = scene.textures;
    function add(key, canvas) {
      if (tex.exists(key)) tex.remove(key);
      tex.addCanvas(key, canvas);
    }
    add('tile-ground', drawTile('ground', 2, 1, 1, theme));
    add('tile-ground2', drawTile('ground', 2, 5, 9, theme));
    add('tile-grass', drawTile('grass', 2, 3, 7, theme));
    add('tile-flowers', drawTile('flowers', 2, 4, 8, theme));
    add('tile-crater', drawTile('crater', 2, 8, 3, theme));
  }

  function iconCanvas(name, scale) {
    var def = ICONS[name];
    if (!def) throw new Error('no icon: ' + name);
    return renderMap(def.map, def.pal, scale || 3);
  }

  function tankSideCanvas(scale) {
    return renderMap(TANK_SIDE_MAP, TANK_SIDE_PAL, scale || 3);
  }

  var api = {
    TANK_PALETTES: TANK_PALETTES, TANK_MAP: TANK_MAP, HEAVY_MAP: HEAVY_MAP,
    renderMap: renderMap, drawTile: drawTile, drawBase: drawBase, drawDecor: drawDecor,
    menuBackdrop: menuBackdrop, buildTextures: buildTextures,
    buildGroundTextures: buildGroundTextures,
    iconCanvas: iconCanvas, tankSideCanvas: tankSideCanvas,
    makeCanvas: makeCanvas, hash2: hash2
  };
  global.RBSprites = api;
})(typeof window !== 'undefined' ? window : globalThis);
