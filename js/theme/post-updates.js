(() => {
  const STORAGE_KEY = 'zhai_read_updates_v1';
  const UPDATE_WINDOW = 72 * 60 * 60 * 1000;
  let expiryTimer;

  function readVersions() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {};
    } catch (_) {
      return {};
    }
  }

  function postPath(element) {
    const path = new URL(element.dataset.postPath, window.location.href).pathname;
    return path.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/';
  }

  function updateVersion(element) {
    const value = element.dataset.updateVersion;
    const version = Number(value);
    return value && Number.isFinite(version) ? version : null;
  }

  function markArticleRead() {
    const article = document.querySelector('article.post[data-update-version]');
    if (!article || document.querySelector('#hexo-blog-encrypt #hbePass')) return;

    const version = updateVersion(article);
    if (version === null || version > Date.now()) return;
    const versions = readVersions();
    const path = postPath(article);
    if (versions[path] === version) return;

    versions[path] = version;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(versions));
    } catch (_) {
      // Reading remains available when the browser blocks persistent storage.
    }
  }

  function refreshBadges() {
    window.clearTimeout(expiryTimer);
    const versions = readVersions();
    const now = Date.now();
    let nextCheck = Infinity;

    document.querySelectorAll('.index-post-item[data-update-version]').forEach((post) => {
      const badge = post.querySelector('.post-updated');
      if (!badge) return;
      const version = updateVersion(post);
      const unread = version !== null && versions[postPath(post)] !== version;
      const age = now - version;
      badge.hidden = !unread || age < 0 || age >= UPDATE_WINDOW;

      if (unread && age < UPDATE_WINDOW) {
        nextCheck = Math.min(nextCheck, age < 0 ? -age : UPDATE_WINDOW - age);
      }
    });

    // Expire badges even if the homepage stays open without another deployment.
    if (Number.isFinite(nextCheck)) {
      expiryTimer = window.setTimeout(refreshBadges, Math.min(nextCheck, 2147483647));
    }
  }

  function init() {
    markArticleRead();
    refreshBadges();
    window.addEventListener('pageshow', refreshBadges);
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY || event.key === null) refreshBadges();
    });
    window.addEventListener('hexo-blog-decrypt', markArticleRead);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshBadges();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
