/* Rogue Bastion - boot. */
(function () {
  'use strict';
  function boot() {
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(function () { window.RBUI.init(); });
      // don't block on fonts: init anyway after a short delay
      setTimeout(function () {
        if (!window.__rbInit) { window.__rbInit = true; window.RBUI.init(); }
      }, 600);
      var origInit = window.RBUI.init;
      window.RBUI.init = function () {
        if (window.__rbInit) return;
        window.__rbInit = true;
        origInit();
      };
    } else {
      window.RBUI.init();
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
