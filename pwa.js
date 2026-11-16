/* Field Tools — PWA glue: service worker registration and the "install" banner. */
(function () {
  'use strict';
  const KEY = 'fieldtools.installDismissed';
  const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  // ---- offline support
  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
    // A new version took over: reload once so the screen matches the new files (settings are kept).
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController && !reloaded) { reloaded = true; window.location.reload(); }
    });
  }

  // ---- install banner
  const bar = document.getElementById('installBar');
  const msg = document.getElementById('installMsg');
  const btn = document.getElementById('installBtn');
  const close = document.getElementById('installClose');
  let dismissed = false;
  try { dismissed = localStorage.getItem(KEY) === '1'; } catch { /* ignore */ }
  if (!bar || standalone) return;

  function show(text, withButton) {
    if (dismissed) return;
    msg.innerHTML = text;
    btn.hidden = !withButton;
    bar.hidden = false;
  }
  close.addEventListener('click', () => {
    bar.hidden = true;
    try { localStorage.setItem(KEY, '1'); } catch { /* ignore */ }
  });

  // Android / Chrome / Edge: the browser hands us an install prompt we can trigger from a button.
  let deferred = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    show('Install Field Tools on this device for quick, offline access.', true);
  });
  btn.addEventListener('click', async () => {
    if (!deferred) return;
    deferred.prompt();
    await deferred.userChoice.catch(() => null);
    deferred = null;
    bar.hidden = true;
  });
  window.addEventListener('appinstalled', () => { bar.hidden = true; });

  // iOS has no install prompt: explain the Share → Add to Home Screen steps instead.
  if (isIOS) {
    const share = '<svg class="ios-share" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" aria-label="Share"><path d="M8 1.5v9M5 4.5l3-3 3 3M4 7H3v7.5h10V7h-1"/></svg>';
    const safari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    show(safari
      ? 'To install: tap ' + share + ' <b>Share</b>, then <b>Add to Home Screen</b>.'
      : 'To install: open this page in <b>Safari</b>, tap ' + share + ' <b>Share</b>, then <b>Add to Home Screen</b>.', false);
  }
})();
