/* 3D print cost, AMS purge waste and pricing calculator — pure calculation engine.
   Works in the browser (window.Print3DCalc) and in Node / quickjs (module.exports). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.Print3DCalc = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    if (v === null || v === undefined) return NaN;
    var s = String(v).replace(/[$,]/g, '').trim();
    if (s === '') return NaN;
    var n = Number(s);
    return isFinite(n) ? n : NaN;
  }

  function round(n, d) {
    var p = Math.pow(10, d === undefined ? 2 : d);
    return Math.round(n * p) / p;
  }

  function nonNeg(v, fallback) {
    var n = num(v);
    if (!isFinite(n) || n < 0) return fallback === undefined ? 0 : fallback;
    return n;
  }

  /**
   * compute(input)
   * input: {
   *   spoolPrice, spoolWeightG,
   *   modelG, purgeG, supportG,
   *   printHours, powerW, kwhPrice,
   *   printerPrice, lifeHours,
   *   laborMin, laborRate, extraCost,
   *   failPct, marginPct, feePct, feeFlat
   * }
   */
  function compute(input) {
    var i = input || {};

    var spoolWeight = num(i.spoolWeightG);
    if (!isFinite(spoolWeight) || spoolWeight <= 0) return { error: 'Enter the spool weight in grams (usually 1000 g).' };
    var spoolPrice = nonNeg(i.spoolPrice, 0);

    var modelG = nonNeg(i.modelG, 0);
    if (modelG <= 0) return { error: 'Enter the part weight in grams — it is the only input with no sensible default.' };

    var purgeG = nonNeg(i.purgeG, 0);
    var supportG = nonNeg(i.supportG, 0);
    if (purgeG > 100000 || supportG > 100000) return { error: 'That much purge or support cannot be right — check the numbers.' };

    var printHours = nonNeg(i.printHours, 0);
    if (printHours > 2000) return { error: 'A single print over 2000 hours is not realistic — check the time.' };

    var powerW = nonNeg(i.powerW, 0);
    var kwhPrice = nonNeg(i.kwhPrice, 0);

    var printerPrice = nonNeg(i.printerPrice, 0);
    var lifeHours = nonNeg(i.lifeHours, 0);

    var laborMin = nonNeg(i.laborMin, 0);
    var laborRate = nonNeg(i.laborRate, 0);
    var extraCost = nonNeg(i.extraCost, 0);

    var failPct = nonNeg(i.failPct, 0);
    if (failPct >= 100) failPct = 99;

    var marginPct = nonNeg(i.marginPct, 0);
    var feePct = nonNeg(i.feePct, 0);
    var feeFlat = nonNeg(i.feeFlat, 0);
    if (marginPct + feePct >= 100) {
      return { error: 'Margin plus marketplace fees must stay under 100 percent.' };
    }

    var costPerG = spoolPrice / spoolWeight;
    var materialG = modelG + purgeG + supportG;
    var materialCost = materialG * costPerG;
    var partMaterialCost = modelG * costPerG;
    var wasteMaterialCost = (purgeG + supportG) * costPerG;

    var energyKwh = printHours * powerW / 1000;
    var energyCost = energyKwh * kwhPrice;

    var deprPerHour = lifeHours > 0 ? printerPrice / lifeHours : 0;
    var deprCost = deprPerHour * printHours;

    /* Failures waste filament, machine time and electricity, so those three are
       grossed up by the attempt count. Labour and packaging are not repeated. */
    var wasteMultiplier = 1 / (1 - failPct / 100);
    var attemptMaterial = materialCost * wasteMultiplier;
    var attemptEnergy = energyCost * wasteMultiplier;
    var attemptDepr = deprCost * wasteMultiplier;
    var attemptWasteCost = attemptMaterial + attemptEnergy + attemptDepr;

    var laborCost = (laborMin / 60) * laborRate;
    var fixedCost = laborCost + extraCost;

    var cost = attemptMaterial + attemptEnergy + attemptDepr + laborCost + extraCost;

    var breakEvenPrice = (cost + feeFlat) / (1 - feePct / 100);
    var price = (cost + feeFlat) / (1 - (marginPct + feePct) / 100);
    var feeAmount = price * feePct / 100 + feeFlat;
    var profit = price - feeAmount - cost;
    var margin = price > 0 ? profit / price : 0;

    var spoolGramsUsed = materialG * wasteMultiplier;
    var spoolsUsed = spoolGramsUsed / spoolWeight;

    return {
      spoolPrice: spoolPrice,
      spoolWeightG: spoolWeight,
      costPerG: costPerG,
      modelG: modelG,
      purgeG: purgeG,
      supportG: supportG,
      materialG: materialG,
      materialCost: materialCost,
      partMaterialCost: partMaterialCost,
      wasteMaterialCost: wasteMaterialCost,
      wasteShare: materialG > 0 ? (purgeG + supportG) / materialG : 0,
      purgeShare: materialG > 0 ? purgeG / materialG : 0,
      supportShare: materialG > 0 ? supportG / materialG : 0,
      printHours: printHours,
      powerW: powerW,
      energyKwh: energyKwh,
      energyCost: energyCost,
      printerPrice: printerPrice,
      lifeHours: lifeHours,
      deprPerHour: deprPerHour,
      deprCost: deprCost,
      laborMin: laborMin,
      laborRate: laborRate,
      laborCost: laborCost,
      extraCost: extraCost,
      failPct: failPct,
      wasteMultiplier: wasteMultiplier,
      attemptMaterial: attemptMaterial,
      attemptEnergy: attemptEnergy,
      attemptDepr: attemptDepr,
      attemptWasteCost: attemptWasteCost,
      fixedCost: fixedCost,
      cost: cost,
      marginPct: marginPct,
      feePct: feePct,
      feeFlat: feeFlat,
      price: price,
      feeAmount: feeAmount,
      profit: profit,
      margin: margin,
      breakEvenPrice: breakEvenPrice,
      spoolGramsUsed: spoolGramsUsed,
      spoolsUsed: spoolsUsed,
      costPerKgPrinted: modelG > 0 ? cost / (modelG / 1000) : 0,
      round: round
    };
  }

  return { compute: compute, num: num, round: round };
});
