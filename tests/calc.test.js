#!/usr/bin/env node
'use strict';
const path = require('path');
const ROOT = path.join(__dirname, '..');
const Concrete = require(path.join(ROOT, 'assets/js/calc-concrete.js'));
const Seller = require(path.join(ROOT, 'assets/js/calc-seller.js'));
const Sens = require(path.join(ROOT, 'assets/js/calc-sens.js'));
const { runAll } = require('./cases.js');

const r = runAll(Concrete, Seller, Sens);
console.log(`PASS ${r.pass}  FAIL ${r.fails.length}`);
if (r.fails.length) {
  r.fails.forEach(f => console.log('  x ' + f));
  process.exit(1);
}
console.log('All calculation checks passed.');
