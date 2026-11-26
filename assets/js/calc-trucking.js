/* Owner-operator and delivery-driver cost-per-mile engine.
   Pure functions; usable in the browser (window.TruckingCalc) and in Node. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.TruckingCalc = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function num(v, dflt) {
    if (v === null || v === undefined || v === '') return dflt === undefined ? 0 : dflt;
    var n = Number(String(v).replace(/[,\s$%]/g, ''));
    return isFinite(n) ? n : (dflt === undefined ? 0 : dflt);
  }
  function clampMin0(n) { return n < 0 ? 0 : n; }
  function round(n, d) {
    var p = Math.pow(10, d === undefined ? 2 : d);
    return Math.round((n + Number.EPSILON) * p) / p;
  }

  var COLORS = {
    fuel: '#f59e0b',
    maintenance: '#6366f1',
    insurance: '#0ea5e9',
    fixed: '#94a3b8',
    fees: '#a855f7'
  };

  /**
   * compute(input)
   * Miles: loadedMiles, deadheadMiles
   * Revenue: rateMode 'permile' (rate per loaded mile) | 'flat' (rate per load), rate
   * Fees: brokerPct, factoringPct (percent of gross revenue)
   * Running costs: mpg, fuelPrice, maintPerMile, insPerMile, fixedCost
   * Time: hours (optional, for profit per hour)
   */
  function compute(input) {
    var i = input || {};
    var loadedMiles = clampMin0(num(i.loadedMiles));
    var deadheadMiles = clampMin0(num(i.deadheadMiles));
    var totalMiles = loadedMiles + deadheadMiles;
    var rateMode = i.rateMode === 'flat' ? 'flat' : 'permile';
    var rate = clampMin0(num(i.rate));
    var mpg = clampMin0(num(i.mpg));
    var fuelPrice = clampMin0(num(i.fuelPrice));
    var brokerPct = clampMin0(num(i.brokerPct));
    var factoringPct = clampMin0(num(i.factoringPct));
    var maintPerMile = clampMin0(num(i.maintPerMile));
    var insPerMile = clampMin0(num(i.insPerMile));
    var fixedCost = clampMin0(num(i.fixedCost));
    var hours = clampMin0(num(i.hours));

    if (!(totalMiles > 0)) {
      return { error: 'Enter the loaded and empty (deadhead) miles for the run.' };
    }
    if (rateMode === 'permile' && !(loadedMiles > 0)) {
      return { error: 'A rate per loaded mile needs loaded miles above zero. Switch to a flat rate per load for an all-deadhead run.' };
    }
    if (fuelPrice > 0 && !(mpg > 0)) {
      return { error: 'Enter the truck’s fuel economy in MPG, or set the fuel price to zero.' };
    }
    var feePct = brokerPct + factoringPct;
    if (feePct >= 100) {
      return { error: 'Broker and factoring fees cannot add up to 100% or more of revenue.' };
    }

    var grossRevenue = rateMode === 'flat' ? rate : rate * loadedMiles;
    var fees = grossRevenue * feePct / 100;
    var netRevenue = grossRevenue - fees;

    var gallons = mpg > 0 ? totalMiles / mpg : 0;
    var fuelPerMile = mpg > 0 ? fuelPrice / mpg : 0;
    var fuelCost = gallons * fuelPrice;
    var maintCost = maintPerMile * totalMiles;
    var insCost = insPerMile * totalMiles;
    var deadheadCost = deadheadMiles * (fuelPerMile + maintPerMile + insPerMile);

    var totalCost = fuelCost + maintCost + insCost + fixedCost;
    var allInCost = totalCost + fees;
    var netProfit = netRevenue - totalCost;
    var costPerMile = totalCost / totalMiles;
    var allInCostPerMile = allInCost / totalMiles;
    var revenuePerMile = netRevenue / totalMiles;
    var grossPerMile = grossRevenue / totalMiles;
    var profitPerMile = netProfit / totalMiles;
    var marginPct = netRevenue > 0 ? netProfit / netRevenue * 100 : 0;
    var deadheadPct = totalMiles > 0 ? deadheadMiles / totalMiles * 100 : 0;

    var keepRate = 1 - feePct / 100;
    var breakEvenRate;
    if (rateMode === 'flat') breakEvenRate = totalCost / keepRate;
    else breakEvenRate = loadedMiles > 0 ? totalCost / (keepRate * loadedMiles) : Infinity;
    var breakEvenPerTotalMile = totalCost / (keepRate * totalMiles);

    var profitPerHour = hours > 0 ? netProfit / hours : 0;
    var revenuePerHour = hours > 0 ? netRevenue / hours : 0;
    var milesPerHour = hours > 0 ? totalMiles / hours : 0;

    var segments = [
      { key: 'fuel', label: 'Fuel', value: fuelCost, color: COLORS.fuel },
      { key: 'maintenance', label: 'Maintenance & tires', value: maintCost, color: COLORS.maintenance },
      { key: 'insurance', label: 'Insurance reserve', value: insCost, color: COLORS.insurance },
      { key: 'fees', label: 'Broker & factoring', value: fees, color: COLORS.fees },
      { key: 'fixed', label: 'Fixed & other', value: fixedCost, color: COLORS.fixed }
    ];
    var segTotal = segments.reduce(function (s, x) { return s + x.value; }, 0) || 1;
    segments.forEach(function (s) {
      s.value = Math.max(0, s.value);
      s.pct = s.value / segTotal * 100;
      s.centsPerMile = totalMiles > 0 ? s.value / totalMiles * 100 : 0;
    });
    return {
      loadedMiles: loadedMiles,
      deadheadMiles: deadheadMiles,
      totalMiles: totalMiles,
      deadheadPct: deadheadPct,
      rateMode: rateMode,
      rate: rate,
      grossRevenue: grossRevenue,
      brokerPct: brokerPct,
      factoringPct: factoringPct,
      feePct: feePct,
      fees: fees,
      netRevenue: netRevenue,
      mpg: mpg,
      fuelPrice: fuelPrice,
      gallons: gallons,
      fuelCost: fuelCost,
      fuelPerMile: fuelPerMile,
      deadheadCost: deadheadCost,
      maintCost: maintCost,
      insCost: insCost,
      fixedCost: fixedCost,
      totalCost: totalCost,
      allInCost: allInCost,
      costPerMile: costPerMile,
      allInCostPerMile: allInCostPerMile,
      grossPerMile: grossPerMile,
      revenuePerMile: revenuePerMile,
      profitPerMile: profitPerMile,
      netProfit: netProfit,
      marginPct: marginPct,
      breakEvenRate: breakEvenRate,
      breakEvenPerTotalMile: breakEvenPerTotalMile,
      hours: hours,
      profitPerHour: profitPerHour,
      revenuePerHour: revenuePerHour,
      milesPerHour: milesPerHour,
      segments: segments,
      round: round
    };
  }

  /** Fuel cost per mile for a given price and MPG, a handy single figure. */
  function fuelCostPerMile(mpg, fuelPrice) {
    var m = num(mpg), p = num(fuelPrice);
    if (!(m > 0)) return Infinity;
    return p / m;
  }

  return { compute: compute, fuelCostPerMile: fuelCostPerMile, COLORS: COLORS, round: round };
});
