/* EV charging versus gasoline fuel cost and annual savings.
   Pure functions; usable in the browser (window.EvCalc) and in Node. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.EvCalc = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  function num(v, dflt) {
    if (v === null || v === undefined || v === '') return dflt === undefined ? 0 : dflt;
    var n = Number(String(v).replace(/[,\s$/]/g, ''));
    return isFinite(n) ? n : (dflt === undefined ? 0 : dflt);
  }
  function clampMin0(n) { return n < 0 ? 0 : n; }
  function round(n, d) {
    var p = Math.pow(10, d === undefined ? 2 : d);
    return Math.round((n + Number.EPSILON) * p) / p;
  }

  /* EPA uses 33.705 kWh as the energy content of one US gallon of gasoline. */
  var KWH_PER_GALLON = 33.705;

  var COLORS = { ev: '#10b981', gas: '#f59e0b' };

  /**
   * compute(input)
   * annualMiles
   * evMilesPerKwh, homeRate ($/kWh), homeSharePct, publicRate ($/kWh)
   * gasMpg, gasPrice ($/gal)
   * years (default 5) for the cumulative comparison
   */
  function compute(input) {
    var i = input || {};
    var annualMiles = clampMin0(num(i.annualMiles));
    var evMilesPerKwh = clampMin0(num(i.evMilesPerKwh));
    var homeRate = clampMin0(num(i.homeRate));
    var publicRate = clampMin0(num(i.publicRate));
    var homeSharePct = i.homeSharePct === undefined || i.homeSharePct === null || i.homeSharePct === ''
      ? 80 : Math.min(100, clampMin0(num(i.homeSharePct)));
    var gasMpg = clampMin0(num(i.gasMpg));
    var gasPrice = clampMin0(num(i.gasPrice));
    var years = num(i.years, 5);
    if (!(years > 0)) years = 5;
    years = Math.min(30, years);

    if (!(annualMiles > 0)) {
      return { error: 'Enter your annual mileage above zero (the US average is about 13,500 miles).' };
    }
    if (!(evMilesPerKwh > 0)) {
      return { error: 'Enter the EV’s efficiency in miles per kWh — 3.0 to 4.5 is typical.' };
    }
    if (!(gasMpg > 0)) {
      return { error: 'Enter the petrol car’s fuel economy in MPG.' };
    }

    var homeShare = homeSharePct / 100;
    var publicShare = 1 - homeShare;
    var blendedRate = homeRate * homeShare + publicRate * publicShare;

    var evKwhPerMile = 1 / evMilesPerKwh;
    var evCostPerMile = blendedRate * evKwhPerMile;
    var evKwhPerYear = annualMiles * evKwhPerMile;
    var evKwhHome = evKwhPerYear * homeShare;
    var evKwhPublic = evKwhPerYear * publicShare;
    var evAnnualCost = evCostPerMile * annualMiles;

    var gasGallonsPerMile = 1 / gasMpg;
    var gasCostPerMile = gasPrice / gasMpg;
    var gasGallonsPerYear = annualMiles / gasMpg;
    var gasAnnualCost = gasCostPerMile * annualMiles;

    var evPer100 = evCostPerMile * 100;
    var gasPer100 = gasCostPerMile * 100;

    var annualSavings = gasAnnualCost - evAnnualCost;
    var monthlySavings = annualSavings / 12;
    var totalSavings = annualSavings * years;
    var savingsPct = gasAnnualCost > 0 ? annualSavings / gasAnnualCost * 100 : 0;
    var evMpge = evMilesPerKwh * KWH_PER_GALLON;
    var gallonsEquivalent = evKwhPerYear / KWH_PER_GALLON;

    var maxPer100 = Math.max(evPer100, gasPer100) || 1;

    return {
      annualMiles: annualMiles,
      years: years,
      evMilesPerKwh: evMilesPerKwh,
      homeRate: homeRate,
      publicRate: publicRate,
      homeSharePct: homeSharePct,
      publicSharePct: publicShare * 100,
      blendedRate: blendedRate,
      evCostPerMile: evCostPerMile,
      evPer100: evPer100,
      evAnnualCost: evAnnualCost,
      evMonthlyCost: evAnnualCost / 12,
      evKwhPerYear: evKwhPerYear,
      evKwhHome: evKwhHome,
      evKwhPublic: evKwhPublic,
      homeCostPerYear: evKwhHome * homeRate,
      publicCostPerYear: evKwhPublic * publicRate,
      evMpge: evMpge,
      gasMpg: gasMpg,
      gasPrice: gasPrice,
      gasCostPerMile: gasCostPerMile,
      gasPer100: gasPer100,
      gasAnnualCost: gasAnnualCost,
      gasMonthlyCost: gasAnnualCost / 12,
      gasGallonsPerYear: gasGallonsPerYear,
      annualSavings: annualSavings,
      monthlySavings: monthlySavings,
      totalSavings: totalSavings,
      savingsPct: savingsPct,
      gallonsEquivalent: gallonsEquivalent,
      evBarPct: evPer100 / maxPer100 * 100,
      gasBarPct: gasPer100 / maxPer100 * 100,
      colors: COLORS,
      round: round
    };
  }

  return { compute: compute, COLORS: COLORS, KWH_PER_GALLON: KWH_PER_GALLON, round: round };
});
