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

  function refreshPosts() {
    window.clearTimeout(expiryTimer);
    const versions = readVersions();
    const now = Date.now();
    let nextCheck = Infinity;

    const posts = Array.from(document.querySelectorAll('.index-post-item')).map((post) => {
      const badge = post.querySelector('.post-updated');
      const version = updateVersion(post);
      const unread = version !== null && versions[postPath(post)] !== version;
      const age = now - version;
      const activeUpdate = Boolean(badge) && unread && age >= 0 && age < UPDATE_WINDOW;
      if (badge) badge.hidden = !activeUpdate;

      if (badge && unread && age < UPDATE_WINDOW) {
        nextCheck = Math.min(nextCheck, age < 0 ? -age : UPDATE_WINDOW - age);
      }

      const published = Number(post.dataset.publishVersion) || 0;
      return {
        post,
        sticky: Number(post.dataset.stickyPriority) || 0,
        published,
        activity: activeUpdate ? Math.max(published, version) : published,
      };
    });

    // Read and expired updates return to publication order without a rebuild.
    posts.sort((a, b) => b.sticky - a.sticky || b.activity - a.activity || b.published - a.published);
    const list = document.querySelector('.index-posts');
    if (list) posts.forEach(({ post }, index) => {
      if (list.children[index] !== post) list.insertBefore(post, list.children[index] || null);
    });

    // Recheck both the badge and its position while the homepage stays open.
    if (Number.isFinite(nextCheck)) {
      expiryTimer = window.setTimeout(refreshPosts, Math.min(nextCheck, 2147483647));
    }
  }

  function init() {
    markArticleRead();
    refreshPosts();
    window.addEventListener('pageshow', refreshPosts);
    window.addEventListener('storage', (event) => {
      if (event.key === STORAGE_KEY || event.key === null) refreshPosts();
    });
    window.addEventListener('hexo-blog-decrypt', markArticleRead);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') refreshPosts();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
