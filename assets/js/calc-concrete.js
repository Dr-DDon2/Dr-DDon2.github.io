/* Concrete slab / bag estimator — pure calculation engine.
   Works in the browser (window.ConcreteCalc) and in Node (module.exports). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.ConcreteCalc = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  var FT_PER_M = 3.280839895013123;
  var M3_PER_FT3 = 0.028316846592;

  /* Yield of one bag of pre-mixed concrete, in cubic feet.
     Standard published yields: 80 lb = 0.60 ft3, 60 lb = 0.45 ft3, 40 lb = 0.30 ft3. */
  var BAG_YIELDS_FT3 = { '40': 0.30, '60': 0.45, '80': 0.60 };
  var BAG_WEIGHT_LB = { '40': 40, '60': 60, '80': 80 };

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    if (v === null || v === undefined) return NaN;
    var s = String(v).replace(/,/g, '').trim();
    if (s === '') return NaN;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }

  /* Convert a length typed by the user into feet. */
  function toFeet(value, unit, inches) {
    var v = num(value);
    if (!isFinite(v)) return NaN;
    var u = unit || 'ft';
    if (u === 'm') return v * FT_PER_M;
    if (u === 'cm') return (v / 100) * FT_PER_M;
    if (u === 'in') return v / 12;
    if (u === 'ftin') {
      var inch = num(inches);
      if (!isFinite(inch)) inch = 0;
      return v + inch / 12;
    }
    return v;
  }

  function round(n, d) {
    var p = Math.pow(10, d === undefined ? 2 : d);
    return Math.round(n * p) / p;
  }

  /**
   * compute(input)
   * input: {
   *   length, lengthUnit ('ft'|'ftin'|'m'), lengthInches,
   *   width,  widthUnit  ('ft'|'ftin'|'m'), widthInches,
   *   thickness, thicknessUnit ('in'|'cm'),
   *   wastePct, bagSize ('40'|'60'|'80'), pricePerBag
   * }
   */
  function compute(input) {
    var i = input || {};
    var lengthFt = toFeet(i.length, i.lengthUnit || 'ft', i.lengthInches);
    var widthFt = toFeet(i.width, i.widthUnit || 'ft', i.widthInches);
    var thicknessFt = toFeet(i.thickness, i.thicknessUnit || 'in');

    if (!isFinite(thicknessFt)) thicknessFt = toFeet(num(i.thickness), 'in');

    var wastePct = num(i.wastePct);
    if (!isFinite(wastePct)) wastePct = 0;
    if (wastePct < 0) wastePct = 0;

    if (!isFinite(lengthFt) || lengthFt <= 0) return { error: 'Enter a slab length greater than zero.' };
    if (!isFinite(widthFt) || widthFt <= 0) return { error: 'Enter a slab width greater than zero.' };
    if (!isFinite(thicknessFt) || thicknessFt <= 0) return { error: 'Enter a slab thickness greater than zero.' };

    var bagSize = String(i.bagSize || '80');
    if (!BAG_YIELDS_FT3[bagSize]) bagSize = '80';

    var pricePerBag = num(i.pricePerBag);
    if (!isFinite(pricePerBag) || pricePerBag < 0) pricePerBag = 0;

    var areaFt2 = lengthFt * widthFt;
    var volumeFt3 = areaFt2 * thicknessFt;
    var factor = 1 + wastePct / 100;
    var wasteFt3 = volumeFt3 * (factor - 1);
    var totalFt3 = volumeFt3 * factor;

    function bagsFor(size) {
      var y = BAG_YIELDS_FT3[size];
      var exact = totalFt3 / y;
      return { size: size, yieldFt3: y, exact: exact, bags: Math.ceil(exact - 1e-9), weightLb: Math.ceil(exact - 1e-9) * BAG_WEIGHT_LB[size] };
    }

    var picking = bagsFor(bagSize);
    var table = ['40', '60', '80'].map(bagsFor);

    var totalCost = picking.bags * pricePerBag;

    return {
      lengthFt: lengthFt,
      widthFt: widthFt,
      thicknessFt: thicknessFt,
      thicknessIn: thicknessFt * 12,
      areaFt2: areaFt2,
      volumeFt3: volumeFt3,
      volumeYd3: volumeFt3 / 27,
      volumeM3: volumeFt3 * M3_PER_FT3,
      wastePct: wastePct,
      wasteFt3: wasteFt3,
      totalFt3: totalFt3,
      totalYd3: totalFt3 / 27,
      totalM3: totalFt3 * M3_PER_FT3,
      bagSize: bagSize,
      yieldPerBag: picking.yieldFt3,
      bagsExact: picking.exact,
      bags: picking.bags,
      totalWeightLb: picking.weightLb,
      pricePerBag: pricePerBag,
      totalCost: totalCost,
      bagTable: table,
      /* ratios used by the visual summary */
      netShare: totalFt3 > 0 ? volumeFt3 / totalFt3 : 1,
      wasteShare: totalFt3 > 0 ? wasteFt3 / totalFt3 : 0,
      round: round
    };
  }

  return {
    compute: compute,
    toFeet: toFeet,
    num: num,
    round: round,
    BAG_YIELDS_FT3: BAG_YIELDS_FT3,
    FT_PER_M: FT_PER_M,
    M3_PER_FT3: M3_PER_FT3
  };
});
