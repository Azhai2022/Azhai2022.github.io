(() => {
  const FAVORITE_KEY = 'zhai_favorites';
  const LAST_READ_KEY = 'zhai_last_read';

  function getFavorites() {
    try {
      return JSON.parse(localStorage.getItem(FAVORITE_KEY)) || [];
    } catch (e) {
      return [];
    }
  }

  function saveFavorites(items) {
    localStorage.setItem(FAVORITE_KEY, JSON.stringify(items));
  }

  function getLastRead() {
    try {
      return JSON.parse(localStorage.getItem(LAST_READ_KEY)) || null;
    } catch (e) {
      return null;
    }
  }

  function saveLastRead(data) {
    localStorage.setItem(LAST_READ_KEY, JSON.stringify(data));
  }

  function getId(url) {
    return url.replace(/\/$/, '').replace(/index\.html$/, '');
  }

  function toggleFavorite() {
    const id = getId(window.location.href);
    const favorites = getFavorites();
    const title = document.querySelector('.post-title h1')?.textContent?.trim() || '未知文章';

    const existing = favorites.findIndex(f => f.id === id);
    if (existing >= 0) {
      favorites.splice(existing, 1);
    } else {
      favorites.unshift({
        id,
        title,
        url: window.location.pathname,
        time: Date.now()
      });
    }

    saveFavorites(favorites);
    updateButton();
    updatePanel();
  }

  function removeFavorite(id) {
    let favorites = getFavorites();
    favorites = favorites.filter(f => f.id !== id);
    saveFavorites(favorites);
    updatePanel();
  }

  function updateButton() {
    const btn = document.querySelector('.favorite-btn');
    if (!btn) return;

    const id = getId(window.location.href);
    const favorites = getFavorites();
    const isFav = favorites.some(f => f.id === id);

    btn.classList.toggle('active', isFav);
    btn.querySelector('i').className = isFav ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
    btn.title = isFav ? '取消收藏' : '收藏文章';
  }

  function updatePanel() {
    const list = document.querySelector('.favorite-list');
    if (!list) return;

    const favorites = getFavorites();
    list.innerHTML = favorites.length === 0
      ? '<div class="empty-msg">暂无收藏</div>'
      : favorites.map(f => `
        <a class="list-item" href="${f.url}">
          <span class="item-title">${f.title}</span>
          <button class="item-remove" data-id="${f.id}">×</button>
        </a>
      `).join('');
  }

  function updateLastReadPanel() {
    const list = document.getElementById('last-read-list');
    if (!list) return;

    const lastRead = getLastRead();
    if (!lastRead) {
      list.innerHTML = '<div class="empty-msg">暂无记录</div>';
      return;
    }

    list.innerHTML = `
      <a class="list-item" href="${lastRead.url}">
        <span class="item-title">${lastRead.title}</span>
      </a>
    `;
  }

  function trackLastRead() {
    const title = document.querySelector('.post-title h1')?.textContent?.trim();
    if (!title) return;

    saveLastRead({
      title: title,
      url: window.location.pathname,
      time: Date.now()
    });
  }

  function init() {
    const favBtn = document.querySelector('.favorite-btn');
    if (favBtn) {
      favBtn.addEventListener('click', toggleFavorite);
      updateButton();
    }

    updatePanel();
    updateLastReadPanel();

    // 如果是文章页，记录上次阅读
    if (document.querySelector('.post-title')) {
      trackLastRead();
    }

    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('item-remove')) {
        e.preventDefault();
        e.stopPropagation();
        removeFavorite(e.target.dataset.id);
        return;
      }

      const header = e.target.closest('.panel-header');
      if (header) {
        const panel = header.closest('.sidebar-panel');
        if (panel) panel.classList.toggle('open');
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
