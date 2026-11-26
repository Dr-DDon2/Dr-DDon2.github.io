/* Twitch / YouTube / Kick payout calculator — pure calculation engine.
   Works in the browser (window.StreamerCalc) and in Node / quickjs (module.exports). */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.StreamerCalc = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* Tier prices are what a viewer pays before tax. */
  var TIERS = [
    { key: 'tier1', label: 'Tier 1', price: 4.99 },
    { key: 'tier2', label: 'Tier 2', price: 9.99 },
    { key: 'tier3', label: 'Tier 3', price: 24.99 }
  ];

  var PLATFORMS = {
    twitch: { key: 'twitch', label: 'Twitch', share: 0.50, partnerShare: 0.70, bitValue: 0.01, storeFee: 0.30 },
    youtube: { key: 'youtube', label: 'YouTube', share: 0.70, partnerShare: 0.70, bitValue: 0, storeFee: 0.30 },
    kick: { key: 'kick', label: 'Kick', share: 0.95, partnerShare: 0.95, bitValue: 0, storeFee: 0.30 }
  };

  function num(v) {
    if (typeof v === 'number') return isFinite(v) ? v : NaN;
    if (v === null || v === undefined) return NaN;
    var s = String(v).replace(/[,$]/g, '').trim();
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
   *   platform ('twitch'|'youtube'|'kick'),
   *   bits, tier1, tier2, tier3,        // Twitch / Kick counts
   *   superChatGross, memberships, memberPrice,   // YouTube
   *   partnerPlus (bool), inApp (bool), storeFeePct, taxRatePct
   * }
   */
  function compute(input) {
    var i = input || {};
    var key = String(i.platform || 'twitch').toLowerCase();
    var platform = PLATFORMS[key];
    if (!platform) { key = 'twitch'; platform = PLATFORMS.twitch; }

    var share = (i.partnerPlus && (key === 'twitch')) ? platform.partnerShare : platform.share;
    var storeFee = num(i.storeFeePct);
    if (!isFinite(storeFee) || storeFee < 0) storeFee = platform.storeFee * 100;
    if (storeFee > 100) storeFee = 100;
    var storeMul = i.inApp ? (1 - storeFee / 100) : 1;

    var taxPct = nonNeg(i.taxRatePct, 0);
    if (taxPct > 100) taxPct = 100;

    var lines = [];
    var grossTotal = 0;
    var storeTotal = 0;
    var creatorTotal = 0;

    function addLine(label, gross, creatorShare) {
      if (!(gross > 0)) return;
      var afterStore = gross * storeMul;
      var creator = afterStore * creatorShare;
      lines.push({
        label: label,
        gross: gross,
        storeFee: gross - afterStore,
        creator: creator,
        platformFee: afterStore - creator
      });
      grossTotal += gross;
      storeTotal += gross - afterStore;
      creatorTotal += creator;
    }

    if (key === 'twitch') {
      var bits = nonNeg(i.bits);
      if (bits > 0) addLine('Bits', bits * platform.bitValue, 1);
      var t1 = nonNeg(i.tier1), t2 = nonNeg(i.tier2), t3 = nonNeg(i.tier3);
      if (t1 > 0) addLine('Tier 1 subs', t1 * TIERS[0].price, share);
      if (t2 > 0) addLine('Tier 2 subs', t2 * TIERS[1].price, share);
      if (t3 > 0) addLine('Tier 3 subs', t3 * TIERS[2].price, share);
    } else if (key === 'youtube') {
      var sc = nonNeg(i.superChatGross);
      if (sc > 0) addLine('Super Chat & Super Thanks', sc, platform.share);
      var mem = nonNeg(i.memberships);
      var memPrice = num(i.memberPrice);
      if (!isFinite(memPrice) || memPrice <= 0) memPrice = 4.99;
      if (mem > 0) addLine('Channel memberships', mem * memPrice, platform.share);
    } else {
      var k1 = nonNeg(i.tier1), k2 = nonNeg(i.tier2), k3 = nonNeg(i.tier3);
      if (k1 > 0) addLine('Tier 1 subs', k1 * TIERS[0].price, share);
      if (k2 > 0) addLine('Tier 2 subs', k2 * TIERS[1].price, share);
      if (k3 > 0) addLine('Tier 3 subs', k3 * TIERS[2].price, share);
    }

    if (grossTotal <= 0) {
      return { error: 'Add at least one Bit, subscription, Super Chat or membership.' };
    }

    var tax = creatorTotal * taxPct / 100;
    var net = creatorTotal - tax;

    return {
      platform: key,
      platformLabel: platform.label,
      share: share,
      storeFeePct: i.inApp ? storeFee : 0,
      inApp: !!i.inApp,
      partnerPlus: key === 'twitch' && !!i.partnerPlus,
      lines: lines,
      grossTotal: grossTotal,
      storeTotal: storeTotal,
      creatorTotal: creatorTotal,
      platformTotal: grossTotal - storeTotal - creatorTotal,
      taxPct: taxPct,
      tax: tax,
      net: net,
      takeOfGross: grossTotal > 0 ? net / grossTotal : 0,
      takeOfCreator: creatorTotal > 0 ? net / creatorTotal : 0,
      effectiveShare: grossTotal > 0 ? creatorTotal / grossTotal : 0,
      round: round
    };
  }

  /**
   * compare(input) — the same activity run through all three platforms, so a
   * creator can see what the choice of platform is worth.
   */
  function compare(input) {
    var i = input || {};
    var subs = { tier1: nonNeg(i.tier1), tier2: nonNeg(i.tier2), tier3: nonNeg(i.tier3) };
    var rows = ['twitch', 'youtube', 'kick'].map(function (key) {
      var args = {
        platform: key,
        tier1: subs.tier1, tier2: subs.tier2, tier3: subs.tier3,
        partnerPlus: i.partnerPlus, inApp: i.inApp, storeFeePct: i.storeFeePct,
        taxRatePct: i.taxRatePct
      };
      if (key === 'youtube') {
        args.superChatGross = nonNeg(i.superChatGross);
        args.memberships = nonNeg(i.memberships);
        args.memberPrice = i.memberPrice;
      } else if (key === 'twitch') {
        args.bits = nonNeg(i.bits);
      }
      var r = compute(args);
      return { key: key, label: PLATFORMS[key].label, net: r.error ? 0 : r.net, ok: !r.error };
    });
    var best = rows.reduce(function (a, b) { return b.net > a.net ? b : a; }, rows[0]);
    return { rows: rows, best: best.key };
  }

  return {
    compute: compute,
    compare: compare,
    num: num,
    round: round,
    TIERS: TIERS,
    PLATFORMS: PLATFORMS
  };
});
