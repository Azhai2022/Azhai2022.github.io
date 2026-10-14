(() => {
  const DEFAULT_WALINE_SERVER = 'https://comments.azhai.space';
  const PAGE_SIZE = 100;
  const INLINE_COMMENT_COUNTS_PATH = '/inline-counts.json';
  const INLINE_COMMENT_PAGE_CACHE_PREFIX = 'inline_comment_counts_cache:';
  const INLINE_COMMENT_PAGE_CACHE_TTL = 24 * 60 * 60 * 1000;
  // The index now stores comment ids so the inline panel can reply to an item.
  const INLINE_COMMENT_INDEX_CACHE_PREFIX = 'inline_comment_index_v2_cache:';
  const INLINE_COMMENT_INDEX_CACHE_TTL = 24 * 60 * 60 * 1000;
  const INLINE_COMMENT_MANIFEST_CACHE_KEY = 'inline_comment_manifest_cache';
  const INLINE_COMMENT_MANIFEST_CACHE_TTL = 60 * 60 * 1000;
  const INLINE_COMMENT_COUNTS_FETCH_CONCURRENCY = 4;
  let activeButton = null;
  let activeReply = null;
  let commentCounts = {};
  let inlineCommentManifest = null;
  let inlineCommentManifestPromise = null;
  let inlineCommentCache = {
    path: '',
    counts: {},
    commentsByIndex: {},
    loadedAt: 0,
    loadingPromise: null
  };

  function getWalineServer() {
    return window.__WALINE_SERVER_URL__ || DEFAULT_WALINE_SERVER;
  }

  function getCommentPath() {
    return window.__WALINE_COMMENT_PATH__ || decodeURI(window.location.pathname);
  }

  function getCountLabel(count) {
    return count ? '评' + count : '评';
  }

  function applyButtonCount(btn, count) {
    const label = getCountLabel(count);
    if (btn.textContent !== label) {
      btn.textContent = label;
    }
    btn.classList.toggle('has-comments', Boolean(count));
    btn.setAttribute('aria-label', count ? `这段有${count}条评论` : '对这段评论');
    btn.title = count ? `${count}条段评` : '对这段评论';
  }

  function getParagraphText(paragraph) {
    return Array.from(paragraph.childNodes)
      .map((node) => {
        if (node.nodeType === Node.ELEMENT_NODE && node.classList.contains('inline-comment-btn')) {
          return '';
        }
        return node.textContent || '';
      })
      .join('')
      .trim();
  }

  let savedScrollY = 0;
  let viewportRaf = null;

  function isSmallScreen() {
    return window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
  }

  function syncPanelViewport() {
    const rootStyle = document.documentElement.style;

    if (!window.visualViewport) {
      rootStyle.setProperty('--inline-comment-keyboard-offset', '0px');
      rootStyle.setProperty('--inline-comment-viewport-height', `${window.innerHeight}px`);
      return;
    }

    const viewport = window.visualViewport;
    const keyboardOffset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
    rootStyle.setProperty('--inline-comment-keyboard-offset', `${Math.round(keyboardOffset)}px`);
    rootStyle.setProperty('--inline-comment-viewport-height', `${Math.round(viewport.height)}px`);
  }

  function schedulePanelViewportSync() {
    if (viewportRaf) cancelAnimationFrame(viewportRaf);
    viewportRaf = requestAnimationFrame(() => {
      viewportRaf = null;
      const panel = document.getElementById('inline-comment-panel');
      if (!panel || !panel.classList.contains('is-open')) return;
      syncPanelViewport();
    });
  }

  function createBackdrop() {
    let backdrop = document.getElementById('inline-comment-backdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'inline-comment-backdrop';
      backdrop.className = 'inline-comment-backdrop';
      document.body.appendChild(backdrop);
    }
    return backdrop;
  }

  function openPanel(panel) {
    savedScrollY = window.scrollY || window.pageYOffset || 0;
    createBackdrop();
    syncPanelViewport();
    panel.classList.add('is-open');
    document.documentElement.classList.add('inline-comment-panel-open');
  }

  function closePanel(panel) {
    const textarea = panel.querySelector('.inline-comment-textarea');
    if (textarea) textarea.blur();
    panel.classList.remove('is-open');
    const backdrop = document.getElementById('inline-comment-backdrop');
    if (backdrop) backdrop.remove();
    document.documentElement.classList.remove('inline-comment-panel-open');
    document.documentElement.style.removeProperty('--inline-comment-keyboard-offset');
    document.documentElement.style.removeProperty('--inline-comment-viewport-height');
    if (isSmallScreen()) {
      requestAnimationFrame(() => {
        window.scrollTo(0, savedScrollY);
      });
    }
    activeButton = null;
    activeReply = null;
    resetReplyState(panel);
  }

  function updateDecoratedButtons() {
    document.querySelectorAll('.inline-comment-btn').forEach((btn) => {
      const index = btn.dataset.index;
      if (!index) return;
      applyButtonCount(btn, commentCounts[index] || 0);
    });
  }

  function getParagraphIndexes() {
    return Array.from(document.querySelectorAll('.post-content p'))
      .flatMap((paragraph, idx) => {
        return getParagraphText(paragraph) ? [String(idx + 1)] : [];
      });
  }

  function buildPanel() {
    let panel = document.getElementById('inline-comment-panel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'inline-comment-panel';
    panel.className = 'inline-comment-panel';
    panel.innerHTML = `
      <div class="inline-comment-title">段评</div>
      <div class="inline-comment-list">
        <div class="inline-comment-loading">加载中...</div>
      </div>
      <textarea class="inline-comment-textarea" placeholder="写下你的评论..."></textarea>
      <div class="inline-comment-actions">
        <button type="button" class="inline-comment-submit">发送</button>
        <button type="button" class="inline-comment-cancel">取消</button>
      </div>
    `;
    document.body.appendChild(panel);

    const textarea = panel.querySelector('.inline-comment-textarea');
    textarea.addEventListener('focus', () => {
      [80, 240, 500].forEach((delay) => {
        setTimeout(schedulePanelViewportSync, delay);
      });
    });
    textarea.addEventListener('blur', () => {
      setTimeout(schedulePanelViewportSync, 120);
    });

    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', schedulePanelViewportSync);
      window.visualViewport.addEventListener('scroll', schedulePanelViewportSync);
    }

    panel.querySelector('.inline-comment-cancel').addEventListener('click', () => {
      closePanel(panel);
    });

    panel.querySelector('.inline-comment-submit').addEventListener('click', async () => {
      const textarea = panel.querySelector('.inline-comment-textarea');
      const content = (textarea.value || '').trim();
      if (!content) return;
      const targetButton = activeButton;
      const targetIndex = targetButton ? targetButton.dataset.index : '';
      const replyTarget = activeReply;

      const paraIndex = textarea.dataset.paraIndex || '';
      const paraQuote = textarea.dataset.paraQuote || '';
      const paraAnchor = textarea.dataset.paraAnchor || '';
      let fullContent = content;
      if (paraIndex && paraQuote) {
        const jump = paraAnchor ? ` <a href="#${paraAnchor}">定位</a>` : '';
        const safeQuote = escapeHtml(paraQuote);
        fullContent = `<blockquote data-inline-comment-index="${paraIndex}">引用：${safeQuote}${jump}</blockquote>\n\n` + content;
      }

      if (typeof window.__WALINE_ENSURE_READY__ === 'function') {
        try {
          await window.__WALINE_ENSURE_READY__();
        } catch (error) {
          console.error('ensureWalineReady error:', error);
          return;
        }
      }

      const submitButton = panel.querySelector('.inline-comment-submit');
      submitButton.disabled = true;

      try {
        if (replyTarget) {
          await submitInlineReply(fullContent, replyTarget);
        } else {
          const walineRoot = document.getElementById('waline');
          const walineEditor = getWalineEditor(walineRoot);
          const walineSubmit = getWalineSubmit(walineRoot);

          if (!walineEditor || !walineSubmit) {
            console.warn('Waline editor or submit button not found for inline comment.');
            return;
          }

          setTextareaValue(walineEditor, fullContent);
          requestAnimationFrame(() => {
            walineSubmit.click();
          });
        }
      } catch (error) {
        console.error('Inline comment submit error:', error);
        window.alert(error.message || '发送失败，请稍后重试。');
        return;
      } finally {
        submitButton.disabled = false;
      }

      if (targetIndex) {
        commentCounts[targetIndex] = (commentCounts[targetIndex] || 0) + 1;
        storeCounts(getCommentPath(), commentCounts);
        updateDecoratedButtons();
        invalidateInlineCommentCache();
      }

      closePanel(panel);
      textarea.value = '';
    });

    document.addEventListener('click', (e) => {
      if (!panel.classList.contains('is-open')) return;
      if (e.target.closest('.inline-comment-panel')) return;
      if (e.target.closest('.inline-comment-btn')) return;
      closePanel(panel);
    });

    return panel;
  }

  function truncateOneLine(text, maxChars = 15) {
    const cleaned = (text || '').replace(/\s+/g, '');
    const chars = Array.from(cleaned);
    if (chars.length <= maxChars) return chars.join('');
    return chars.slice(0, maxChars).join('') + '……';
  }

  function escapeHtml(text) {
    return (text || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function getWalineEditor(root) {
    if (!root) return null;
    return root.querySelector('.wl-editor') || root.querySelector('textarea');
  }

  function getWalineSubmit(root) {
    if (!root) return null;
    return root.querySelector('.wl-info button.wl-btn.primary')
      || root.querySelector('button.wl-btn.primary')
      || root.querySelector('button[type="submit"].wl-btn');
  }

  function getWalineFieldValue(root, name) {
    if (!root) return '';
    const field = root.querySelector(`#wl-${name}`) || root.querySelector(`[name="${name}"]`);
    return field ? String(field.value || '').trim() : '';
  }

  async function submitInlineReply(fullContent, parent) {
    if (!window.Waline || typeof window.Waline.addComment !== 'function') {
      throw new Error('评论服务尚未准备好，请稍后重试。');
    }

    const walineRoot = document.getElementById('waline');
    const mail = getWalineFieldValue(walineRoot, 'mail');
    if (mail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) {
      throw new Error('邮箱格式有误，请检查后再次提交。');
    }

    const parentId = Number(parent.objectId);
    if (!Number.isSafeInteger(parentId) || parentId <= 0) {
      throw new Error('这条段评暂时不能回复，请刷新页面后重试。');
    }

    const rootId = Number(parent.rid || parent.objectId);
    const payload = {
      comment: fullContent,
      nick: getWalineFieldValue(walineRoot, 'nick') || '匿名',
      mail,
      link: getWalineFieldValue(walineRoot, 'link'),
      url: getCommentPath(),
      pid: parentId,
      rid: Number.isSafeInteger(rootId) && rootId > 0 ? rootId : parentId,
      at: parent.nick || '匿名'
    };

    const result = await window.Waline.addComment({
      serverURL: getWalineServer(),
      lang: 'zh-CN',
      comment: payload
    });

    if (!result || result.errmsg || !result.data) {
      throw new Error(result?.errmsg || '发送失败，请稍后重试。');
    }
  }

  function resetReplyState(panel) {
    const title = panel.querySelector('.inline-comment-title');
    const textarea = panel.querySelector('.inline-comment-textarea');
    if (title) title.textContent = '段评';
    if (textarea) textarea.placeholder = '写下你的评论...';
  }

  function setReplyState(panel, comment) {
    activeReply = comment;
    const title = panel.querySelector('.inline-comment-title');
    const textarea = panel.querySelector('.inline-comment-textarea');
    if (title) title.textContent = `回复：${comment.nick || '匿名'}`;
    if (textarea) {
      textarea.placeholder = `回复 ${comment.nick || '匿名'}...`;
      textarea.focus();
    }
  }

  function setTextareaValue(textarea, value) {
    if (!textarea) return;

    const descriptor = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement && window.HTMLTextAreaElement.prototype,
      'value'
    );

    if (descriptor && typeof descriptor.set === 'function') {
      descriptor.set.call(textarea, value);
    } else {
      textarea.value = value;
    }

    try {
      textarea.dispatchEvent(new InputEvent('input', {
        bubbles: true,
        inputType: 'insertText',
        data: value
      }));
    } catch (e) {
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
    }

    textarea.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  function getInlineCommentMarkup(comment) {
    return String((comment && (comment.comment || comment.orig)) || '');
  }

  function createInlineCommentContainer(comment) {
    const tmp = document.createElement('div');
    tmp.innerHTML = getInlineCommentMarkup(comment);
    return tmp;
  }

  function normalizeInlineDigits(text) {
    return String(text || '').replace(/[０-９]/g, (digit) => String(digit.charCodeAt(0) - 65248));
  }

  function extractInlineCommentIndex(comment) {
    const html = getInlineCommentMarkup(comment);
    if (!html) return '';

    const container = createInlineCommentContainer(comment);
    const blockquote = container.querySelector('blockquote');
    const attrIndex = blockquote ? normalizeInlineDigits(blockquote.getAttribute('data-inline-comment-index') || '') : '';
    if (/^\d+$/.test(attrIndex)) return attrIndex;
    const candidates = [
      blockquote ? (blockquote.textContent || blockquote.innerText || '') : '',
      container.textContent || container.innerText || '',
      html
    ];

    for (const candidate of candidates) {
      const match = normalizeInlineDigits(candidate).match(/第\s*(\d+)\s*段/);
      if (match) return match[1];
    }

    return '';
  }

  function ensureInlineCommentCache() {
    const path = getCommentPath();
    if (inlineCommentCache.path !== path) {
      inlineCommentCache = {
        path,
        counts: {},
        commentsByIndex: {},
        loadedAt: 0,
        loadingPromise: null
      };
    }
    return inlineCommentCache;
  }

  function invalidateInlineCommentCache() {
    const cache = ensureInlineCommentCache();
    cache.loadedAt = 0;
    cache.loadingPromise = null;
    try {
      localStorage.removeItem(getIndexCacheKey(cache.path));
    } catch (_) {
      // ignore storage errors
    }
  }

  function getInlineCommentContent(comment) {
    const html = getInlineCommentMarkup(comment);
    if (!html) return '';

    const container = createInlineCommentContainer(comment);
    const blockquote = container.querySelector('blockquote');

    if (blockquote) {
      blockquote.remove();
      return (container.textContent || container.innerText || '')
        .replace(/^[\s\S]*?】\s*/, '')
        .trim();
    }

    const lines = stripHtml(html).split(/\r?\n/);
    while (lines.length && !lines[0].trim()) lines.shift();

    if (lines[0] && /^(?:>\s*)?引用（第\s*[0-9０-９]+\s*段）/.test(lines[0].trim())) {
      lines.shift();

      while (lines.length && /^\s*>/.test(lines[0])) {
        lines.shift();
      }

      while (lines.length && !lines[0].trim()) {
        lines.shift();
      }
    }

    return lines.join('\n')
      .replace(/^[\s\S]*?】\s*/, '')
      .trim();
  }

  function collectInlineCommentIndex(comment, counts, commentsByIndex) {
    const index = extractInlineCommentIndex(comment);

    if (index) {
      counts[index] = (counts[index] || 0) + 1;

      const clean = getInlineCommentContent(comment);
      if (clean) {
        if (!commentsByIndex[index]) commentsByIndex[index] = [];
        commentsByIndex[index].push({
          objectId: comment.objectId,
          pid: comment.pid,
          rid: comment.rid,
          nick: comment.nick || '匿名',
          content: clean,
          time: comment.time || comment.insertedAt
        });
      }
    }

    if (comment.children) {
      comment.children.forEach((child) => {
        collectInlineCommentIndex(child, counts, commentsByIndex);
      });
    }
  }

  function getCountsCacheKey(path) {
    return INLINE_COMMENT_PAGE_CACHE_PREFIX + path;
  }

  function getIndexCacheKey(path) {
    return INLINE_COMMENT_INDEX_CACHE_PREFIX + path;
  }

  function readStoredCounts(path) {
    try {
      const raw = localStorage.getItem(getCountsCacheKey(path));
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;

      if (!parsed.savedAt || Date.now() - parsed.savedAt > INLINE_COMMENT_PAGE_CACHE_TTL) {
        localStorage.removeItem(getCountsCacheKey(path));
        return null;
      }

      return normalizeCountMap(parsed.counts);
    } catch (_) {
      return null;
    }
  }

  function storeCounts(path, counts) {
    try {
      localStorage.setItem(getCountsCacheKey(path), JSON.stringify({
        savedAt: Date.now(),
        counts: normalizeCountMap(counts)
      }));
    } catch (_) {
      // ignore storage errors
    }
  }

  function hasMissingCounts(expected, actual) {
    const expectedCounts = normalizeCountMap(expected);
    const actualCounts = normalizeCountMap(actual);

    return Object.entries(expectedCounts).some(([index, value]) => Number(actualCounts[index] || 0) < Number(value || 0));
  }

  function readStoredInlineIndex(path, expectedCounts = null) {
    try {
      const raw = localStorage.getItem(getIndexCacheKey(path));
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;

      if (!parsed.savedAt || Date.now() - parsed.savedAt > INLINE_COMMENT_INDEX_CACHE_TTL) {
        localStorage.removeItem(getIndexCacheKey(path));
        return null;
      }

      const counts = normalizeCountMap(parsed.counts);
      const commentsByIndex = parsed.commentsByIndex && typeof parsed.commentsByIndex === 'object'
        ? parsed.commentsByIndex
        : {};

      if (expectedCounts && hasMissingCounts(expectedCounts, counts)) {
        localStorage.removeItem(getIndexCacheKey(path));
        return null;
      }

      return {
        counts,
        commentsByIndex,
      };
    } catch (_) {
      return null;
    }
  }

  function storeInlineIndex(path, counts, commentsByIndex) {
    try {
      localStorage.setItem(getIndexCacheKey(path), JSON.stringify({
        savedAt: Date.now(),
        counts: normalizeCountMap(counts),
        commentsByIndex: commentsByIndex && typeof commentsByIndex === 'object' ? commentsByIndex : {}
      }));
    } catch (_) {
      // ignore storage errors
    }
  }

  function readManifestCache(options = {}) {
    const { allowStale = false } = options;

    try {
      const raw = localStorage.getItem(INLINE_COMMENT_MANIFEST_CACHE_KEY);
      if (!raw) return null;

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object' || !parsed.manifest || typeof parsed.manifest !== 'object') {
        return null;
      }

      if (!allowStale) {
        if (!parsed.savedAt || Date.now() - parsed.savedAt > INLINE_COMMENT_MANIFEST_CACHE_TTL) {
          return null;
        }
      }

      return parsed.manifest;
    } catch (_) {
      return null;
    }
  }

  function storeManifestCache(manifest) {
    try {
      localStorage.setItem(INLINE_COMMENT_MANIFEST_CACHE_KEY, JSON.stringify({
        savedAt: Date.now(),
        manifest: manifest && typeof manifest === 'object' ? manifest : {}
      }));
    } catch (_) {
      // ignore storage errors
    }
  }

  function normalizeCountMap(counts) {
    if (!counts || typeof counts !== 'object') return {};

    return Object.entries(counts).reduce((result, [index, value]) => {
      const num = Number(value || 0);
      if (num > 0) {
        result[String(index)] = num;
      }
      return result;
    }, {});
  }

  function mergeCountMaps(...maps) {
    return maps.reduce((result, map) => {
      const normalized = normalizeCountMap(map);
      Object.entries(normalized).forEach(([index, value]) => {
        result[index] = Math.max(Number(result[index] || 0), Number(value || 0));
      });
      return result;
    }, {});
  }

  function projectCountsForIndexes(counts, indexes) {
    return indexes.reduce((result, index) => {
      result[index] = Number(counts[index] || 0);
      return result;
    }, {});
  }

  function sameCountMap(a, b) {
    const left = normalizeCountMap(a);
    const right = normalizeCountMap(b);
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);

    for (const key of keys) {
      if (Number(left[key] || 0) !== Number(right[key] || 0)) return false;
    }

    return true;
  }

  function refreshCountsFromIndexInBackground(path, baseCounts = {}) {
    window.setTimeout(() => {
      loadInlineCommentIndex()
        .then((cache) => {
          if (cache.path !== path) return;

          const mergedCounts = mergeCountMaps(baseCounts, cache.counts);
          if (!sameCountMap(commentCounts, mergedCounts)) {
            commentCounts = mergedCounts;
            updateDecoratedButtons();
          }
          storeCounts(path, mergedCounts);
        })
        .catch((error) => {
          console.error('refreshCountsFromIndexInBackground error:', error);
        });
    }, 0);
  }

  function getInlineCountsUrl() {
    return getWalineServer().replace(/\/$/, '') + INLINE_COMMENT_COUNTS_PATH;
  }

  async function loadInlineCommentManifest(force = false) {
    if (!force) {
      const cachedManifest = readManifestCache();
      if (cachedManifest) {
        inlineCommentManifest = cachedManifest;
        return cachedManifest;
      }

      if (inlineCommentManifest) return inlineCommentManifest;
    }

    if (inlineCommentManifestPromise) return inlineCommentManifestPromise;

    inlineCommentManifestPromise = fetch(getInlineCountsUrl(), { credentials: 'omit' })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to fetch inline counts manifest: ${response.status}`);
        }
        return response.json();
      })
      .then((payload) => {
        inlineCommentManifest = payload && payload.counts ? payload.counts : {};
        storeManifestCache(inlineCommentManifest);
        return inlineCommentManifest;
      })
      .catch((error) => {
        const fallbackManifest = readManifestCache({ allowStale: true });
        if (fallbackManifest) {
          inlineCommentManifest = fallbackManifest;
          return inlineCommentManifest;
        }

        console.error('loadInlineCommentManifest error:', error);
        inlineCommentManifest = {};
        return inlineCommentManifest;
      })
      .finally(() => {
        inlineCommentManifestPromise = null;
      });

    return inlineCommentManifestPromise;
  }

  async function fetchInlineCommentPage(requestPath, page) {
    const url = new URL('/api/comment', getWalineServer());
    url.searchParams.set('path', requestPath);
    url.searchParams.set('pageSize', String(PAGE_SIZE));
    url.searchParams.set('page', String(page));

    const response = await fetch(url.toString(), { credentials: 'omit' });
    if (!response.ok) {
      throw new Error(`Failed to fetch inline comments page ${page}.`);
    }

    const payload = await response.json();
    if (!payload || typeof payload !== 'object' || !payload.data || typeof payload.data !== 'object') {
      throw new Error(`Unexpected inline comment payload for page ${page}.`);
    }
    return payload.data;
  }

  async function loadInlineCommentIndex(force = false) {
    const cache = ensureInlineCommentCache();
    if (!force && cache.loadedAt) return cache;
    if (cache.loadingPromise) return cache.loadingPromise;

    const requestPath = cache.path;
    if (!force) {
      const storedIndex = readStoredInlineIndex(requestPath, commentCounts);
      if (storedIndex) {
        cache.counts = storedIndex.counts;
        cache.commentsByIndex = storedIndex.commentsByIndex;
        cache.loadedAt = Date.now();
        return cache;
      }
    }

    cache.loadingPromise = (async () => {
      const counts = {};
      const commentsByIndex = {};
      const processComments = (comments) => {
        comments.forEach((comment) => {
          collectInlineCommentIndex(comment, counts, commentsByIndex);
        });
      };

      const firstPage = await fetchInlineCommentPage(requestPath, 1);
      processComments(firstPage.data || []);

      const totalPages = Number(firstPage.totalPages || 1);
      if (totalPages > 1) {
        const remainingPages = Array.from({ length: totalPages - 1 }, (_, idx) => idx + 2);

        for (let i = 0; i < remainingPages.length; i += INLINE_COMMENT_COUNTS_FETCH_CONCURRENCY) {
          const batch = remainingPages.slice(i, i + INLINE_COMMENT_COUNTS_FETCH_CONCURRENCY);
          const results = await Promise.all(batch.map((page) => fetchInlineCommentPage(requestPath, page)));
          results.forEach((pageData) => {
            processComments(pageData.data || []);
          });
        }
      }

      cache.counts = counts;
      cache.commentsByIndex = commentsByIndex;
      cache.loadedAt = Date.now();
      storeCounts(requestPath, counts);
      storeInlineIndex(requestPath, counts, commentsByIndex);
      return cache;
    })();

    try {
      return await cache.loadingPromise;
    } finally {
      cache.loadingPromise = null;
    }
  }

  async function fetchParagraphComments(paraIndex) {
    try {
      const cache = await loadInlineCommentIndex();
      commentCounts = mergeCountMaps(commentCounts, cache.counts);
      updateDecoratedButtons();
      return (cache.commentsByIndex[String(paraIndex)] || []).slice();
    } catch (e) {
      return [];
    }
  }

  function renderParagraphComments(panel, comments) {
    const list = panel.querySelector('.inline-comment-list');
    if (!comments.length) {
      list.innerHTML = '<div class="inline-comment-empty">暂无段评</div>';
      return;
    }
    list.innerHTML = comments.map((c, index) => {
      const time = new Date(c.time || c.insertedAt).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `<div class="inline-comment-item">
        <div class="inline-comment-item-header">
          <span class="inline-comment-item-nick">${escapeHtml(c.nick)}</span>
          <span class="inline-comment-item-time">${time}</span>
        </div>
        <div class="inline-comment-item-content">${escapeHtml(c.content)}</div>
        ${c.objectId ? `<div class="inline-comment-item-footer"><button type="button" class="inline-comment-reply" data-comment-index="${index}">回复</button></div>` : ''}
      </div>`;
    }).join('');

    list.querySelectorAll('.inline-comment-reply').forEach((button) => {
      button.addEventListener('click', () => {
        const comment = comments[Number(button.dataset.commentIndex)];
        if (comment) setReplyState(panel, comment);
      });
    });
  }

  async function fetchCommentCounts(force = false) {
    try {
      const path = getCommentPath();
      const indexes = getParagraphIndexes();
      if (!indexes.length) return {};

      const stored = readStoredCounts(path);

      if (!force) {
        const manifest = await loadInlineCommentManifest();
        const manifestCounts = normalizeCountMap(manifest[path]);
        const fastCounts = mergeCountMaps(manifestCounts, stored);

        if (Object.keys(fastCounts).length) {
          storeCounts(path, fastCounts);
          return projectCountsForIndexes(fastCounts, indexes);
        }

        if (stored && Object.keys(stored).length) {
          refreshCountsFromIndexInBackground(path, stored);
          return projectCountsForIndexes(stored, indexes);
        }

        const cache = await loadInlineCommentIndex();
        const derivedCounts = mergeCountMaps(cache.counts, stored);
        storeCounts(path, derivedCounts);
        return projectCountsForIndexes(derivedCounts, indexes);
      }

      const cache = await loadInlineCommentIndex(true);
      const derivedCounts = mergeCountMaps(cache.counts, stored);
      storeCounts(path, derivedCounts);

      return projectCountsForIndexes(derivedCounts, indexes);
    } catch (e) {
      console.error('fetchCommentCounts error:', e);
      return {};
    }
  }

  async function refreshCommentCounts(force = false) {
    commentCounts = await fetchCommentCounts(force);
    updateDecoratedButtons();
  }

  function decorateParagraphs() {
    const paragraphs = document.querySelectorAll('.post-content p');
    if (!paragraphs.length) return;

    paragraphs.forEach((p, idx) => {
      const text = getParagraphText(p);
      if (!text) return;

      if (!p.id) {
        p.id = `p-${idx + 1}`;
      }

      const idxStr = String(idx + 1);
      let btn = p.querySelector(':scope > .inline-comment-btn');
      if (!btn) {
        btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'inline-comment-btn';
        p.appendChild(btn);
      }

      applyButtonCount(btn, commentCounts[idxStr] || 0);
      btn.dataset.quote = truncateOneLine(text, 15);
      btn.dataset.index = idxStr;
      btn.dataset.anchor = p.id;

      if (btn.dataset.inlineCommentBound === 'true') {
        p.classList.add('inline-comment-decorated');
        return;
      }

      btn.addEventListener('click', async () => {
        const panel = buildPanel();
        const textarea = panel.querySelector('.inline-comment-textarea');
        const list = panel.querySelector('.inline-comment-list');
        const quote = btn.dataset.quote || '';
        const index = btn.dataset.index || '';
        const anchor = btn.dataset.anchor || '';
        activeReply = null;
        resetReplyState(panel);
        textarea.value = '';
        textarea.dataset.paraIndex = index;
        textarea.dataset.paraQuote = quote;
        textarea.dataset.paraAnchor = anchor;
        activeButton = btn;
        list.innerHTML = '<div class="inline-comment-loading">加载中...</div>';

        openPanel(panel);
        if (isSmallScreen()) {
          setTimeout(schedulePanelViewportSync, 250);
        }

        if (typeof window.__WALINE_ENSURE_READY__ === 'function') {
          window.__WALINE_ENSURE_READY__().catch((error) => {
            console.error('ensureWalineReady error:', error);
          });
        }

        const comments = await fetchParagraphComments(index);
        renderParagraphComments(panel, comments);
      });

      btn.dataset.inlineCommentBound = 'true';
      p.classList.add('inline-comment-decorated');
    });
  }

  function onReady() {
    const countsPromise = fetchCommentCounts();
    decorateParagraphs();
    countsPromise.then((counts) => {
      commentCounts = counts;
      updateDecoratedButtons();
    }).catch((error) => {
      console.error('fetchCommentCounts init error:', error);
    });

    const postContent = document.querySelector('.post-content');
    if (postContent && window.MutationObserver) {
      const observer = new MutationObserver(() => {
        decorateParagraphs();
      });
      observer.observe(postContent, { childList: true, subtree: true });
    }

    document.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href') || '';
      if (!href.startsWith('#p-')) return;
      const target = document.querySelector(href);
      if (!target) return;

      e.preventDefault();
      const rect = target.getBoundingClientRect();
      const targetTop = rect.top + window.scrollY;
      const offset = (window.innerHeight - rect.height) / 2;
      const top = Math.max(0, targetTop - offset);
      window.scrollTo({ top, behavior: 'smooth' });
      history.replaceState(null, '', href);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
