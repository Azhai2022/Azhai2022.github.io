(() => {
  const config = window.__WALINE_REACTION_SYNC__;

  if (!config || !config.serverURL || !config.path || !Array.isArray(config.reactionKeys)) return;

  let syncing = false;
  let observer = null;
  let bootTimer = null;

  function getReactionVotes() {
    return Array.from(document.querySelectorAll('#waline .wl-reaction-votes'));
  }

  function getReactionEndpoint() {
    const url = new URL('/api/article', config.serverURL);
    url.searchParams.set('path', config.path);
    url.searchParams.set('type', config.reactionKeys.join(','));
    if (config.lang) url.searchParams.set('lang', config.lang);
    return url.toString();
  }

  async function syncReactionVotes() {
    const votes = getReactionVotes();
    if (!votes.length || syncing) return;

    syncing = true;

    try {
      const response = await fetch(getReactionEndpoint(), { credentials: 'omit' });
      if (!response.ok) return;

      const payload = await response.json();
      const article = Array.isArray(payload?.data) ? payload.data[0] : payload?.data;

      if (!article) return;

      config.reactionKeys.forEach((key, index) => {
        const value = article[key];
        if (typeof value === 'undefined' || !votes[index]) return;
        votes[index].textContent = String(value);
      });
    } catch (_) {
      // ignore network / parse errors
    } finally {
      syncing = false;
    }
  }

  function syncWithRetry(delays) {
    delays.forEach((delay) => {
      setTimeout(syncReactionVotes, delay);
    });
  }

  function bindReactionSync() {
    const root = document.getElementById('waline');
    if (!root) return false;

    if (!observer) {
      observer = new MutationObserver(() => {
        syncWithRetry([0, 300]);
      });
      observer.observe(root, { childList: true, subtree: true });
    }

    root.addEventListener('click', (event) => {
      const reactionItem = event.target.closest('.wl-reaction-item, .wl-reaction li, .wl-reaction-list li');
      if (!reactionItem) return;
      syncWithRetry([200, 800, 1600, 2600]);
    });

    return true;
  }

  function init() {
    bindReactionSync();
    syncWithRetry([0, 400, 1200, 2400]);

    if (bootTimer) clearInterval(bootTimer);
    const start = Date.now();
    bootTimer = setInterval(() => {
      syncReactionVotes();
      if (Date.now() - start > 10000) {
        clearInterval(bootTimer);
        bootTimer = null;
      }
    }, 1000);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.__syncWalineReactionVotes = syncReactionVotes;
})();
