/* Calculation cases, shared by the Node runner (tests/calc.test.js) and the
   quickjs runner (tests/run_quickjs.py). No Node or browser APIs here. */
'use strict';

function runAll(Concrete, Seller, Sens) {
  var pass = 0;
  var fails = [];

  function ok(name, cond, detail) {
    if (cond) pass++;
    else fails.push(name + (detail ? ' — ' + detail : ''));
  }
  function near(name, actual, expected, tol) {
    var t = tol === undefined ? 0.005 : tol;
    ok(name, typeof actual === 'number' && isFinite(actual) && Math.abs(actual - expected) <= t,
      'expected ' + expected + ', got ' + actual);
  }
  function eq(name, actual, expected) {
    ok(name, actual === expected, 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }

  /* ---------------- 1. Concrete estimator ---------------- */
  var c1 = Concrete.compute({
    length: 10, lengthUnit: 'ft', width: 10, widthUnit: 'ft',
    thickness: 4, thicknessUnit: 'in', wastePct: 10, bagSize: '80', pricePerBag: 5.5
  });
  near('C1 area ft2', c1.areaFt2, 100, 0.001);
  near('C1 volume ft3', c1.volumeFt3, 33.3333, 0.001);
  near('C1 volume yd3', c1.volumeYd3, 1.23457, 0.0001);
  near('C1 volume m3', c1.volumeM3, 0.94400, 0.001);
  near('C1 total with waste ft3', c1.totalFt3, 36.6667, 0.001);
  near('C1 bagsExact', c1.bagsExact, 61.1111, 0.001);
  eq('C1 bags (80lb, ceil)', c1.bags, 62);
  near('C1 total cost', c1.totalCost, 341.0, 0.001);
  eq('C1 total weight lb', c1.totalWeightLb, 4960);
  eq('C1 bag table 60lb bags', c1.bagTable.filter(function (b) { return b.size === '60'; })[0].bags, 82);
  eq('C1 bag table 40lb bags', c1.bagTable.filter(function (b) { return b.size === '40'; })[0].bags, 123);
  near('C1 net share', c1.netShare, 1 / 1.1, 0.0001);
  near('C1 waste share', c1.wasteShare, 0.090909, 0.0001);

  var c2 = Concrete.compute({
    length: 4, lengthUnit: 'm', width: 3, widthUnit: 'm',
    thickness: 10, thicknessUnit: 'cm', wastePct: 5, bagSize: '60', pricePerBag: 4.25
  });
  near('C2 volume ft3', c2.volumeFt3, 42.3775, 0.01);
  near('C2 volume m3', c2.volumeM3, 1.20006, 0.002);
  near('C2 totalYd3', c2.totalYd3, 1.64801, 0.001);
  eq('C2 bags (60lb)', c2.bags, 99);
  near('C2 cost', c2.totalCost, 99 * 4.25, 0.001);

  var c3 = Concrete.compute({
    length: 12, lengthUnit: 'ftin', lengthInches: 6,
    width: 8, widthUnit: 'ft', thickness: 6, thicknessUnit: 'in',
    wastePct: 0, bagSize: '40', pricePerBag: 0
  });
  near('C3 length ft', c3.lengthFt, 12.5, 0.0001);
  near('C3 volume ft3', c3.volumeFt3, 50, 0.0001);
  near('C3 volume yd3', c3.volumeYd3, 1.85185, 0.0001);
  eq('C3 bags (40lb, no waste)', c3.bags, 167);
  eq('C3 cost is zero without price', c3.totalCost, 0);

  var c4 = Concrete.compute({
    length: 20, lengthUnit: 'ft', width: 12, widthUnit: 'ft',
    thickness: 4, thicknessUnit: 'in', wastePct: 0, bagSize: '80', pricePerBag: 6
  });
  near('C4 volume yd3', c4.volumeYd3, 2.96296, 0.0001);
  eq('C4 bags exact fit rounds up', c4.bags, 134);

  var c5 = Concrete.compute({
    length: 3, lengthUnit: 'm', width: 2, widthUnit: 'm',
    thickness: 4, thicknessUnit: 'in', wastePct: 0, bagSize: '80', pricePerBag: 6
  });
  near('C5 volume ft3', c5.volumeFt3, 21.5327, 0.01);
  eq('C5 bags', c5.bags, 36);

  var c6 = Concrete.compute({ length: 0, width: 5, thickness: 4, wastePct: 10 });
  ok('C6 rejects zero length', !!c6.error, JSON.stringify(c6));

  var c7 = Concrete.compute({ length: 10, width: 10, thickness: 4, wastePct: -5, bagSize: '80' });
  near('C7 negative waste treated as zero', c7.totalFt3, c7.volumeFt3, 0.0001);

  var c8 = Concrete.compute({ length: '10', width: '8', thickness: '4', wastePct: '10', bagSize: '80' });
  eq('C8 string inputs parsed', c8.bags, Math.ceil(10 * 8 * (4 / 12) * 1.1 / 0.6));

  var c9 = Concrete.compute({ length: 1, width: 1, thickness: 1, thicknessUnit: 'cm', wastePct: 0, bagSize: '80' });
  near('C9 1cm slab thickness in ft', c9.thicknessFt, 0.0328084, 0.0000005);

  /* ---------------- 2. Seller fee calculator ---------------- */
  var d = Seller.PLATFORM_DEFAULTS;
  near('S defaults Etsy txn', d.etsy.platformPct, 6.5, 0.0001);
  near('S defaults Etsy payment', d.etsy.paymentPct, 3, 0.0001);
  near('S defaults Etsy fixed', d.etsy.paymentFixed, 0.25, 0.0001);
  near('S defaults Etsy listing', d.etsy.listingFee, 0.20, 0.0001);
  near('S defaults TikTok referral', d.tiktok.platformPct, 6, 0.0001);

  var s1 = Seller.compute({
    platform: 'etsy', price: 45, shippingCharged: 0, shippingCost: 6, cogs: 12,
    adMode: 'none', adValue: 0
  });
  near('S1 revenue', s1.revenue, 45, 0.001);
  near('S1 platform fee', s1.platformFee, 2.925, 0.0001);
  near('S1 payment fee', s1.paymentFee, 1.60, 0.0001);
  near('S1 total fees', s1.totalFees, 4.725, 0.0001);
  near('S1 net profit', s1.netProfit, 22.275, 0.0001);
  near('S1 margin %', s1.marginPct, 49.5, 0.001);

  var s2 = Seller.compute({
    platform: 'tiktok', price: 29.99, shippingCharged: 4.99, shippingCost: 6.5, cogs: 9,
    affiliatePct: 10, adMode: 'fixed', adValue: 5
  });
  near('S2 revenue', s2.revenue, 34.98, 0.001);
  near('S2 referral fee', s2.platformFee, 2.0988, 0.0001);
  near('S2 affiliate fee', s2.affiliateFee, 2.999, 0.0001);
  near('S2 payment fee', s2.paymentFee, 1.31442, 0.0001);
  near('S2 ad spend fixed', s2.adSpend, 5, 0.0001);
  near('S2 net profit', s2.netProfit, 8.06778, 0.0001);
  near('S2 margin %', s2.marginPct, 23.064, 0.01);

  var s3 = Seller.compute({
    platform: 'etsy', price: 20, shippingCharged: 5, shippingCost: 5, cogs: 10,
    offsitePct: 0, adMode: 'percent', adValue: 10
  });
  near('S3 break-even price', s3.breakEvenPrice, 14.1925, 0.001);
  var s3check = Seller.compute({
    platform: 'etsy', price: s3.breakEvenPrice, shippingCharged: 5, shippingCost: 5, cogs: 10,
    offsitePct: 0, adMode: 'percent', adValue: 10
  });
  near('S3 profit at break-even is ~0', s3check.netProfit, 0, 0.0005);

  var s4 = Seller.compute({
    platform: 'etsy', price: 30, shippingCharged: 0, shippingCost: 4, cogs: 8,
    offsitePct: 15, adMode: 'roas', adValue: 4
  });
  near('S4 offsite fee', s4.offsiteFee, 4.5, 0.0001);
  near('S4 ROAS ad spend', s4.adSpend, 7.5, 0.0001);
  near('S4 net profit', s4.netProfit, 2.70, 0.0001);
  near('S4 margin %', s4.marginPct, 9.0, 0.001);

  var s5 = Seller.compute({
    platform: 'custom', platformPct: 20, paymentPct: 2.9, paymentFixed: 0.3,
    price: 25, shippingCharged: 0, shippingCost: 3, cogs: 20, adMode: 'none'
  });
  near('S5 net loss', s5.netProfit, -4.025, 0.0001);
  ok('S5 loss segment present', s5.segments.some(function (s) { return s.key === 'loss'; }));
  ok('S5 profit segment absent', !s5.segments.some(function (s) { return s.key === 'profit'; }));

  var segSum = s1.segments.reduce(function (a, s) { return a + s.pct; }, 0);
  near('S1 donut percentages sum to 100', segSum, 100, 0.0001);
  near('S1 profit segment matches profit', s1.segments.filter(function (s) { return s.key === 'profit'; })[0].value, s1.netProfit, 0.0001);

  var s6 = Seller.compute({
    platform: 'custom', platformPct: 60, paymentPct: 40, price: 20, shippingCharged: 0,
    shippingCost: 0, cogs: 0, adMode: 'none'
  });
  eq('S6 break-even impossible flagged', s6.breakEvenImpossible, true);

  var s7 = Seller.compute({
    platform: 'etsy', price: 40, shippingCharged: 20, shippingCost: 4, cogs: 5, adMode: 'none'
  });
  ok('S7 break-even not needed when shipping covers costs', s7.breakEvenPrice <= 0, String(s7.breakEvenPrice));
  ok('S7 note explains the case', s7.breakEvenNote.length > 0);

  var base = Seller.compute({
    platform: 'etsy', price: 30, shippingCharged: 0, shippingCost: 4, cogs: 10,
    adMode: 'fixed', adValue: 2
  });
  var pu = Seller.perUnit({
    platform: 'etsy', price: 30, shippingCharged: 0, shippingCost: 4, cogs: 10,
    adMode: 'fixed', adValue: 2, quantity: 3
  });
  near('S8 per-unit profit x3', pu.netProfit, base.netProfit * 3, 0.0001);


  var s10 = Seller.compute({
    platform: 'etsy', price: 20, shippingCharged: 0, shippingCost: 6, cogs: 15,
    offsitePct: 0, adMode: 'percent', adValue: 10
  });
  near('S10 loss case net profit', s10.netProfit, -5.35, 0.0001);
  near('S10 break-even price for the worked example', s10.breakEvenPrice, 26.64596, 0.001);
  var s10b = Seller.compute({
    platform: 'etsy', price: 29.99, shippingCharged: 0, shippingCost: 6, cogs: 15,
    offsitePct: 0, adMode: 'percent', adValue: 10
  });
  near('S10 price 29.99 profit', s10b.netProfit, 2.69195, 0.001);
  near('S10 price 29.99 margin', s10b.marginPct, 8.976, 0.01);

  var s9 = Seller.compute({ platform: 'etsy', price: 0, shippingCharged: 0, shippingCost: 2, cogs: 3, adMode: 'none' });
  ok('S9 zero price produces a loss, not NaN', s9.netProfit === -5.45, String(s9.netProfit));

  /* ---------------- 3. Sensitivity converter ---------------- */
  var e1 = Sens.fromSensitivity({ dpi: 800, game: 'valorant', sensitivity: 0.35 });
  near('E1 eDPI', e1.eDPI, 280, 0.0001);
  near('E1 counts/360', e1.counts360, 14693.8776, 0.01);
  near('E1 inches/360', e1.inches360, 18.36735, 0.0001);
  near('E1 cm/360', e1.cm360, 46.6521, 0.002);
  near('E1 deg per count', e1.degreesPerCount, 0.0245, 0.000001);

  var e2 = Sens.fromSensitivity({ dpi: 1600, game: 'cs2', sensitivity: 1 });
  near('E2 counts/360', e2.counts360, 16363.6364, 0.01);
  near('E2 cm/360', e2.cm360, 25.9773, 0.001);
  near('E2 eDPI', e2.eDPI, 1600, 0.0001);

  var e3 = Sens.toSensitivity({ dpi: 800, game: 'cs2', cm360: e1.cm360 });
  near('E3 Valorant->CS2 sensitivity', e3.sensitivity, 1.11362, 0.0005);
  near('E3 CS2 eDPI', e3.eDPI, 890.9, 0.5);

  var e4 = Sens.toSensitivity({ dpi: 800, game: 'ow2', cm360: 30 });
  near('E4 Overwatch 2 sens at 30 cm', e4.sensitivity, 5.77281, 0.0005);
  near('E4 eDPI', e4.eDPI, 4618.25, 0.5);
  near('E4 counts/360', e4.counts360, 9448.8189, 0.01);

  var all = Sens.convertAll(800, 34.29);
  eq('E5 convertAll covers every game', all.length, 7);
  var val = all.filter(function (g) { return g.game === 'valorant'; })[0];
  near('E5 34.29cm translates to Valorant sens', val.sensitivity, 0.47619, 0.0005);
  var csz = all.filter(function (g) { return g.game === 'cs2'; })[0];
  near('E5 same cm in CS2', Sens.fromSensitivity({ dpi: 800, game: 'cs2', sensitivity: csz.sensitivity }).cm360, 34.29, 0.001);

  eq('E6 band very high', Sens.band(12).key, 'very-high');
  eq('E6 band high', Sens.band(20).key, 'high');
  eq('E6 band balanced', Sens.band(30).key, 'balanced');
  eq('E6 band low', Sens.band(45).key, 'low');
  eq('E6 band very low', Sens.band(70).key, 'very-low');
  eq('E6 band boundary 25 goes up', Sens.band(25).key, 'balanced');
  eq('E6 band 15 boundary', Sens.band(15).key, 'high');
  near('E6 band position in range', Sens.bandPosition(30), 0.5, 0.0001);
  near('E6 band position max', Sens.bandPosition(120), 1, 0.0001);

  var e7 = Sens.fromSensitivity({ dpi: 800, game: 'valorant', sensitivity: 0 });
  ok('E7 rejects zero sensitivity', !!e7.error);
  var e8 = Sens.fromSensitivity({ dpi: 0, game: 'cs2', sensitivity: 1 });
  ok('E8 rejects zero DPI', !!e8.error);

  var e9 = Sens.fromSensitivity({ dpi: 800, game: 'fortnite', sensitivity: 2 });
  var e10 = Sens.toSensitivity({ dpi: 800, game: 'fortnite', cm360: e9.cm360 });
  near('E9 round trip Fortnite', e10.sensitivity, 2, 0.000001);

  var e11 = Sens.fromSensitivity({ dpi: 800, game: 'cs2', sensitivity: 1, yaw: 0.03 });
  near('E10 yaw override honoured', e11.counts360, 360 / (1 * 0.03), 0.0001);

  return { pass: pass, fails: fails };
}

if (typeof module === 'object' && module.exports) module.exports = { runAll: runAll };
