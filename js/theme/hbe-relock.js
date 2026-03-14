(() => {
  function ensureRelockButton() {
    const encryptRoot = document.getElementById('hexo-blog-encrypt');
    if (!encryptRoot) return;
    if (encryptRoot.querySelector('#hbePass')) return;
    const existing = encryptRoot.querySelector('.hbe-button');
    if (existing) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'hbe-button';
    btn.textContent = 'Encrypt again';
    btn.addEventListener('click', () => {
      const storageName = 'hexo-blog-encrypt:#' + window.location.pathname;
      window.localStorage.removeItem(storageName);
      window.location.reload();
    });
    encryptRoot.appendChild(btn);
  }

  function init() {
    const encryptRoot = document.getElementById('hexo-blog-encrypt');
    if (!encryptRoot) return;

    ensureRelockButton();
    window.addEventListener('hexo-blog-decrypt', ensureRelockButton);

    const observer = new MutationObserver(ensureRelockButton);
    observer.observe(encryptRoot, { childList: true, subtree: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
