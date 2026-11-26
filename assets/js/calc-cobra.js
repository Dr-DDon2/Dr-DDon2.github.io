/* COBRA vs ACA marketplace health insurance cost comparison.
   Educational estimate only. Pure functions; window.CobraCalc / Node. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.CobraCalc = api;
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

  var SCENARIOS = [
    { key: 'low', label: 'Low use', defaultExpense: 600, note: 'A few visits, one prescription, nothing major.' },
    { key: 'typical', label: 'Typical', defaultExpense: 3500, note: 'Routine care, labs, a specialist or two.' },
    { key: 'high', label: 'High use', defaultExpense: 15000, note: 'An ER visit, imaging, surgery or a hospital stay.' }
  ];

  var COLORS = {
    premium: '#6366f1',
    deductible: '#0ea5e9',
    coinsurance: '#f59e0b',
    cap: '#94a3b8'
  };

  function planCost(plan, months, expenses, coinsurancePct) {
    var p = plan || {};
    var premiumMonthly = clampMin0(num(p.premium));
    var premium = premiumMonthly * months;
    var deductible = clampMin0(num(p.deductible));
    var deductibleMet = clampMin0(num(p.deductibleMet));
    var oopMax = clampMin0(num(p.oopMax));
    var oopSpent = clampMin0(num(p.oopSpent));
    var dedRemaining = Math.max(0, deductible - deductibleMet);
    var oopRemaining = oopMax > 0 ? Math.max(0, oopMax - oopSpent) : Infinity;

    var e = Math.max(0, num(expenses));
    var deductiblePaid = Math.min(e, dedRemaining);
    var afterDeductible = e - deductiblePaid;
    var coinsurance = afterDeductible * clampMin0(coinsurancePct) / 100;
    var careBeforeCap = deductiblePaid + coinsurance;
    var outOfPocket = isFinite(oopRemaining) ? Math.min(careBeforeCap, oopRemaining) : careBeforeCap;
    var total = premium + outOfPocket;

    return {
      premiumMonthly: premiumMonthly,
      premium: premium,
      deductible: deductible,
      deductibleMet: deductibleMet,
      deductibleRemaining: dedRemaining,
      deductiblePaid: deductiblePaid,
      coinsurance: coinsurance,
      oopMax: oopMax,
      oopSpent: oopSpent,
      oopRemaining: isFinite(oopRemaining) ? oopRemaining : 0,
      noCap: !isFinite(oopRemaining),
      careBeforeCap: careBeforeCap,
      outOfPocket: outOfPocket,
      planPaid: Math.max(0, e - outOfPocket),
      total: total,
      monthlyEquivalent: months > 0 ? total / months : 0,
      careCost: outOfPocket,
      expenses: e
    };
  }

  /**
   * compute(input)
   * months (1-12), coinsurancePct (member share after deductible, default 20)
   * cobra: {premium, deductible, deductibleMet, oopMax, oopSpent}
   * aca:   {premium, deductible, deductibleMet, oopMax, oopSpent}
   * low / typical / high: expected medical expenses over the remaining months
   * scenario: 'low' | 'typical' | 'high'
   */
  function compute(input) {
    var i = input || {};
    var rawMonths = num(i.months, 6);
    if (!(rawMonths > 0)) {
      return { error: 'Enter how many months of coverage you need (1 to 12).' };
    }
    var months = Math.min(12, Math.max(1, Math.round(rawMonths)));
    var coinsurancePct = i.coinsurancePct === undefined || i.coinsurancePct === null || i.coinsurancePct === ''
      ? 20 : clampMin0(num(i.coinsurancePct));

    var expenses = {};
    SCENARIOS.forEach(function (s) {
      var v = i[s.key];
      expenses[s.key] = (v === undefined || v === null || v === '') ? s.defaultExpense : clampMin0(num(v));
    });

    var selected = i.scenario === 'low' || i.scenario === 'high' ? i.scenario : 'typical';

    function build(key) {
      var c = planCost(i.cobra, months, expenses[key], coinsurancePct);
      var a = planCost(i.aca, months, expenses[key], coinsurancePct);
      var diff = c.total - a.total;
      return {
        key: key,
        label: (SCENARIOS.filter(function (s) { return s.key === key; })[0] || SCENARIOS[1]).label,
        expenses: expenses[key],
        cobra: c,
        aca: a,
        /* positive means COBRA costs more and ACA saves this much */
        savingsFromAca: diff,
        difference: Math.abs(diff),
        cheaper: Math.abs(diff) < 0.005 ? 'tie' : (diff > 0 ? 'aca' : 'cobra')
      };
    }

    var scenarios = SCENARIOS.map(function (s) { return build(s.key); });
    var main = build(selected);

    return {
      months: months,
      coinsurancePct: coinsurancePct,
      expenses: expenses,
      selected: selected,
      scenarios: scenarios,
      cobra: main.cobra,
      aca: main.aca,
      savingsFromAca: main.savingsFromAca,
      difference: main.difference,
      cheaper: main.cheaper,
      colors: COLORS,
      round: round
    };
  }

  return { compute: compute, planCost: planCost, SCENARIOS: SCENARIOS, COLORS: COLORS, round: round };
});
