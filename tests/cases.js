/* Calculation cases, shared by the Node runner (tests/calc.test.js) and the
   quickjs runner (tests/run_quickjs.py). No Node or browser APIs here. */
'use strict';

function runAll(Concrete, Seller, Sens, Trucking, Gravel, Cobra, Ev, Stair, Battery, Streamer, Print3D, ExifScan) {
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

  /* ---------------- 4. Trucking cost per mile ---------------- */
  var t1 = Trucking.compute({
    loadedMiles: 500, deadheadMiles: 60, rateMode: 'permile', rate: 2.40,
    brokerPct: 8, factoringPct: 3, mpg: 6.5, fuelPrice: 3.85,
    maintPerMile: 0.18, insPerMile: 0.09, fixedCost: 150, hours: 11
  });
  near('T1 total miles', t1.totalMiles, 560, 0.0001);
  near('T1 gross revenue', t1.grossRevenue, 1200, 0.0001);
  near('T1 fees 11%', t1.fees, 132, 0.0001);
  near('T1 net revenue', t1.netRevenue, 1068, 0.0001);
  near('T1 gallons', t1.gallons, 86.153846, 0.0001);
  near('T1 fuel cost', t1.fuelCost, 331.69231, 0.001);
  near('T1 operating cost', t1.totalCost, 632.89231, 0.001);
  near('T1 cost per mile', t1.costPerMile, 1.1301648, 0.0001);
  near('T1 all-in cost per mile', t1.allInCostPerMile, 1.3658791, 0.0001);
  near('T1 net profit', t1.netProfit, 435.10769, 0.001);
  near('T1 profit per mile', t1.profitPerMile, 0.776978, 0.00001);
  near('T1 revenue per mile', t1.revenuePerMile, 1.9071429, 0.0001);
  near('T1 break-even rate per loaded mile', t1.breakEvenRate, 1.4222299, 0.0001);
  near('T1 profit per hour', t1.profitPerHour, 39.5552, 0.001);
  near('T1 margin %', t1.marginPct, 40.7404, 0.001);
  near('T1 deadhead %', t1.deadheadPct, 10.714286, 0.0001);
  near('T1 fuel segment cents per mile', t1.segments[0].centsPerMile, 59.2308, 0.001);
  near('T1 segments sum to all-in cost', t1.segments.reduce(function (a, s) { return a + s.value; }, 0), t1.allInCost, 0.0001);
  near('T1 segment pct sums to 100', t1.segments.reduce(function (a, s) { return a + s.pct; }, 0), 100, 0.0001);

  var t2 = Trucking.compute({
    loadedMiles: 400, deadheadMiles: 100, rateMode: 'flat', rate: 900,
    brokerPct: 10, factoringPct: 0, mpg: 5, fuelPrice: 3.70,
    maintPerMile: 0.20, insPerMile: 0.10, fixedCost: 0
  });
  near('T2 gross flat revenue', t2.grossRevenue, 900, 0.0001);
  near('T2 operating cost', t2.totalCost, 520, 0.0001);
  near('T2 net profit', t2.netProfit, 290, 0.0001);
  near('T2 break-even flat rate', t2.breakEvenRate, 577.7778, 0.001);
  near('T2 break-even per total mile', t2.breakEvenPerTotalMile, 1.1555556, 0.0001);
  eq('T2 hours omitted gives zero per hour', t2.profitPerHour, 0);

  var t3 = Trucking.compute({ loadedMiles: 300, deadheadMiles: 0, rate: 2, mpg: 0, fuelPrice: 3.5 });
  ok('T3 zero MPG with a fuel price is rejected', !!t3.error, JSON.stringify(t3));
  var t4 = Trucking.compute({ loadedMiles: 0, deadheadMiles: 0, rate: 2 });
  ok('T4 zero miles rejected', !!t4.error);
  var t5 = Trucking.compute({ loadedMiles: 0, deadheadMiles: 80, rateMode: 'permile', rate: 3 });
  ok('T5 per-mile rate with no loaded miles rejected', !!t5.error);
  var t6 = Trucking.compute({ loadedMiles: 100, rateMode: 'permile', rate: 2, brokerPct: 60, factoringPct: 40, mpg: 6 });
  ok('T6 fees of 100% rejected', !!t6.error);
  var t7 = Trucking.compute({ loadedMiles: 100, rateMode: 'flat', rate: 500, brokerPct: 0, factoringPct: 0, mpg: 8, fuelPrice: 0, maintPerMile: 0, insPerMile: 0, fixedCost: 0 });
  near('T7 free fuel and no costs give 100% margin', t7.marginPct, 100, 0.0001);
  near('T7 break-even rate equals cost', t7.breakEvenRate, 0, 0.0001);

  /* ---------------- 5. Gravel, mulch and decking ---------------- */
  eq('G1 material table has pea gravel', Gravel.MATERIALS.peagravel.label, 'Pea gravel');
  near('G1 mulch density', Gravel.MATERIALS.mulch.tonPerYd3, 0.40, 0.0001);

  var g1 = Gravel.computeBulk({
    length: 20, lengthUnit: 'ft', width: 10, widthUnit: 'ft',
    depth: 2, depthUnit: 'in', material: 'mulch', wastePct: 5, priceMode: 'yd3', price: 38
  });
  near('G1 area', g1.areaFt2, 200, 0.0001);
  near('G1 net volume ft3', g1.volumeFt3, 33.33333, 0.001);
  near('G1 net volume yd3', g1.volumeYd3, 1.2345679, 0.0001);
  near('G1 total yd3 with 5% waste', g1.totalYd3, 1.2962963, 0.0001);
  near('G1 total ft3 with waste', g1.totalFt3, 35, 0.0001);
  near('G1 tons of mulch', g1.tons, 0.5185185, 0.0001);
  eq('G1 two cubic foot bags', g1.bags, 18);
  near('G1 cost by the yard', g1.cost, 49.2593, 0.001);
  near('G1 coverage per yard at 2 in', g1.coverageFt2PerYd3, 162, 0.0001);

  var g2 = Gravel.computeBulk({
    length: 4, lengthUnit: 'm', width: 3, widthUnit: 'm',
    depth: 5, depthUnit: 'cm', material: 'peagravel', wastePct: 0, priceMode: 'ton', price: 55
  });
  near('G2 area ft2', g2.areaFt2, 129.1669, 0.01);
  near('G2 volume ft3', g2.volumeFt3, 21.1888, 0.01);
  near('G2 volume m3', g2.totalM3, 0.60, 0.001);
  near('G2 tons', g2.tons, 1.05944, 0.001);
  near('G2 cost by the ton', g2.cost, 58.2692, 0.01);

  var g3 = Gravel.computeBulk({
    length: 10, lengthUnit: 'ft', width: 10, widthUnit: 'ft',
    depth: 4, depthUnit: 'in', material: 'crushedstone', wastePct: 10, priceMode: 'bag', price: 6
  });
  near('G3 total ft3', g3.totalFt3, 36.6667, 0.001);
  eq('G3 bags rounded up', g3.bags, 19);
  near('G3 cost by the bag', g3.cost, 114, 0.0001);

  var g4 = Gravel.computeBulk({ length: 0, lengthUnit: 'ft', width: 10, widthUnit: 'ft', depth: 2, depthUnit: 'in' });
  ok('G4 zero length rejected', !!g4.error);
  var g5 = Gravel.computeBulk({ length: 10, lengthUnit: 'ft', width: 10, widthUnit: 'ft', depth: 0.5, depthUnit: 'ft', material: 'sand' });
  near('G5 depth in feet', g5.volumeFt3, 50, 0.0001);
  var g6 = Gravel.computeBulk({ length: 12, lengthUnit: 'ftin', lengthInches: 6, width: 10, widthUnit: 'ft', depth: 3, depthUnit: 'in', material: 'topsoil' });
  near('G6 feet plus inches length', g6.lengthFt, 12.5, 0.0001);
  near('G6 volume', g6.volumeFt3, 31.25, 0.0001);
  var g7 = Gravel.computeBulk({ length: 10, lengthUnit: 'ft', width: 10, widthUnit: 'ft', depth: 0, depthUnit: 'in' });
  ok('G7 zero depth rejected', !!g7.error);

  var d1 = Gravel.computeDeck({
    length: 16, width: 12, boardWidth: 5.5, gapIn: 0.125, wastePct: 5,
    boardLengthFt: 12, joistSpacingIn: 16, pricePerBoard: 18
  });
  near('D1 pitch', d1.pitchIn, 5.625, 0.0001);
  eq('D1 board rows', d1.rows, 26);
  near('D1 surface linear feet', d1.surfaceLinearFt, 416, 0.0001);
  near('D1 linear feet with waste', d1.linearFtWithWaste, 436.8, 0.0001);
  eq('D1 boards needed', d1.boards, 37);
  near('D1 offcut', d1.offcutFt, 7.2, 0.0001);
  eq('D1 joists', d1.joistCount, 13);
  eq('D1 screws', d1.screws, 1011);
  near('D1 board cost', d1.cost, 666, 0.0001);
  near('D1 deck area', d1.deckAreaFt2, 192, 0.0001);

  var d2 = Gravel.computeDeck({
    length: 10, width: 8, boardWidth: 3.5, gapIn: 0.125, wastePct: 0,
    boardLengthFt: 8, joistSpacingIn: 12
  });
  eq('D2 rows with 3.5 in boards', d2.rows, 27);
  eq('D2 boards at 8 ft', d2.boards, 34);
  eq('D2 joists at 12 in spacing', d2.joistCount, 11);
  eq('D2 screws', d2.screws, 786);
  eq('D2 no price means no cost', d2.cost, 0);

  var d3 = Gravel.computeDeck({ length: 10, width: 0, boardWidth: 5.5 });
  ok('D3 zero width rejected', !!d3.error);

  /* ---------------- 6. COBRA vs ACA ---------------- */
  var k1 = Cobra.compute({
    months: 6, coinsurancePct: 20,
    cobra: { premium: 720, deductible: 3000, deductibleMet: 1200, oopMax: 8500, oopSpent: 1500 },
    aca: { premium: 480, deductible: 4500, deductibleMet: 0, oopMax: 9200, oopSpent: 0 },
    low: 600, typical: 3500, high: 15000, scenario: 'typical'
  });
  near('K1 COBRA premium for 6 months', k1.cobra.premium, 4320, 0.0001);
  near('K1 COBRA deductible remaining', k1.cobra.deductibleRemaining, 1800, 0.0001);
  near('K1 COBRA coinsurance', k1.cobra.coinsurance, 340, 0.0001);
  near('K1 COBRA out of pocket', k1.cobra.outOfPocket, 2140, 0.0001);
  near('K1 COBRA total', k1.cobra.total, 6460, 0.0001);
  near('K1 ACA deductible remaining', k1.aca.deductibleRemaining, 4500, 0.0001);
  near('K1 ACA out of pocket', k1.aca.outOfPocket, 3500, 0.0001);
  near('K1 ACA total', k1.aca.total, 6380, 0.0001);
  near('K1 ACA saves 80', k1.savingsFromAca, 80, 0.0001);
  eq('K1 cheaper plan is ACA', k1.cheaper, 'aca');
  near('K1 low-use COBRA total', k1.scenarios[0].cobra.total, 4920, 0.0001);
  near('K1 low-use ACA total', k1.scenarios[0].aca.total, 3480, 0.0001);
  near('K1 high-use COBRA total', k1.scenarios[2].cobra.total, 8760, 0.0001);
  near('K1 high-use ACA total', k1.scenarios[2].aca.total, 9480, 0.0001);
  eq('K1 high use flips to COBRA', k1.scenarios[2].cheaper, 'cobra');
  eq('K1 three scenarios', k1.scenarios.length, 3);

  var k2 = Cobra.compute({
    months: 6, coinsurancePct: 20,
    cobra: { premium: 720, deductible: 3000, deductibleMet: 1200, oopMax: 5000, oopSpent: 1000 },
    aca: { premium: 480, deductible: 4500, oopMax: 9200 },
    typical: 100000, scenario: 'typical'
  });
  near('K2 COBRA capped at remaining out-of-pocket maximum', k2.cobra.outOfPocket, 4000, 0.0001);
  near('K2 COBRA total with cap', k2.cobra.total, 8320, 0.0001);
  near('K2 ACA care before cap', k2.aca.careBeforeCap, 23600, 0.0001);
  near('K2 ACA capped at 9200', k2.aca.outOfPocket, 9200, 0.0001);
  eq('K2 with the cap COBRA is cheaper', k2.cheaper, 'cobra');

  var k3 = Cobra.compute({ months: 20, cobra: { premium: 700 }, aca: { premium: 400 } });
  near('K3 months clamped to 12', k3.months, 12, 0.0001);
  var k4 = Cobra.compute({ months: 0, cobra: { premium: 700 }, aca: { premium: 400 } });
  ok('K4 zero months rejected', !!k4.error);
  var k5 = Cobra.compute({ months: 3, cobra: { premium: 700 }, aca: { premium: 700 } });
  eq('K5 identical plans tie', k5.cheaper, 'tie');
  var k6 = Cobra.compute({ months: 1, coinsurancePct: 20, cobra: { premium: 600, deductible: 0, oopMax: 0 }, aca: { premium: 500, deductible: 0 }, typical: 1000 });
  near('K6 no deductible, no cap: full care cost', k6.cobra.outOfPocket, 200, 0.0001);
  near('K6 total is premium plus care', k6.cobra.total, 800, 0.0001);

  /* ---------------- 7. EV vs gas ---------------- */
  var v1 = Ev.compute({
    annualMiles: 13500, evMilesPerKwh: 3.5, homeRate: 0.16, homeSharePct: 80,
    publicRate: 0.45, gasMpg: 30, gasPrice: 3.60
  });
  near('V1 blended electricity rate', v1.blendedRate, 0.218, 0.0001);
  near('V1 EV cost per mile', v1.evCostPerMile, 0.0622857, 0.000001);
  near('V1 EV cost per 100 miles', v1.evPer100, 6.228571, 0.0001);
  near('V1 gas cost per 100 miles', v1.gasPer100, 12, 0.0001);
  near('V1 EV annual cost', v1.evAnnualCost, 840.8571, 0.001);
  near('V1 gas annual cost', v1.gasAnnualCost, 1620, 0.0001);
  near('V1 annual savings', v1.annualSavings, 779.1429, 0.001);
  near('V1 monthly savings', v1.monthlySavings, 64.9286, 0.001);
  near('V1 five-year savings', v1.totalSavings, 3895.714, 0.01);
  near('V1 savings percent of gas cost', v1.savingsPct, 48.0952, 0.001);
  near('V1 MPGe', v1.evMpge, 117.9675, 0.001);
  near('V1 kWh per year', v1.evKwhPerYear, 3857.1429, 0.001);
  near('V1 gallons of gas equivalent', v1.gallonsEquivalent, 114.435, 0.01);
  near('V1 EV bar is the full 100%', v1.evBarPct, 51.9048, 0.001);

  var v2 = Ev.compute({
    annualMiles: 12000, evMilesPerKwh: 2.8, homeRate: 0.16, homeSharePct: 0,
    publicRate: 0.45, gasMpg: 22, gasPrice: 4.00, years: 3
  });
  near('V2 all public charging uses fast rate', v2.blendedRate, 0.45, 0.0001);
  near('V2 EV cost per 100', v2.evPer100, 16.0714, 0.0001);
  near('V2 gas cost per 100', v2.gasPer100, 18.1818, 0.0001);
  near('V2 annual savings', v2.annualSavings, 253.2468, 0.001);
  near('V2 three-year savings', v2.totalSavings, 759.740, 0.01);

  var v3 = Ev.compute({ annualMiles: 0, evMilesPerKwh: 3.5, gasMpg: 30, gasPrice: 3.6 });
  ok('V3 zero miles rejected', !!v3.error);
  var v4 = Ev.compute({ annualMiles: 10000, evMilesPerKwh: 0, gasMpg: 30, gasPrice: 3.6 });
  ok('V4 zero EV efficiency rejected', !!v4.error);
  var v5 = Ev.compute({ annualMiles: 10000, evMilesPerKwh: 3.5, gasMpg: 0, gasPrice: 3.6 });
  ok('V5 zero MPG rejected', !!v5.error);
  var v6 = Ev.compute({ annualMiles: 10000, evMilesPerKwh: 3.5, homeRate: 0, homeSharePct: 100, publicRate: 0.5, gasMpg: 30, gasPrice: 3.6 });
  near('V6 free home charging means zero fuel cost', v6.evAnnualCost, 0, 0.0001);
  near('V6 savings equal the whole gas bill', v6.annualSavings, 1200, 0.0001);

  /* ---------------- 8. Stairs and roof pitch ---------------- */
  var s1 = Stair.computeStairs({
    rise: 9, riseUnit: 'ftin', riseInches: 0, riseSixteenths: 0,
    targetRiserIn: 7.5, treadDepthIn: 10.5, widthIn: 36
  });
  eq('S1 risers for a 9 ft rise', s1.risers, 14);
  near('S1 riser height', s1.riserIn, 7.714286, 0.0001);
  eq('S1 treads are one fewer than risers', s1.treads, 13);
  near('S1 total run', s1.runIn, 136.5, 0.0001);
  near('S1 stringer length', s1.stringerIn, 174.0582, 0.001);
  near('S1 stair angle', s1.angleDeg, 38.3514, 0.01);
  eq('S1 riser passes the IRC limit', s1.riserOk, true);
  eq('S1 tread passes the IRC limit', s1.treadOk, true);
  eq('S1 whole stair passes', s1.codePass, true);
  near('S1 stock length adds a foot', s1.stringerOrderIn, 186.0582, 0.001);

  var s2 = Stair.computeStairs({ rise: 100, riseUnit: 'in', targetRiserIn: 7.5, treadDepthIn: 10.5 });
  eq('S2 risers for a 100 in rise', s2.risers, 13);
  near('S2 riser height', s2.riserIn, 7.692308, 0.0001);
  near('S2 stringer', s2.stringerIn, 160.8602, 0.001);
  eq('S2 still passes', s2.codePass, true);

  var s3 = Stair.computeStairs({ rise: 96, riseUnit: 'in', targetRiserIn: 8, treadDepthIn: 10.5 });
  eq('S3 target riser clamped, 12 risers', s3.risers, 12);
  near('S3 riser is 8 in', s3.riserIn, 8, 0.0001);
  eq('S3 flags the riser over 7.75 in', s3.riserOk, false);
  eq('S3 fails the code check', s3.codePass, false);

  var s4 = Stair.computeStairs({ rise: 9, riseUnit: 'ftin', targetRiserIn: 7.5, treadDepthIn: 9.5 });
  eq('S4 shallow tread flagged', s4.treadOk, false);
  eq('S4 fails overall', s4.codePass, false);

  var s5 = Stair.computeStairs({ rise: 2500, riseUnit: 'mm', targetRiserIn: 7.5, treadDepthIn: 10.5 });
  near('S5 mm rise converted to inches', s5.totalRiseIn, 98.4252, 0.001);
  eq('S5 risers', s5.risers, 13);
  near('S5 riser height', s5.riserIn, 7.571169, 0.0001);
  eq('S5 passes', s5.codePass, true);

  var s6 = Stair.computeStairs({ rise: 9, riseUnit: 'ftin', riseInches: 8, riseSixteenths: 8, targetRiserIn: 7.5, treadDepthIn: 10.5 });
  near('S6 feet, inches and sixteenths', s6.totalRiseIn, 116.5, 0.0001);
  eq('S6 formatted length', Stair.toFeetInches(174.0582), '14\u2032 6\u2033 1/16');
  eq('S6 inch fraction 7.75', Stair.toInchFrac(7.75), '7 3/4');
  eq('S6 inch fraction 10.5', Stair.toInchFrac(10.5), '10 1/2');
  eq('S6 inch fraction 7.714286', Stair.toInchFrac(7.714286), '7 11/16');
  eq('S6 whole inches', Stair.toInchFrac(12), '12');

  var s7 = Stair.computeStairs({ rise: 0, riseUnit: 'in' });
  ok('S7 zero rise rejected', !!s7.error);
  var s8 = Stair.computeStairs({ rise: 300, riseUnit: 'in' });
  ok('S8 absurd rise rejected', !!s8.error);

  var r1 = Stair.computeRoof({ pitch: 4, runFt: 12, overhangFt: 0 });
  near('R1 pitch angle', r1.angleDeg, 18.4349, 0.001);
  near('R1 slope percent', r1.slopePct, 33.3333, 0.001);
  near('R1 common rafter multiplier', r1.commonMult, 1.054093, 0.000001);
  near('R1 hip multiplier', r1.hipMult, 1.452966, 0.000001);
  near('R1 common rafter length', r1.commonRafterFt, 12.649111, 0.001);
  near('R1 hip rafter length', r1.hipRafterFt, 17.435596, 0.001);
  near('R1 ridge rise', r1.riseFt, 4, 0.0001);

  var r2 = Stair.computeRoof({ pitch: 6, runFt: 10, overhangFt: 2 });
  near('R2 angle', r2.angleDeg, 26.565051, 0.0001);
  near('R2 common multiplier', r2.commonMult, 1.118034, 0.000001);
  near('R2 hip multiplier', r2.hipMult, 1.5, 0.000001);
  near('R2 common rafter with overhang', r2.commonRafterFt, 13.416408, 0.001);
  near('R2 hip rafter with overhang', r2.hipRafterFt, 18, 0.0001);
  near('R2 total rise', r2.totalRiseFt, 6, 0.0001);

  var r3 = Stair.computeRoof({ pitch: 12, runFt: 10, overhangFt: 0 });
  near('R3 12:12 is 45 degrees', r3.angleDeg, 45, 0.0001);
  near('R3 slope is 100 percent', r3.slopePct, 100, 0.0001);
  near('R3 common multiplier is root 2', r3.commonMult, 1.414214, 0.000001);
  near('R3 hip multiplier', r3.hipMult, 1.732051, 0.000001);
  var r4 = Stair.computeRoof({ pitch: 0, runFt: 10 });
  ok('R4 flat pitch rejected', !!r4.error);

  /* ---------------- 9. Battery runtime ---------------- */
  var b1 = Battery.compute({ loadW: 100, voltage: 12, capacity: 100, capacityUnit: 'ah', chemistry: 'lifepo4', inverterEff: 90 });
  near('B1 nominal Wh', b1.nominalWh, 1200, 0.0001);
  near('B1 load current', b1.loadCurrent, 9.259259, 0.00001);
  near('B1 usable Ah at 90 percent DoD', b1.usableAh, 90, 0.0001);
  near('B1 runtime hours', b1.runtimeHours, 9.72, 0.0001);
  eq('B1 runtime minutes', b1.runtimeMinutes, 583);
  near('B1 LiFePO4 comparison row', b1.compare[0].hours, 9.72, 0.0001);

  var b2 = Battery.compute({ loadW: 100, voltage: 12, capacity: 100, capacityUnit: 'ah', chemistry: 'agm', inverterEff: 90, peukert: true, peukertExp: 1.25 });
  near('B2 Peukert factor', b2.peukertFactor, 0.857232, 0.00001);
  near('B2 usable Ah', b2.usableAh, 42.8616, 0.001);
  near('B2 runtime hours', b2.runtimeHours, 4.62905, 0.0001);
  near('B2 lead row uses the AGM default exponent', b2.compare[1].hours, 4.92326, 0.0001);

  var b3 = Battery.compute({ loadW: 100, voltage: 12, capacity: 100, capacityUnit: 'ah', chemistry: 'agm', inverterEff: 90, peukert: false });
  near('B3 Peukert off gives the rated half', b3.usableAh, 50, 0.0001);
  near('B3 runtime hours', b3.runtimeHours, 5.4, 0.0001);

  var b4 = Battery.compute({ loadW: 200, voltage: 12, capacity: 1280, capacityUnit: 'wh', chemistry: 'lifepo4', inverterEff: 90 });
  near('B4 Wh input, nominal Ah', b4.nominalAh, 106.6667, 0.001);
  near('B4 runtime hours', b4.runtimeHours, 5.184, 0.0001);

  var b5 = Battery.compute({ loadW: 100, voltage: 12, capacity: 100, capacityUnit: 'ah', chemistry: 'lifepo4', inverterEff: 90, targetHours: 8 });
  near('B5 Ah needed for the target hours', b5.ahForTarget, 82.3045, 0.001);
  near('B5 Wh needed for the target hours', b5.whForTarget, 987.654, 0.01);

  var b6 = Battery.compute({ loadW: 0, voltage: 12, capacity: 100 });
  ok('B6 zero load rejected', !!b6.error);
  var b7 = Battery.compute({ loadW: 100, voltage: 12, capacity: 0 });
  ok('B7 zero capacity rejected', !!b7.error);
  var b8 = Battery.compute({ loadW: 100, voltage: 0, capacity: 100 });
  ok('B8 zero voltage rejected', !!b8.error);
  var b9 = Battery.compute({ loadW: 50, voltage: 48, capacity: 100, capacityUnit: 'ah', chemistry: 'lifepo4', inverterEff: 100 });
  near('B9 48 V pack at full efficiency', b9.runtimeHours, 86.4, 0.0001);

  /* ---------------- 10. Streamer payout ---------------- */
  var w1 = Streamer.compute({ platform: 'twitch', bits: 5000, tier1: 100, tier2: 0, tier3: 0, partnerPlus: false, inApp: false, taxRatePct: 0 });
  near('W1 bits pay one cent each', w1.lines[0].creator, 50, 0.0001);
  near('W1 tier 1 at 50 percent', w1.lines[1].creator, 249.5, 0.0001);
  near('W1 creator total', w1.creatorTotal, 299.5, 0.0001);
  near('W1 gross', w1.grossTotal, 549, 0.0001);
  near('W1 net with no withholding', w1.net, 299.5, 0.0001);
  near('W1 take of gross', w1.takeOfGross, 0.545537, 0.000001);

  var w2 = Streamer.compute({ platform: 'twitch', tier1: 100, inApp: true, taxRatePct: 0 });
  near('W2 app store cut before the split', w2.creatorTotal, 174.65, 0.0001);
  near('W2 store fee recorded', w2.storeTotal, 149.7, 0.0001);

  var w3 = Streamer.compute({ platform: 'twitch', tier1: 100, partnerPlus: true, taxRatePct: 0 });
  near('W3 Partner Plus 70 percent', w3.creatorTotal, 349.3, 0.0001);

  var w4 = Streamer.compute({ platform: 'youtube', superChatGross: 1000, memberships: 200, memberPrice: 4.99, inApp: false, taxRatePct: 0 });
  near('W4 YouTube gross', w4.grossTotal, 1998, 0.0001);
  near('W4 YouTube 70 percent', w4.creatorTotal, 1398.6, 0.0001);

  var w5 = Streamer.compute({ platform: 'youtube', superChatGross: 1000, memberships: 200, memberPrice: 4.99, inApp: true, taxRatePct: 0 });
  near('W5 iOS purchase halves the take', w5.creatorTotal, 979.02, 0.0001);

  var w6 = Streamer.compute({ platform: 'kick', tier1: 100, tier2: 10, taxRatePct: 0 });
  near('W6 Kick gross', w6.grossTotal, 598.9, 0.0001);
  near('W6 Kick 95 percent', w6.creatorTotal, 568.955, 0.0001);

  var w7 = Streamer.compute({ platform: 'twitch', bits: 5000, tier1: 100, taxRatePct: 30 });
  near('W7 30 percent withholding', w7.net, 209.65, 0.0001);
  var w8 = Streamer.compute({ platform: 'twitch', bits: 5000, tier1: 100, taxRatePct: 15 });
  near('W8 15 percent treaty rate', w8.net, 254.575, 0.0001);

  var w9 = Streamer.compute({ platform: 'twitch' });
  ok('W9 empty activity rejected', !!w9.error);
  var w10 = Streamer.compare({ tier1: 100, bits: 0, taxRatePct: 0 });
  eq('W10 comparison covers three platforms', w10.rows.length, 3);
  eq('W10 Kick wins a plain tier 1 sub', w10.best, 'kick');

  /* ---------------- 11. 3D print cost ---------------- */
  var p1 = Print3D.compute({
    spoolPrice: 25, spoolWeightG: 1000, modelG: 120, purgeG: 40, supportG: 20,
    printHours: 8, powerW: 120, kwhPrice: 0.16, printerPrice: 600, lifeHours: 4000,
    laborMin: 0, laborRate: 0, extraCost: 0, failPct: 5, marginPct: 30, feePct: 9.5, feeFlat: 0.2
  });
  near('P1 cost per gram', p1.costPerG, 0.025, 0.000001);
  near('P1 material grams including purge and support', p1.materialG, 180, 0.0001);
  near('P1 material cost', p1.materialCost, 4.5, 0.0001);
  near('P1 energy cost', p1.energyCost, 0.1536, 0.00001);
  near('P1 depreciation', p1.deprCost, 1.2, 0.0001);
  near('P1 failure multiplier', p1.wasteMultiplier, 1.052632, 0.000001);
  near('P1 total cost with failures', p1.cost, 6.16168, 0.0001);
  near('P1 recommended price', p1.price, 10.51518, 0.0001);
  near('P1 marketplace fee', p1.feeAmount, 1.198942, 0.0001);
  near('P1 profit', p1.profit, 3.154554, 0.0001);
  near('P1 realised margin', p1.margin, 0.3, 0.000001);
  near('P1 break-even price', p1.breakEvenPrice, 7.029485, 0.0001);
  near('P1 purge share of the filament', p1.purgeShare, 0.222222, 0.000001);

  var p2 = Print3D.compute({
    spoolPrice: 20, spoolWeightG: 1000, modelG: 50, purgeG: 0, supportG: 0,
    printHours: 2, powerW: 100, kwhPrice: 0.20, printerPrice: 300, lifeHours: 3000,
    laborMin: 10, laborRate: 18, extraCost: 0.5, failPct: 0, marginPct: 40, feePct: 0, feeFlat: 0
  });
  near('P2 material cost', p2.materialCost, 1.0, 0.0001);
  near('P2 labour', p2.laborCost, 3, 0.0001);
  near('P2 total cost', p2.cost, 1 + 0.04 + 0.2 + 3 + 0.5, 0.0001);
  near('P2 price at 40 percent margin', p2.price, (4.74) / 0.6, 0.0001);
  near('P2 profit', p2.profit, 4.74 * 0.4 / 0.6, 0.0001);

  var p3 = Print3D.compute({ spoolPrice: 25, spoolWeightG: 1000, modelG: 0 });
  ok('P3 zero part weight rejected', !!p3.error);
  var p4 = Print3D.compute({ spoolPrice: 25, spoolWeightG: 0, modelG: 100 });
  ok('P4 zero spool weight rejected', !!p4.error);
  var p5 = Print3D.compute({ spoolPrice: 25, spoolWeightG: 1000, modelG: 100, printHours: 4, marginPct: 80, feePct: 25 });
  ok('P5 margin plus fees over 100 rejected', !!p5.error);

  /* ---------------- 12. EXIF scanner ---------------- */
  function bytesOf(str) {
    var a = [];
    for (var n = 0; n < str.length; n++) a.push(str.charCodeAt(n) & 255);
    return a;
  }
  function be16(n) { return [(n >> 8) & 255, n & 255]; }
  function le16(n) { return [n & 255, (n >> 8) & 255]; }
  function be32(n) { return [(n >> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function le32(n) { return [n & 255, (n >> 8) & 255, (n >> 16) & 255, (n >> 24) & 255]; }
  function entry(tag, type, count, value4) { return le16(tag).concat(le16(type), le32(count), value4); }

  function tiffWithExif() {
    var make = bytesOf('Canon\u0000');
    var model = bytesOf('EOS R6\u0000');
    var date = bytesOf('2024:05:01 12:34:56\u0000');
    var ifd0Len = 2 + 4 * 12 + 4;
    var makeOff = 8 + ifd0Len;
    var modelOff = makeOff + make.length;
    var exifIfdOff = modelOff + model.length;
    var dateOff = exifIfdOff + 2 + 12 + 4;
    var gpsOff = dateOff + date.length;
    var ratOff = gpsOff + 2 + 24 + 4;

    var t = bytesOf('II').concat(le16(42), le32(8));
    t = t.concat(le16(4));
    t = t.concat(entry(0x010F, 2, make.length, le32(makeOff)));
    t = t.concat(entry(0x0110, 2, model.length, le32(modelOff)));
    t = t.concat(entry(0x8769, 4, 1, le32(exifIfdOff)));
    t = t.concat(entry(0x8825, 4, 1, le32(gpsOff)));
    t = t.concat(le32(0));
    t = t.concat(make, model, le16(1), entry(0x9003, 2, date.length, le32(dateOff)), le32(0));
    t = t.concat(date);
    t = t.concat(le16(2));
    t = t.concat(entry(0x0001, 2, 2, [0x4E, 0, 0, 0]));
    t = t.concat(entry(0x0002, 5, 3, le32(ratOff)));
    t = t.concat(le32(0));
    t = t.concat(le32(37), le32(1), le32(46), le32(1), le32(3000), le32(100));
    return t;
  }

  function jpegWithExif() {
    var payload = bytesOf('Exif\u0000\u0000').concat(tiffWithExif());
    var segLen = payload.length + 2;
    var out = [0xFF, 0xD8, 0xFF, 0xE1].concat(be16(segLen), payload);
    out = out.concat([0xFF, 0xDA], be16(12), [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0xFF, 0xD9]);
    return new Uint8Array(out);
  }
  function plainJpeg() {
    return new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10].concat(bytesOf('JFIF\u0000'), [1, 1, 0, 0, 1, 0, 1, 0, 0], [0xFF, 0xDA, 0x00, 0x0C], [0, 0, 0, 0, 0, 0, 0, 0, 0, 0], [0xFF, 0xD9]));
  }
  function pngWith(chunks) {
    var out = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
    chunks.forEach(function (c) { out = out.concat(be32(c.data.length), bytesOf(c.type), c.data, [0, 0, 0, 0]); });
    out = out.concat(be32(0), bytesOf('IEND'), [0, 0, 0, 0]);
    return new Uint8Array(out);
  }
  function webpWith(chunks) {
    var body = bytesOf('WEBP');
    chunks.forEach(function (c) {
      body = body.concat(bytesOf(c.type), le32(c.data.length), c.data);
      if (c.data.length % 2) body.push(0);
    });
    return new Uint8Array(bytesOf('RIFF').concat(le32(body.length), body));
  }

  var x1 = ExifScan.summarize(jpegWithExif());
  eq('X1 detected as JPEG', x1.type, 'jpeg');
  eq('X1 EXIF seen', x1.hasExif, true);
  eq('X1 GPS seen', x1.hasGps, true);
  eq('X1 camera make', x1.make, 'Canon');
  eq('X1 camera model', x1.model, 'EOS R6');
  eq('X1 original date', x1.dateTimeOriginal, '2024:05:01 12:34:56');
  eq('X1 risk is GPS', x1.risk, 'gps');
  ok('X1 fields list camera and location', x1.fields.some(function (f) { return f.key === 'camera'; }) && x1.fields.some(function (f) { return f.key === 'gps'; }));

  var x2 = ExifScan.summarize(plainJpeg());
  eq('X2 plain JPEG still a JPEG', x2.type, 'jpeg');
  eq('X2 no EXIF', x2.hasExif, false);
  eq('X2 risk is clean', x2.risk, 'clean');
  eq('X2 no fields to strip', x2.fields.length, 0);

  var x3 = ExifScan.summarize(pngWith([
    { type: 'IHDR', data: [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0] },
    { type: 'eXIf', data: tiffWithExif() }
  ]));
  eq('X3 detected as PNG', x3.type, 'png');
  eq('X3 PNG EXIF chunk seen', x3.hasExif, true);
  eq('X3 PNG GPS read', x3.hasGps, true);

  var x4 = ExifScan.summarize(pngWith([
    { type: 'IHDR', data: [0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0] },
    { type: 'tEXt', data: bytesOf('Comment\u0000made on a phone') }
  ]));
  eq('X4 text chunk seen', x4.hasText, true);
  eq('X4 risk is metadata', x4.risk, 'meta');

  var x5 = ExifScan.summarize(webpWith([
    { type: 'VP8X', data: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    { type: 'EXIF', data: tiffWithExif() }
  ]));
  eq('X5 detected as WebP', x5.type, 'webp');
  eq('X5 WebP EXIF chunk seen', x5.hasExif, true);
  eq('X5 WebP camera read', x5.make, 'Canon');

  var x6 = ExifScan.summarize(bytesOf('not an image at all'));
  eq('X6 unknown bytes have no type', x6.type, null);
  eq('X6 unknown bytes unsupported', x6.supported, false);
  var x7 = ExifScan.summarize(new Uint8Array(0));
  eq('X7 empty input is safe', x7.size, 0);

  eq('X8 clean name for a HEIC', ExifScan.cleanFileName('IMG_2041.HEIC'), 'IMG_2041-clean.jpg');
  eq('X9 clean name keeps the PNG type', ExifScan.cleanFileName('shot.png', 'image/png'), 'shot-clean.png');
  eq('X10 non-ascii name falls back', ExifScan.cleanFileName('\uB0B4 \uC0AC\uC9C4.jpg'), 'image-clean.jpg');
  eq('X11 byte formatting', ExifScan.formatBytes(1536), '1.5 KB');
  eq('X12 megabyte formatting', ExifScan.formatBytes(3 * 1024 * 1024), '3.00 MB');

  return { pass: pass, fails: fails };
}

if (typeof module === 'object' && module.exports) module.exports = { runAll: runAll };
