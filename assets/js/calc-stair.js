/* Stair stringer and roof pitch calculator — pure calculation engine.
   Works in the browser (window.StairCalc) and in Node / quickjs (module.exports). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StairCalc = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var IN_PER_FT = 12;
  var MM_PER_IN = 25.4;
  var FT_PER_M = 3.280839895013123;

  /* IRC R311.7 residential stair limits, 2021 edition. */
  var IRC_MAX_RISER_IN = 7.75;      /* R311.7.5.1: riser height max 7-3/4 in */
  var IRC_MIN_TREAD_IN = 10;        /* R311.7.5.2: tread depth min 10 in */
  var IRC_MIN_WIDTH_IN = 36;        /* R311.7.1: stairway width min 36 in */
  var IRC_NOSING_MIN_IN = 0.75;     /* R311.7.5.3: nosing projection 3/4 to 1-1/4 in */
  var IRC_NOSING_MAX_IN = 1.25;

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    if (v === null || v === undefined) return NaN;
    var s = String(v).replace(/,/g, '').trim();
    if (s === '') return NaN;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }

  function round(n, d) {
    var p = Math.pow(10, d === undefined ? 2 : d);
    return Math.round(n * p) / p;
  }

  /* Convert a length typed by the user into inches.
     unit 'ftin'  -> value is whole feet, `inches` extra inches, `sixteenths` extra 1/16ths
     unit 'in'    -> value is inches
     unit 'mm'    -> value is millimetres
     unit 'cm'    -> value is centimetres */
  function toInches(value, unit, inches, sixteenths) {
    var u = unit || 'in';
    var v = num(value);
    if (!isFinite(v)) return NaN;
    if (u === 'mm') return v / MM_PER_IN;
    if (u === 'cm') return (v / 100) * (1000 / MM_PER_IN);
    if (u === 'ftin') {
      var inch = num(inches);
      if (!isFinite(inch)) inch = 0;
      var s = num(sixteenths);
      if (!isFinite(s)) s = 0;
      return v * IN_PER_FT + inch + s / 16;
    }
    return v;
  }

  /* Format a decimal inch value as feet-inches-sixteenths, e.g. 174.058 -> 14' 6 1/16" */
  function toFeetInches(inches) {
    if (!isFinite(inches)) return '';
    var sign = inches < 0 ? '-' : '';
    var abs = Math.abs(inches);
    var whole = Math.floor(abs / IN_PER_FT);
    var rem = abs - whole * IN_PER_FT;
    var inch = Math.floor(rem);
    var sixteenth = Math.round((rem - inch) * 16);
    if (sixteenth === 16) { sixteenth = 0; inch += 1; }
    if (inch === 12) { inch = 0; whole += 1; }
    if (!sixteenth) return sign + whole + '\u2032 ' + inch + '\u2033';
    var a = sixteenth, b = 16;
    while (b) { var t = b; b = a % b; a = t; }
    return sign + whole + '\u2032 ' + inch + '\u2033 ' + (sixteenth / a) + '/' + (16 / a);
  }

  /* Format a decimal inch value as whole inches and sixteenths, e.g. 7.75 -> 7 3/4"
     Used for riser heights and tread depths, which are read in inches on a tape. */
  function toInchFrac(inches) {
    if (!isFinite(inches)) return '';
    var sign = inches < 0 ? '-' : '';
    var abs = Math.abs(inches);
    var whole = Math.floor(abs + 1e-9);
    var sixteenth = Math.round((abs - whole) * 16);
    if (sixteenth === 16) { sixteenth = 0; whole += 1; }
    if (sixteenth === 0) return sign + whole;
    var a = sixteenth;
    var b = 16;
    while (b) { var t = b; b = a % b; a = t; }
    return sign + whole + ' ' + (sixteenth / a) + '/' + (16 / a);
  }

  /**
   * computeStairs(input)
   * input: {
   *   rise, riseUnit ('ftin'|'in'|'mm'|'cm'), riseInches, riseSixteenths,
   *   targetRiserIn, treadDepthIn, nosingIn, widthIn
   * }
   */
  function computeStairs(input) {
    var i = input || {};
    var unit = i.riseUnit || 'ftin';
    var totalRiseIn = toInches(i.rise, unit, i.riseInches, i.riseSixteenths);
    if (!isFinite(totalRiseIn) || totalRiseIn <= 0) {
      return { error: 'Enter a total rise greater than zero.' };
    }
    if (totalRiseIn > 12 * 20) {
      return { error: 'That rise is over 20 ft. Check the measurement — a single flight should stay under it.' };
    }

    var target = num(i.targetRiserIn);
    if (!isFinite(target) || target <= 0) target = 7.5;
    if (target > IRC_MAX_RISER_IN) target = IRC_MAX_RISER_IN;

    var risers = Math.round(totalRiseIn / target);
    if (!isFinite(risers) || risers < 2) risers = 2;
    if (risers > 40) return { error: 'More than 40 risers in one flight is not practical — split it with a landing.' };

    var riserIn = totalRiseIn / risers;
    var treads = risers - 1;

    var treadIn = num(i.treadDepthIn);
    if (!isFinite(treadIn) || treadIn <= 0) treadIn = 10.5;

    var nosingIn = num(i.nosingIn);
    if (!isFinite(nosingIn) || nosingIn < 0) nosingIn = IRC_NOSING_MIN_IN;

    var widthIn = num(i.widthIn);
    if (!isFinite(widthIn) || widthIn <= 0) widthIn = 36;

    var runIn = treads * treadIn;
    var stringerIn = Math.sqrt(totalRiseIn * totalRiseIn + runIn * runIn);
    var angleDeg = Math.atan2(totalRiseIn, runIn) * 180 / Math.PI;
    var pitchRatio = runIn > 0 ? totalRiseIn / runIn : 0;

    var riserOk = riserIn <= IRC_MAX_RISER_IN + 1e-9;
    var treadOk = treadIn >= IRC_MIN_TREAD_IN - 1e-9;
    var widthOk = widthIn >= IRC_MIN_WIDTH_IN - 1e-9;
    /* The nosing rule only applies when treads are under 11 in deep (R311.7.5.3). */
    var nosingApplies = treadIn < 11;
    var nosingOk = !nosingApplies || (nosingIn >= IRC_NOSING_MIN_IN - 1e-9 && nosingIn <= IRC_NOSING_MAX_IN + 1e-9);

    /* Stringer stock: add a foot for the plumb cuts top and bottom. */
    var stringerOrderIn = stringerIn + 12;

    return {
      totalRiseIn: totalRiseIn,
      risers: risers,
      riserIn: riserIn,
      riserMm: riserIn * MM_PER_IN,
      treads: treads,
      treadIn: treadIn,
      treadMm: treadIn * MM_PER_IN,
      nosingIn: nosingIn,
      widthIn: widthIn,
      runIn: runIn,
      runFt: runIn / IN_PER_FT,
      riseFt: totalRiseIn / IN_PER_FT,
      stringerIn: stringerIn,
      stringerFt: stringerIn / IN_PER_FT,
      stringerMm: stringerIn * MM_PER_IN,
      stringerOrderIn: stringerOrderIn,
      stringerOrderMm: stringerOrderIn * MM_PER_IN,
      angleDeg: angleDeg,
      pitchRatio: pitchRatio,
      slopePct: pitchRatio * 100,
      riserOk: riserOk,
      treadOk: treadOk,
      widthOk: widthOk,
      nosingApplies: nosingApplies,
      nosingOk: nosingOk,
      codePass: riserOk && treadOk && widthOk && nosingOk,
      limits: {
        maxRiserIn: IRC_MAX_RISER_IN,
        minTreadIn: IRC_MIN_TREAD_IN,
        minWidthIn: IRC_MIN_WIDTH_IN,
        nosingMinIn: IRC_NOSING_MIN_IN,
        nosingMaxIn: IRC_NOSING_MAX_IN
      }
    };
  }

  /**
   * computeRoof(input)
   * input: { pitch (rise per 12 of run), runFt, overhangFt }
   */
  function computeRoof(input) {
    var i = input || {};
    var pitch = num(i.pitch);
    if (!isFinite(pitch) || pitch <= 0) return { error: 'Enter a roof pitch greater than 0 (rise per 12 in of run).' };
    if (pitch > 24) return { error: 'Pitch above 24:12 is outside this calculator — check the rise and run.' };

    var runFt = num(i.runFt);
    if (!isFinite(runFt) || runFt <= 0) runFt = 12;
    if (runFt > 200) return { error: 'Run over 200 ft — check the measurement.' };

    var overhangFt = num(i.overhangFt);
    if (!isFinite(overhangFt) || overhangFt < 0) overhangFt = 0;

    var angleDeg = Math.atan(pitch / 12) * 180 / Math.PI;
    var slopePct = (pitch / 12) * 100;

    /* Unit lengths: rafter length for 1 ft of horizontal run. */
    var commonMult = Math.sqrt(144 + pitch * pitch) / 12;
    var hipMult = Math.sqrt(288 + pitch * pitch) / 12;

    var rafterRunFt = runFt + overhangFt;

    return {
      pitch: pitch,
      pitchText: pitch + ':12',
      runFt: runFt,
      overhangFt: overhangFt,
      rafterRunFt: rafterRunFt,
      angleDeg: angleDeg,
      slopePct: slopePct,
      commonMult: commonMult,
      hipMult: hipMult,
      riseFt: runFt * pitch / 12,
      totalRiseFt: rafterRunFt * pitch / 12,
      commonRafterFt: rafterRunFt * commonMult,
      hipRafterFt: rafterRunFt * hipMult,
      commonPerFtIn: commonMult * 12,
      hipPerFtIn: hipMult * 12,
      /* Degrees are also handy as a framing-square setting. */
      degreesPerFtRise: pitch
    };
  }

  return {
    computeStairs: computeStairs,
    computeRoof: computeRoof,
    toInches: toInches,
    toFeetInches: toFeetInches,
    toInchFrac: toInchFrac,
    num: num,
    round: round,
    IRC_MAX_RISER_IN: IRC_MAX_RISER_IN,
    IRC_MIN_TREAD_IN: IRC_MIN_TREAD_IN,
    IRC_MIN_WIDTH_IN: IRC_MIN_WIDTH_IN,
    IN_PER_FT: IN_PER_FT,
    MM_PER_IN: MM_PER_IN,
    FT_PER_M: FT_PER_M
  };
});
