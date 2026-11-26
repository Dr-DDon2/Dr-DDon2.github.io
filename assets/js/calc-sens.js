/* Mouse sensitivity converter — eDPI, cm/360, in/360 and cross-game sensitivity.
   Pure functions; usable in the browser (window.SensCalc) and in Node. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SensCalc = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* Yaw = degrees the in-game camera turns per mouse count at sensitivity 1.
     These are the reference values used by most community converters.
     Game patches can change them: the advanced panel lets you edit yaw. */
  var GAMES = {
    valorant: { name: 'Valorant', short: 'Valorant', yaw: 0.07 },
    cs2: { name: 'Counter-Strike 2', short: 'CS2', yaw: 0.022 },
    apex: { name: 'Apex Legends', short: 'Apex', yaw: 0.022 },
    ow2: { name: 'Overwatch 2', short: 'Overwatch 2', yaw: 0.0066 },
    fortnite: { name: 'Fortnite', short: 'Fortnite', yaw: 0.005555 },
    cod: { name: 'Call of Duty', short: 'Call of Duty', yaw: 0.0066 },
    r6: { name: 'Rainbow Six Siege', short: 'R6 Siege', yaw: 0.00572958 }
  };

  var ORDER = ['valorant', 'cs2', 'apex', 'ow2', 'fortnite', 'cod', 'r6'];

  /* Continuous 360° turn distance, in centimetres. */
  var BANDS = [
    { max: 15, key: 'very-high', label: 'Very high', note: 'Wrist aim, tiny movements' },
    { max: 25, key: 'high', label: 'High', note: 'Wrist aim, quick turns' },
    { max: 35, key: 'balanced', label: 'Balanced', note: 'Most common FPS range' },
    { max: 50, key: 'low', label: 'Low', note: 'Arm aim, steadier tracking' },
    { max: Infinity, key: 'very-low', label: 'Very low', note: 'Full arm aim, wide desk' }
  ];

  function num(v, dflt) {
    if (v === null || v === undefined || v === '') return dflt === undefined ? NaN : dflt;
    var n = Number(String(v).replace(/[,\s]/g, ''));
    return isFinite(n) ? n : (dflt === undefined ? NaN : dflt);
  }

  function round(n, d) {
    var p = Math.pow(10, d === undefined ? 2 : d);
    return Math.round((n + Number.EPSILON) * p) / p;
  }

  function yawOf(gameKey, override) {
    var y = num(override);
    if (isFinite(y) && y > 0) return y;
    var g = GAMES[gameKey] || GAMES.valorant;
    return g.yaw;
  }

  /* counts needed for a full 360° turn */
  function countsPer360(sensitivity, yaw) {
    if (!(sensitivity > 0) || !(yaw > 0)) return NaN;
    return 360 / (sensitivity * yaw);
  }

  /**
   * fromSensitivity({ dpi, game, sensitivity, yaw })
   * -> { eDPI, counts360, inches360, cm360, degreesPerCount }
   */
  function fromSensitivity(input) {
    var i = input || {};
    var dpi = num(i.dpi);
    var sens = num(i.sensitivity);
    var yaw = yawOf(i.game, i.yaw);
    if (!(dpi > 0)) return { error: 'Enter a DPI greater than zero.' };
    if (!(sens > 0)) return { error: 'Enter a sensitivity greater than zero.' };

    var counts360 = countsPer360(sens, yaw);
    var inches360 = counts360 / dpi;

    return {
      dpi: dpi,
      sensitivity: sens,
      yaw: yaw,
      eDPI: dpi * sens,
      degreesPerCount: sens * yaw,
      counts360: counts360,
      inches360: inches360,
      cm360: inches360 * 2.54
    };
  }

  /**
   * toSensitivity({ dpi, game, cm360, yaw }) -> sensitivity for that game
   */
  function toSensitivity(input) {
    var i = input || {};
    var dpi = num(i.dpi);
    var cm = num(i.cm360);
    var yaw = yawOf(i.game, i.yaw);
    if (!(dpi > 0)) return { error: 'Enter a DPI greater than zero.' };
    if (!(cm > 0)) return { error: 'Enter a 360° turn distance greater than zero.' };
    var counts360 = (cm / 2.54) * dpi;
    var sens = 360 / (counts360 * yaw);
    return {
      dpi: dpi,
      game: i.game || 'valorant',
      yaw: yaw,
      sensitivity: sens,
      eDPI: dpi * sens,
      counts360: counts360,
      inches360: cm / 2.54,
      cm360: cm
    };
  }

  /* Same 360° distance in every supported game. */
  function convertAll(dpi, cm360) {
    return ORDER.map(function (key) {
      var r = toSensitivity({ dpi: dpi, game: key, cm360: cm360 });
      return {
        game: key,
        name: GAMES[key].name,
        short: GAMES[key].short,
        yaw: GAMES[key].yaw,
        sensitivity: r.sensitivity,
        eDPI: r.eDPI
      };
    });
  }

  function band(cm360) {
    var cm = num(cm360);
    if (!(cm > 0)) return null;
    for (var b = 0; b < BANDS.length; b++) {
      if (cm < BANDS[b].max) {
        return { index: b, key: BANDS[b].key, label: BANDS[b].label, note: BANDS[b].note };
      }
    }
    var last = BANDS.length - 1;
    return { index: last, key: BANDS[last].key, label: BANDS[last].label, note: BANDS[last].note };
  }

  /* Position (0-1) of a cm/360 value on the 5-band reference bar. */
  function bandPosition(cm360) {
    var cm = num(cm360);
    if (!(cm > 0)) return 0;
    var boundaries = [0, 15, 25, 35, 50, 80];
    if (cm >= 80) return 1;
    for (var i = 0; i < boundaries.length - 1; i++) {
      if (cm >= boundaries[i] && cm < boundaries[i + 1]) {
        var t = (cm - boundaries[i]) / (boundaries[i + 1] - boundaries[i]);
        return (i + t) / 5;
      }
    }
    return 1;
  }

  return {
    GAMES: GAMES,
    ORDER: ORDER,
    BANDS: BANDS,
    fromSensitivity: fromSensitivity,
    toSensitivity: toSensitivity,
    convertAll: convertAll,
    countsPer360: countsPer360,
    band: band,
    bandPosition: bandPosition,
    yawOf: yawOf,
    round: round
  };
});
