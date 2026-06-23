(() => {
  const DEFAULT_WALINE_SERVER = 'https://comment.zhai.azhai.space';
  const PAGE_SIZE = 100;
  let activeButton = null;
  let commentCounts = {};
  let countsLoading = false;

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

  function closePanel(panel) {
    panel.classList.remove('is-open');
    const backdrop = document.getElementById('inline-comment-backdrop');
    if (backdrop) backdrop.remove();
    activeButton = null;
  }

  function updateDecoratedButtons() {
    document.querySelectorAll('.inline-comment-btn').forEach((btn) => {
      const index = btn.dataset.index;
      if (!index) return;
      applyButtonCount(btn, commentCounts[index] || 0);
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

    panel.querySelector('.inline-comment-cancel').addEventListener('click', () => {
      closePanel(panel);
    });

    panel.querySelector('.inline-comment-submit').addEventListener('click', () => {
      const textarea = panel.querySelector('.inline-comment-textarea');
      const content = (textarea.value || '').trim();
      if (!content) return;
      const targetButton = activeButton;
      const targetIndex = targetButton ? targetButton.dataset.index : '';

      const walineRoot = document.getElementById('waline');
      const walineEditor = walineRoot ? walineRoot.querySelector('textarea') : null;
      const walineSubmit = walineRoot
        ? walineRoot.querySelector('button[type="submit"], button.wl-submit')
        : null;

      if (!walineEditor || !walineSubmit) {
        closePanel(panel);
        return;
      }

      walineEditor.value = content;
      walineEditor.dispatchEvent(new Event('input', { bubbles: true }));
      walineSubmit.click();

      if (targetIndex) {
        commentCounts[targetIndex] = (commentCounts[targetIndex] || 0) + 1;
        updateDecoratedButtons();
        [2000, 6000].forEach((delay) => {
          setTimeout(refreshCommentCounts, delay);
        });
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

  function truncateOneLine(text, maxChars = 20) {
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

  function stripHtml(html) {
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || '';
  }

  async function fetchParagraphComments(paraIndex) {
    try {
      const url = new URL('/api/comment/', getWalineServer());
      url.searchParams.set('path', getCommentPath());
      url.searchParams.set('pageSize', String(PAGE_SIZE));

      const res = await fetch(url.toString());
      const data = await res.json();
      const comments = data.data?.data || [];
      const results = [];

      function matchComment(comment) {
        const text = (comment.comment || comment.orig || '');
        const match = text.match(/第(\d+)段/);
        if (match && match[1] === String(paraIndex)) {
          const clean = stripHtml(comment.comment || '').replace(/^.*?】\s*/, '').replace(/^引用（第\d+段）：.*?定位\s*/, '').trim();
          if (clean) {
            results.push({
              nick: comment.nick || '匿名',
              content: clean,
              time: comment.time
            });
          }
        }
        if (comment.children) {
          comment.children.forEach(matchComment);
        }
      }

      comments.forEach(matchComment);

      const totalPages = data.data?.totalPages || 1;
      for (let p = 2; p <= totalPages; p++) {
        url.searchParams.set('page', String(p));
        const nextRes = await fetch(url.toString());
        const nextData = await nextRes.json();
        const nextComments = nextData.data?.data || [];
        nextComments.forEach(matchComment);
      }

      return results;
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
    list.innerHTML = comments.map(c => {
      const time = new Date(c.time).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      return `<div class="inline-comment-item">
        <div class="inline-comment-item-header">
          <span class="inline-comment-item-nick">${escapeHtml(c.nick)}</span>
          <span class="inline-comment-item-time">${time}</span>
        </div>
        <div class="inline-comment-item-content">${escapeHtml(c.content)}</div>
      </div>`;
    }).join('');
  }

  async function fetchCommentCounts() {
    try {
      const url = new URL('/api/comment/', getWalineServer());
      url.searchParams.set('path', getCommentPath());
      url.searchParams.set('pageSize', String(PAGE_SIZE));

      const res = await fetch(url.toString());
      const data = await res.json();
      const comments = data.data?.data || [];
      const counts = {};

      function extractCount(comment) {
        const text = (comment.comment || comment.orig || '');
        const match = text.match(/第(\d+)段/);
        if (match) {
          const idx = match[1];
          counts[idx] = (counts[idx] || 0) + 1;
        }
        if (comment.children) {
          comment.children.forEach(extractCount);
        }
      }

      comments.forEach(extractCount);

      const totalPages = data.data?.totalPages || 1;
      for (let p = 2; p <= totalPages; p++) {
        url.searchParams.set('page', String(p));
        const nextRes = await fetch(url.toString());
        const nextData = await nextRes.json();
        const nextComments = nextData.data?.data || [];
        nextComments.forEach(extractCount);
      }

      return counts;
    } catch (e) {
      console.error('fetchCommentCounts error:', e);
      return {};
    }
  }

  async function refreshCommentCounts() {
    if (countsLoading) return;
    countsLoading = true;
    commentCounts = await fetchCommentCounts();
    countsLoading = false;
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
      btn.dataset.quote = truncateOneLine(text, 20);
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
        const jump = anchor ? ` <a href="#${anchor}">定位</a>` : '';
        const safeQuote = escapeHtml(quote);
        const prefix = quote ? `<blockquote>引用（第${index}段）：${safeQuote}${jump}</blockquote>\n\n` : '';
        textarea.value = prefix;
        activeButton = btn;
        list.innerHTML = '<div class="inline-comment-loading">加载中...</div>';

        let backdrop = document.getElementById('inline-comment-backdrop');
        if (!backdrop) {
          backdrop = document.createElement('div');
          backdrop.id = 'inline-comment-backdrop';
          backdrop.className = 'inline-comment-backdrop';
          document.body.appendChild(backdrop);
        }

        panel.classList.add('is-open');

        const comments = await fetchParagraphComments(index);
        renderParagraphComments(panel, comments);

        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      });

      btn.dataset.inlineCommentBound = 'true';
      p.classList.add('inline-comment-decorated');
    });
  }

  function onReady() {
    decorateParagraphs();
    refreshCommentCounts();

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
