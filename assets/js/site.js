/* Shared site behaviour: theme toggle, year, small helpers. */
(function () {
  'use strict';

  var root = document.documentElement;

  function current() {
    return root.getAttribute('data-theme') || 'light';
  }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    try { localStorage.setItem('tb-theme', theme); } catch (e) { /* private mode */ }
    var btn = document.querySelector('.theme-toggle');
    if (btn) btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }

  document.querySelectorAll('.theme-toggle').forEach(function (btn) {
    btn.addEventListener('click', function () {
      apply(current() === 'dark' ? 'light' : 'dark');
    });
  });

  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
