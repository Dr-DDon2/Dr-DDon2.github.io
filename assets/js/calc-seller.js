/* Etsy / TikTok Shop / custom marketplace profit and fee engine.
   Pure functions; usable in the browser (window.SellerCalc) and in Node. */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SellerCalc = api;
})(typeof window !== 'undefined' ? window : null, function () {
  'use strict';

  /* Default fee assumptions (editable in the UI). Always confirm the current
     rates in your own seller dashboard before you price a product. */
  var PLATFORM_DEFAULTS = {
    etsy: {
      label: 'Etsy',
      platformPct: 6.5,      // transaction fee
      paymentPct: 3.0,       // Etsy Payments, US
      paymentFixed: 0.25,
      listingFee: 0.20,
      offsitePct: 0,         // offsite ads: 15% when the sale came from an offsite ad
      affiliatePct: 0
    },
    tiktok: {
      label: 'TikTok Shop',
      platformPct: 6.0,      // referral fee
      paymentPct: 2.9,
      paymentFixed: 0.30,
      listingFee: 0,
      offsitePct: 0,
      affiliatePct: 0
    },
    custom: {
      label: 'Custom',
      platformPct: 0,
      paymentPct: 0,
      paymentFixed: 0,
      listingFee: 0,
      offsitePct: 0,
      affiliatePct: 0
    }
  };

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

  /**
   * compute(input)
   * Required: price, shippingCharged, shippingCost, cogs
   * Fee config: platform, platformPct, paymentPct, paymentFixed, listingFee,
   *             offsitePct (0 = offsite ads off), affiliatePct
   * Ads: adMode 'none' | 'fixed' | 'percent' | 'roas', adValue
   */
  function compute(input) {
    var i = input || {};
    var p = PLATFORM_DEFAULTS[i.platform] ? i.platform : 'custom';
    var d = PLATFORM_DEFAULTS[p];

    function pick(key) {
      return i[key] === undefined || i[key] === null || i[key] === '' ? d[key] : num(i[key]);
    }

    var price = clampMin0(num(i.price));
    var shippingCharged = clampMin0(num(i.shippingCharged));
    var shippingCost = clampMin0(num(i.shippingCost));
    var cogs = clampMin0(num(i.cogs));

    var platformPct = clampMin0(pick('platformPct'));
    var paymentPct = clampMin0(pick('paymentPct'));
    var paymentFixed = clampMin0(pick('paymentFixed'));
    var listingFee = clampMin0(pick('listingFee'));
    var offsitePct = clampMin0(pick('offsitePct'));
    var affiliatePct = clampMin0(pick('affiliatePct'));

    var revenue = price + shippingCharged;
    var platformFee = revenue * platformPct / 100;
    var paymentFee = revenue * paymentPct / 100 + paymentFixed;
    var offsiteFee = revenue * offsitePct / 100;
    var affiliateFee = price * affiliatePct / 100;
    var listing = listingFee;

    var adMode = i.adMode || 'none';
    var adValue = clampMin0(num(i.adValue));
    var adSpend = 0;
    if (adMode === 'fixed') adSpend = adValue;
    else if (adMode === 'percent') adSpend = revenue * adValue / 100;
    else if (adMode === 'roas') adSpend = adValue > 0 ? revenue / adValue : revenue;

    var totalFees = platformFee + paymentFee + offsiteFee + affiliateFee + listing;
    var totalCosts = totalFees + adSpend + cogs + shippingCost;
    var netProfit = revenue - totalCosts;
    var marginPct = revenue > 0 ? netProfit / revenue * 100 : 0;
    var roiPct = (cogs + shippingCost) > 0 ? netProfit / (cogs + shippingCost) * 100 : 0;
    var takeHomePct = revenue > 0 ? (revenue - totalFees - adSpend) / revenue * 100 : 0;

    /* Break-even item price: keep shipping charged, costs and fees as entered,
       solve for the item price where net profit is exactly zero. */
    var adPctEff = 0;
    if (adMode === 'percent') adPctEff = adValue / 100;
    else if (adMode === 'roas') adPctEff = adValue > 0 ? 1 / adValue : 0;
    var k = 1 - (platformPct + paymentPct + offsitePct) / 100 - adPctEff;
    var fixedAds = adMode === 'fixed' ? adSpend : 0;
    var constant = shippingCharged * k - paymentFixed - fixedAds - cogs - shippingCost - listing;
    var breakEvenImpossible = k <= 0.000001;
    var breakEvenPrice = breakEvenImpossible ? Infinity : -constant / k;
    var breakEvenNote = '';
    if (breakEvenImpossible) breakEvenNote = 'Fees add up to 100% or more of revenue, so no item price can break even.';
    else if (breakEvenPrice <= 0) breakEvenNote = 'Already profitable at any item price, because the shipping you charge covers your costs.';

    /* Donut segments, as a share of revenue. */
    var segments = [
      { key: 'platform', label: 'Platform & listing fees', value: platformFee + offsiteFee + listing, color: '#6366f1' },
      { key: 'payment', label: 'Payment processing', value: paymentFee, color: '#0ea5e9' },
      { key: 'ads', label: 'Advertising', value: adSpend, color: '#f59e0b' },
      { key: 'product', label: 'Product & shipping cost', value: cogs + shippingCost, color: '#94a3b8' }
    ];
    if (netProfit >= 0) {
      segments.push({ key: 'profit', label: 'Net profit', value: netProfit, color: '#10b981' });
    } else {
      segments.push({ key: 'loss', label: 'Net loss', value: -netProfit, color: '#ef4444' });
    }
    var segTotal = segments.reduce(function (s, x) { return s + Math.max(0, x.value); }, 0) || 1;
    segments.forEach(function (s) {
      s.value = Math.max(0, s.value);
      s.pct = s.value / segTotal * 100;
    });

    return {
      platform: p,
      revenue: revenue,
      price: price,
      shippingCharged: shippingCharged,
      shippingCost: shippingCost,
      cogs: cogs,
      platformFee: platformFee,
      paymentFee: paymentFee,
      offsiteFee: offsiteFee,
      affiliateFee: affiliateFee,
      listingFee: listing,
      adSpend: adSpend,
      totalFees: totalFees,
      totalCosts: totalCosts,
      netProfit: netProfit,
      marginPct: marginPct,
      roiPct: roiPct,
      takeHomePct: takeHomePct,
      feePctOfRevenue: revenue > 0 ? totalFees / revenue * 100 : 0,
      breakEvenPrice: breakEvenPrice,
      breakEvenImpossible: breakEvenImpossible,
      breakEvenNote: breakEvenNote,
      segments: segments,
      round: round
    };
  }

  /* Per-unit profit, handy when a listing sells in multiples. */
  function perUnit(order) {
    var qty = Math.max(1, Math.round(num(order && order.quantity, 1)));
    var r = compute(order);
    return {
      quantity: qty,
      netProfit: r.netProfit * qty,
      revenue: r.revenue * qty,
      totalFees: r.totalFees * qty,
      adSpend: r.adSpend * qty,
      marginPct: r.marginPct
    };
  }

  return {
    compute: compute,
    perUnit: perUnit,
    PLATFORM_DEFAULTS: PLATFORM_DEFAULTS,
    round: round
  };
});
