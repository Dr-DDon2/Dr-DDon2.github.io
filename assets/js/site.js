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

  /* Tools dropdown: close it on an outside click, Escape, or following a link. */
  document.querySelectorAll('.nav-tools').forEach(function (menu) {
    document.addEventListener('click', function (e) {
      if (menu.open && !menu.contains(e.target)) menu.open = false;
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && menu.open) { menu.open = false; menu.querySelector('summary').focus(); }
    });
    menu.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { menu.open = false; });
    });
  });
})();
