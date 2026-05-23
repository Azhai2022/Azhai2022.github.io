(function () {
  'use strict';

  var lastShownAt = 0;
  var cooldown = 3000;

  function showNotice() {
    var now = Date.now();
    if (now - lastShownAt < cooldown) return;
    lastShownAt = now;

    var old = document.getElementById('ss-notice-toast');
    if (old) old.remove();

    var toast = document.createElement('div');
    toast.id = 'ss-notice-toast';
    toast.textContent = '截图时请勿带网址，感谢理解';
    toast.style.cssText = [
      'position:fixed',
      'left:50%',
      'bottom:24px',
      'transform:translateX(-50%)',
      'background:rgba(0,0,0,.75)',
      'color:#fff',
      'font-size:13px',
      'line-height:1.4',
      'padding:8px 12px',
      'border-radius:8px',
      'z-index:99999',
      'pointer-events:none',
      'opacity:0',
      'transition:opacity .2s ease'
    ].join(';');

    document.body.appendChild(toast);
    requestAnimationFrame(function () {
      toast.style.opacity = '1';
    });

    setTimeout(function () {
      toast.style.opacity = '0';
      setTimeout(function () { toast.remove(); }, 220);
    }, 1700);
  }

  // Desktop PrtSc key
  document.addEventListener('keyup', function (e) {
    if (e && (e.key === 'PrintScreen' || e.code === 'PrintScreen')) {
      showNotice();
    }
  }, true);

  // Mobile/desktop: likely screenshot flow when app goes background
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') {
      showNotice();
    }
  }, true);

  // Optional hint for long-press image save/screenshot behavior on mobile
  document.addEventListener('contextmenu', function (e) {
    var t = e.target;
    if (t && t.tagName && t.tagName.toLowerCase() === 'img') {
      showNotice();
    }
  }, true);
})();
