/* Gravel / mulch / topsoil volume-and-weight estimator and deck board takeoff.
   Pure functions; usable in the browser (window.GravelCalc) and in Node. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.GravelCalc = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function num(v, dflt) {
    if (v === null || v === undefined || v === '') return dflt === undefined ? 0 : dflt;
    var n = Number(String(v).replace(/[,\s$%"]/g, ''));
    return isFinite(n) ? n : (dflt === undefined ? 0 : dflt);
  }
  function clampMin0(n) { return n < 0 ? 0 : n; }
  function round(n, d) {
    var p = Math.pow(10, d === undefined ? 2 : d);
    return Math.round((n + Number.EPSILON) * p) / p;
  }

  var FT_PER_M = 3.280839895013123;
  var FT3_PER_M3 = 35.314666721489;

  /* Loose bulk densities in US short tons per cubic yard, typical delivered
     values. Suppliers sell by the ton or the yard, and the two differ by
     material, so every figure here is editable on the page. */
  var MATERIALS = {
    peagravel: { label: 'Pea gravel', tonPerYd3: 1.35, note: 'Smooth 3/8 in. stone for beds, paths and drainage.' },
    crushedstone: { label: 'Crushed stone (3/4 in.)', tonPerYd3: 1.40, note: 'Angular base stone for driveways and compacted subbase.' },
    riverrock: { label: 'River rock', tonPerYd3: 1.30, note: 'Rounded decorative stone, 1 to 3 in.' },
    sand: { label: 'Sand', tonPerYd3: 1.35, note: 'Masonry or bedding sand, sold damp.' },
    topsoil: { label: 'Topsoil', tonPerYd3: 1.10, note: 'Screened loam; settles roughly 10 to 15 percent.' },
    compost: { label: 'Compost', tonPerYd3: 0.55, note: 'Light and fluffy; a yard weighs far less than stone.' },
    mulch: { label: 'Mulch (bark)', tonPerYd3: 0.40, note: 'Shredded bark; settles as it weathers.' }
  };

  function feetOf(value, unit, inches) {
    var v = num(value);
    if (unit === 'm') return v * FT_PER_M;
    if (unit === 'cm') return (v / 100) * FT_PER_M;
    if (unit === 'in') return v / 12;
    if (unit === 'ftin') {
      var inch = num(inches);
      return v + inch / 12;
    }
    return v;
  }

  /**
   * computeBulk(input)
   * length, lengthUnit ('ft' | 'ftin' | 'm'), lengthInches
   * width, widthUnit, widthInches
   * depth, depthUnit ('in' | 'cm' | 'ft')
   * material (key of MATERIALS), density (ton/yd3 override), wastePct
   * priceMode 'yd3' | 'ton' | 'bag', price, bagSizeFt3 (default 2)
   */
  function computeBulk(input) {
    var i = input || {};
    var lengthFt = feetOf(i.length, i.lengthUnit, i.lengthInches);
    var widthFt = feetOf(i.width, i.widthUnit, i.widthInches);
    var depthUnit = i.depthUnit === 'cm' ? 'cm' : (i.depthUnit === 'ft' ? 'ft' : 'in');
    var depthFt = feetOf(i.depth, depthUnit);

    var materialKey = MATERIALS[i.material] ? i.material : 'peagravel';
    var mat = MATERIALS[materialKey];
    var density = i.density === undefined || i.density === null || i.density === '' ? mat.tonPerYd3 : clampMin0(num(i.density));
    var wastePct = clampMin0(num(i.wastePct));
    var bagSizeFt3 = clampMin0(num(i.bagSizeFt3, 2)) || 2;

    if (!(lengthFt > 0) || !(widthFt > 0)) {
      return { error: 'Enter a length and a width above zero.' };
    }
    if (!(depthFt > 0)) {
      return { error: 'Enter a depth above zero — 2 to 3 inches for mulch, 4 inches for a driveway base.' };
    }

    var areaFt2 = lengthFt * widthFt;
    var volumeFt3 = areaFt2 * depthFt;
    var volumeYd3 = volumeFt3 / 27;
    var wasteFactor = 1 + wastePct / 100;
    var totalFt3 = volumeFt3 * wasteFactor;
    var totalYd3 = volumeYd3 * wasteFactor;
    var totalM3 = totalFt3 / FT3_PER_M3;
    var tons = totalYd3 * density;
    var bags = Math.ceil(totalFt3 / bagSizeFt3);

    var priceMode = i.priceMode === 'ton' ? 'ton' : (i.priceMode === 'bag' ? 'bag' : 'yd3');
    var price = clampMin0(num(i.price));
    var cost;
    if (priceMode === 'ton') cost = tons * price;
    else if (priceMode === 'bag') cost = bags * price;
    else cost = totalYd3 * price;

    return {
      material: materialKey,
      materialLabel: mat.label,
      materialNote: mat.note,
      density: density,
      lengthFt: lengthFt,
      widthFt: widthFt,
      depthFt: depthFt,
      depthIn: depthFt * 12,
      areaFt2: areaFt2,
      volumeFt3: volumeFt3,
      volumeYd3: volumeYd3,
      wastePct: wastePct,
      wasteFactor: wasteFactor,
      totalFt3: totalFt3,
      totalYd3: totalYd3,
      totalM3: totalM3,
      tons: tons,
      bags: bags,
      bagSizeFt3: bagSizeFt3,
      priceMode: priceMode,
      price: price,
      cost: cost,
      /* how many square feet one cubic yard covers at this depth */
      coverageFt2PerYd3: depthFt > 0 ? 27 / depthFt : 0,
      round: round
    };
  }

  /**
   * computeDeck(input)
   * length, width (ft, decimals allowed)
   * boardWidth ('5.5' | '3.5'), gapIn (default 0.125)
   * wastePct (default 5), boardLengthFt (8 | 10 | 12 | 16)
   * joistSpacingIn (default 16), pricePerBoard (optional)
   */
  function computeDeck(input) {
    var i = input || {};
    var lengthFt = clampMin0(num(i.length));
    var widthFt = clampMin0(num(i.width));
    var boardWidthIn = clampMin0(num(i.boardWidth, 5.5));
    var gapIn = clampMin0(num(i.gapIn, 0.125));
    var wastePct = clampMin0(num(i.wastePct, 5));
    var boardLengthFt = clampMin0(num(i.boardLengthFt, 12));
    var joistSpacingIn = clampMin0(num(i.joistSpacingIn, 16));
    var pricePerBoard = clampMin0(num(i.pricePerBoard));

    if (!(lengthFt > 0) || !(widthFt > 0)) {
      return { error: 'Enter the deck length and width above zero.' };
    }
    if (!(boardWidthIn > 0)) {
      return { error: 'Choose a board width of 5.5 in or 3.5 in, or enter your own.' };
    }
    if (!(boardLengthFt > 0)) {
      return { error: 'Enter the length of the boards you plan to buy.' };
    }

    var pitchIn = boardWidthIn + gapIn;
    var rows = Math.ceil(widthFt * 12 / pitchIn);
    var deckAreaFt2 = lengthFt * widthFt;

    /* Board rows run the length of the deck. Each row is one board length
       (or a cut plus an offcut), so the takeoff is rows x length, plus waste. */
    var surfaceLinearFt = rows * lengthFt;
    var linearFtWithWaste = surfaceLinearFt * (1 + wastePct / 100);
    var boards = Math.ceil(linearFtWithWaste / boardLengthFt);
    var boardFeet = boards * boardLengthFt;
    var offcutFt = boardFeet - linearFtWithWaste;

    var joistCount = joistSpacingIn > 0 ? Math.ceil(lengthFt * 12 / joistSpacingIn) + 1 : 0;
    var screwsPerBoard = joistCount * 2;
    var screwsExact = boards * screwsPerBoard;
    var screws = Math.ceil(screwsExact * 1.05);

    var cost = pricePerBoard > 0 ? boards * pricePerBoard : 0;

    return {
      lengthFt: lengthFt,
      widthFt: widthFt,
      deckAreaFt2: deckAreaFt2,
      boardWidthIn: boardWidthIn,
      gapIn: gapIn,
      pitchIn: pitchIn,
      rows: rows,
      surfaceLinearFt: surfaceLinearFt,
      wastePct: wastePct,
      linearFtWithWaste: linearFtWithWaste,
      boardLengthFt: boardLengthFt,
      boards: boards,
      boardFeet: boardFeet,
      offcutFt: offcutFt,
      joistSpacingIn: joistSpacingIn,
      joistCount: joistCount,
      screwsPerBoard: screwsPerBoard,
      screwsExact: screwsExact,
      screws: screws,
      pricePerBoard: pricePerBoard,
      cost: cost,
      round: round
    };
  }

  return {
    computeBulk: computeBulk,
    computeDeck: computeDeck,
    MATERIALS: MATERIALS,
    round: round
  };
});
