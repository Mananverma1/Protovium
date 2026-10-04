/**
 * PROTOVIUM — Page Transition
 *
 * The overlay element is injected at the TOP of <html> via a <script> tag
 * in <head> (inline, not this file) so it paints opaque before first frame.
 * This file handles the fade-in on load and fade-out on navigate.
 *
 * Load  : overlay opaque → hologram reforms → overlay fades out
 * Leave : hologram scatters + overlay fades in → navigate
 */
(function () {
  'use strict';

  // ── Get or create overlay ──────────────────────────────────────────────────
  // It should already exist (injected by the inline head script), but we
  // create it here as fallback so this file is self-contained.
  let ov = document.getElementById('proto-overlay');
  if (!ov) {
    ov = document.createElement('div');
    ov.id = 'proto-overlay';
    ov.style.cssText =
      'position:fixed;inset:0;background:#fcfbf9;z-index:99999;pointer-events:none;opacity:1;';
    document.documentElement.insertBefore(ov, document.documentElement.firstChild);
  }

  // Ensure it starts fully opaque with no transition active
  ov.style.transition = 'none';
  ov.style.opacity    = '1';

  // ── Helpers ────────────────────────────────────────────────────────────────
  function smoothFadeOut(ms) {
    // Force a style recalc so the browser knows opacity=1 before we set opacity=0
    ov.getBoundingClientRect();
    ov.style.transition = 'opacity ' + ms + 'ms cubic-bezier(0.25,0,0.1,1)';
    ov.style.opacity    = '0';
    setTimeout(() => { ov.style.pointerEvents = 'none'; }, ms);
  }

  function smoothFadeIn(ms, cb) {
    ov.style.pointerEvents = 'all';
    ov.getBoundingClientRect(); // force reflow
    ov.style.transition = 'opacity ' + ms + 'ms cubic-bezier(0.4,0,1,1)';
    ov.style.opacity    = '1';
    setTimeout(cb, ms);
  }

  // ── Enter: runs on every page load ────────────────────────────────────────
  function onEnter() {
    if (document.visibilityState === 'hidden') {
      document.addEventListener('visibilitychange', onVisibilityChange);
      return;
    }

    animateEnter();
  }

  function onVisibilityChange() {
    if (document.visibilityState !== 'hidden') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      animateEnter();
    }
  }

  function animateEnter() {
    // hologram.js is a sync IIFE loaded before this script, so window.hologram
    // is already set by the time DOMContentLoaded fires.
    if (window.hologram && window.hologram.reform) {
      window.hologram.reform();
    }
    requestAnimationFrame(() => {
      requestAnimationFrame(() => smoothFadeOut(840));
    });
  }

  window.addEventListener('pageshow', event => {
    if (!event.persisted) return;

    ov.style.transition = 'none';
    ov.style.opacity = '1';
    ov.style.pointerEvents = 'none';
    ov.getBoundingClientRect();
    onEnter();
  });

  window.addEventListener('pagehide', () => {
    if (window.hologram && window.hologram.scatter) {
      window.hologram.scatter();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onEnter);
  } else {
    // Parsed already (script at end of body) — run immediately
    onEnter();
  }

  // ── Leave: intercept internal nav ─────────────────────────────────────────
  let leaving = false;

  function isInternal(href) {
    if (!href || href === '#' || href.startsWith('#')) return false;
    if (/^(https?:\/\/|mailto:|tel:)/.test(href))     return false;
    return true;
  }

  document.addEventListener('click', function (e) {
    const a = e.target.closest('a[href]');
    if (!a) return;
    const href = a.getAttribute('href');
    if (!isInternal(href)) return;
    // Same page — skip
    const dest    = new URL(href, window.location.href).pathname;
    const current = window.location.pathname.replace(/\/$/, '') || '/index.html';
    if (dest === current) return;

    e.preventDefault();
    if (leaving) return;
    leaving = true;

    // Fire scatter animation on current page
    if (window.hologram && window.hologram.scatter) {
      window.hologram.scatter();
    }

    // Let the hologram finish scattering before navigating away.
    smoothFadeIn(520, () => {
      window.location.href = href;
    });
  }, true); // capture so it runs before any other listener

})();
