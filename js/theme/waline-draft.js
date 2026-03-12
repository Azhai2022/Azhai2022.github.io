(() => {
  function clearDraft() {
    const root = document.getElementById('waline');
    if (!root) return;
    const textarea = root.querySelector('textarea');
    if (textarea) {
      textarea.value = '';
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    try {
      const keys = Object.keys(localStorage);
      keys.forEach((key) => {
        if (!/waline/i.test(key)) return;
        if (/comment|draft|content/i.test(key)) {
          localStorage.removeItem(key);
        }
      });
      ['WALINE_COMMENT', 'waline-comment', 'waline-comment-draft', 'waline-comment-content'].forEach((key) => {
        localStorage.removeItem(key);
      });
    } catch (_) {
      // ignore storage access errors
    }
  }

  function bindSubmitClear() {
    const root = document.getElementById('waline');
    if (!root) return false;
    root.addEventListener('click', (e) => {
      const btn = e.target.closest('button[type="submit"], button.wl-submit');
      if (!btn) return;
      setTimeout(clearDraft, 500);
    });
    return true;
  }

  function init() {
    let bound = false;
    const start = Date.now();

    const timer = setInterval(() => {
      if (!document.getElementById('waline')) return;
      clearDraft();
      if (!bound) bound = bindSubmitClear();
      if (bound || Date.now() - start > 5000) clearInterval(timer);
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
