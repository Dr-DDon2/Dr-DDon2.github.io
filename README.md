# Toolbench

Free browser calculators for construction, online selling and FPS gaming, published as a static
site on GitHub Pages: **https://dr-ddon2.github.io/**

## Pages

| Path | What it does |
| --- | --- |
| `/` | Hub with the three calculators |
| `/concrete/` | Concrete slab volume in yd³ / ft³ / m³, bag counts for 40/60/80 lb mix, cost estimate |
| `/seller-fee/` | Etsy and TikTok Shop fees, net profit, margin and break-even price, with a cost donut |
| `/edpi/` | eDPI, cm/360 and in/360, cross-game sensitivity for seven FPS titles |
| `/about/`, `/contact/`, `/privacy-policy/` | Site information, contact and privacy policy |
| `/sitemap.xml`, `/robots.txt` | Search engine files |

## Structure

```
index.html                 hub
concrete/index.html        tool 1
seller-fee/index.html      tool 2
edpi/index.html            tool 3
about/ contact/ privacy-policy/
assets/css/style.css       one stylesheet, light + dark, mobile first
assets/js/calc-concrete.js calculation engine (pure functions)
assets/js/calc-seller.js   calculation engine
assets/js/calc-sens.js     calculation engine
assets/js/site.js          theme toggle, footer year
tests/                     calculation test suite
```

No build step, no frameworks, no external requests. Each page is plain HTML and loads only the
one calculation script it needs.

## Tests

The engines are plain UMD modules, so the same code runs in the page and in the test runner.
94 assertions cover unit conversion, rounding, edge cases and worked examples.

```bash
node tests/calc.test.js        # if Node.js is available
python3 tests/run_quickjs.py   # otherwise (needs: pip3 install quickjs)
```

## Editing a fee rate or a game yaw

Defaults live in `assets/js/calc-seller.js` (`PLATFORM_DEFAULTS`) and
`assets/js/calc-sens.js` (`GAMES`). Both are also editable in the UI, so the published pages stay
correct even if a platform changes its schedule. Update the constants and the prose on the tool
page together.
