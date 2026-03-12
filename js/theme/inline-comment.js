(() => {
  function buildPanel() {
    let panel = document.getElementById('inline-comment-panel');
    if (panel) return panel;

    panel = document.createElement('div');
    panel.id = 'inline-comment-panel';
    panel.className = 'inline-comment-panel';
    panel.innerHTML = `
      <div class="inline-comment-title">段评</div>
      <textarea class="inline-comment-textarea" placeholder="写下你的评论..."></textarea>
      <div class="inline-comment-actions">
        <button type="button" class="inline-comment-submit">发送</button>
        <button type="button" class="inline-comment-cancel">取消</button>
      </div>
    `;
    document.body.appendChild(panel);

    panel.querySelector('.inline-comment-cancel').addEventListener('click', () => {
      panel.classList.remove('is-open');
    });

    panel.querySelector('.inline-comment-submit').addEventListener('click', () => {
      const textarea = panel.querySelector('.inline-comment-textarea');
      const content = (textarea.value || '').trim();
      if (!content) return;

      const walineRoot = document.getElementById('waline');
      const walineEditor = walineRoot ? walineRoot.querySelector('textarea') : null;
      const walineSubmit = walineRoot
        ? walineRoot.querySelector('button[type="submit"], button.wl-submit')
        : null;

      if (!walineEditor || !walineSubmit) {
        panel.classList.remove('is-open');
        return;
      }

      walineEditor.value = content;
      walineEditor.dispatchEvent(new Event('input', { bubbles: true }));
      walineSubmit.click();
      panel.classList.remove('is-open');
      textarea.value = '';
    });

    document.addEventListener('click', (e) => {
      if (!panel.classList.contains('is-open')) return;
      if (e.target.closest('.inline-comment-panel')) return;
      if (e.target.closest('.inline-comment-btn')) return;
      panel.classList.remove('is-open');
    });

    return panel;
  }

  function truncateOneLine(text, maxChars = 20) {
    const cleaned = (text || '').replace(/\s+/g, '');
    const chars = Array.from(cleaned);
    if (chars.length <= maxChars) return chars.join('');
    return chars.slice(0, maxChars).join('') + '……';
  }

  function decorateParagraphs() {
    const paragraphs = document.querySelectorAll('.post-content p');
    if (!paragraphs.length) return;

    paragraphs.forEach((p, idx) => {
      if (p.classList.contains('inline-comment-decorated')) return;
      const text = (p.textContent || '').trim();
      if (!text) return;

      if (!p.id) {
        p.id = `p-${idx + 1}`;
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'inline-comment-btn';
      btn.textContent = '评';
      btn.setAttribute('aria-label', '对这段评论');
      btn.dataset.quote = truncateOneLine(text, 20);
      btn.dataset.index = String(idx + 1);
      btn.dataset.anchor = p.id;

      btn.addEventListener('click', () => {
        const panel = buildPanel();
        const textarea = panel.querySelector('.inline-comment-textarea');
        const quote = btn.dataset.quote || '';
        const index = btn.dataset.index || '';
        const anchor = btn.dataset.anchor || '';
        const jump = anchor ? ` [定位](#${anchor})` : '';
        const prefix = quote ? `> 引用（第${index}段）：${quote}${jump}\n\n` : '';
        textarea.value = prefix;
        panel.classList.add('is-open');
        textarea.focus();
        textarea.setSelectionRange(textarea.value.length, textarea.value.length);
      });

      p.appendChild(btn);
      p.classList.add('inline-comment-decorated');
    });
  }

  function onReady() {
    decorateParagraphs();

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
