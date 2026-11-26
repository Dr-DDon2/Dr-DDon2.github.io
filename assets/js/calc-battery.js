/* UPS / solar battery runtime calculator — pure calculation engine.
   Works in the browser (window.BatteryCalc) and in Node / quickjs (module.exports). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.BatteryCalc = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* Depth of discharge is the share of the pack a healthy install should use.
     Lead-acid is kept near half so the battery survives its cycle rating. */
  var CHEMISTRY = {
    lifepo4: { key: 'lifepo4', label: 'LiFePO4', dod: 0.90, peukert: 1.00, lead: false, cycles: 3000 },
    liion: { key: 'liion', label: 'Lithium-ion (NMC)', dod: 0.80, peukert: 1.00, lead: false, cycles: 800 },
    agm: { key: 'agm', label: 'AGM lead-acid', dod: 0.50, peukert: 1.15, lead: true, cycles: 500 },
    gel: { key: 'gel', label: 'Gel lead-acid', dod: 0.50, peukert: 1.15, lead: true, cycles: 500 },
    flooded: { key: 'flooded', label: 'Flooded lead-acid', dod: 0.50, peukert: 1.25, lead: true, cycles: 400 }
  };

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

  function chemistryOf(key) {
    return CHEMISTRY[key] || CHEMISTRY.lifepo4;
  }

  /* Runtime for one pack. `peukertMul` is the usable-capacity factor that the
     Peukert exponent produces at this discharge current (1 when disabled). */
  function runtimeFor(chemKey, nominalWh, voltage, loadW, inverterEff, peukertEnabled, peukertExp) {
    var chem = chemistryOf(chemKey);
    var eff = inverterEff > 0 ? Math.min(inverterEff, 100) / 100 : 1;
    if (voltage <= 0 || loadW <= 0) return 0;

    var loadCurrent = loadW / (eff * voltage);
    var nominalAh = nominalWh / voltage;

    var factor = 1;
    if (peukertEnabled && chem.lead) {
      var k = isFinite(peukertExp) && peukertExp > 1 ? peukertExp : chem.peukert;
      var refCurrent = nominalAh / 20; /* capacity is quoted at the 20-hour rate */
      if (loadCurrent > 0 && refCurrent > 0) {
        factor = Math.pow(refCurrent / loadCurrent, k - 1);
        /* A very light load must not invent capacity beyond the rated Ah. */
        if (factor > 1) factor = 1;
      }
    }

    var usableAh = nominalAh * chem.dod * factor;
    var hours = usableAh / loadCurrent;
    return {
      chem: chem,
      factor: factor,
      usableAh: usableAh,
      usableWh: usableAh * voltage,
      loadCurrent: loadCurrent,
      hours: hours
    };
  }

  /**
   * compute(input)
   * input: {
   *   loadW, voltage (12|24|48|number), capacity, capacityUnit ('ah'|'wh'),
   *   chemistry ('lifepo4'|'liion'|'agm'|'gel'|'flooded'),
   *   inverterEff (%), peukert (bool), peukertExp, targetHours
   * }
   */
  function compute(input) {
    var i = input || {};
    var loadW = num(i.loadW);
    if (!isFinite(loadW) || loadW <= 0) return { error: 'Add at least one load totalling more than 0 W.' };

    var voltage = num(i.voltage);
    if (!isFinite(voltage) || voltage <= 0) return { error: 'Enter a battery voltage greater than zero.' };
    if (voltage > 1000) return { error: 'Battery voltage above 1000 V is outside this calculator.' };

    var capacity = num(i.capacity);
    if (!isFinite(capacity) || capacity <= 0) return { error: 'Enter a battery capacity greater than zero.' };

    var unit = String(i.capacityUnit || 'ah').toLowerCase();
    var nominalWh = unit === 'wh' ? capacity : capacity * voltage;
    var nominalAh = nominalWh / voltage;

    var eff = num(i.inverterEff);
    if (!isFinite(eff) || eff <= 0) eff = 90;
    if (eff > 100) eff = 100;

    var chemKey = String(i.chemistry || 'lifepo4');
    var chem = chemistryOf(chemKey);
    if (!CHEMISTRY[chemKey]) chemKey = 'lifepo4';

    var peukertOn = i.peukert === undefined ? true : !!i.peukert;
    var peukertExp = num(i.peukertExp);
    if (!isFinite(peukertExp)) peukertExp = chem.peukert;

    var main = runtimeFor(chemKey, nominalWh, voltage, loadW, eff, peukertOn, peukertExp);

    var hours = main.hours;
    var totalMinutes = Math.round(hours * 60);

    /* Same nameplate capacity in each chemistry, for the comparison table. */
    var compareKeys = ['lifepo4', 'agm'];
    var compare = compareKeys.map(function (key) {
      var r = runtimeFor(key, nominalWh, voltage, loadW, eff, peukertOn, CHEMISTRY[key].peukert);
      return {
        key: key,
        label: CHEMISTRY[key].label,
        dod: CHEMISTRY[key].dod,
        usableAh: r.usableAh,
        usableWh: r.usableWh,
        hours: r.hours
      };
    });

    var targetHours = num(i.targetHours);
    if (!isFinite(targetHours) || targetHours <= 0) targetHours = 8;
    var loadCurrent = main.loadCurrent;
    var ahForTarget = (loadCurrent * targetHours) / chem.dod;
    var whForTarget = ahForTarget * voltage;

    /* How much of the load the pack covers in a full day, useful for solar sizing. */
    var dailyShare = hours / 24;

    return {
      loadW: loadW,
      voltage: voltage,
      capacity: capacity,
      capacityUnit: unit === 'wh' ? 'wh' : 'ah',
      nominalAh: nominalAh,
      nominalWh: nominalWh,
      chemistry: chemKey,
      chemistryLabel: chem.label,
      dod: chem.dod,
      lead: chem.lead,
      inverterEff: eff,
      peukert: peukertOn,
      peukertExp: chem.lead ? peukertExp : 1,
      peukertFactor: main.factor,
      usableAh: main.usableAh,
      usableWh: main.usableWh,
      loadCurrent: loadCurrent,
      runtimeHours: hours,
      runtimeMinutes: totalMinutes,
      runtimeDays: hours / 24,
      dailyShare: dailyShare,
      targetHours: targetHours,
      ahForTarget: ahForTarget,
      whForTarget: whForTarget,
      compare: compare,
      cycles: chem.cycles,
      /* usable Wh per dollar is left to the page, which knows the price */
      chemistryTable: CHEMISTRY,
      round: round
    };
  }

  return {
    compute: compute,
    chemistryOf: chemistryOf,
    num: num,
    round: round,
    CHEMISTRY: CHEMISTRY
  };
});
