(() => {
  const config = window.__WALINE_REACTION_SYNC__;

  if (!config || !config.serverURL || !config.path || !Array.isArray(config.reactionKeys)) return;

  let syncing = false;

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

    root.addEventListener('click', (event) => {
      const reactionItem = event.target.closest('.wl-reaction-item, .wl-reaction li, .wl-reaction-list li');
      if (!reactionItem) return;
      syncWithRetry([300, 1000, 2000]);
    });

    return true;
  }

  function init() {
    let bound = false;
    const start = Date.now();

    const timer = setInterval(() => {
      const votes = getReactionVotes();
      if (votes.length) {
        syncWithRetry([0, 600, 1500]);
      }

      if (!bound) bound = bindReactionSync();
      if ((bound && votes.length) || Date.now() - start > 8000) clearInterval(timer);
    }, 300);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
