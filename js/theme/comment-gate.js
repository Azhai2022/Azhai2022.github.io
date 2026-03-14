(() => {
  function gateComments() {
    const encryptRoot = document.getElementById('hexo-blog-encrypt');
    const commentRoot = document.getElementById('comment');
    if (!commentRoot) return;

    if (encryptRoot) {
      const show = () => { commentRoot.style.display = ''; };
      const hide = () => { commentRoot.style.display = 'none'; };

      // If already decrypted (no password input), show comments.
      if (!encryptRoot.querySelector('#hbePass')) {
        show();
        return;
      }

      hide();

      window.addEventListener('hexo-blog-decrypt', () => {
        show();
      }, { once: true });

      const observer = new MutationObserver(() => {
        if (!encryptRoot.querySelector('#hbePass')) {
          show();
          observer.disconnect();
        }
      });
      observer.observe(encryptRoot, { childList: true, subtree: true });

      // Fallback in case the decrypt event fires before listener binds.
      let tries = 0;
      const timer = setInterval(() => {
        tries += 1;
        if (!encryptRoot.querySelector('#hbePass')) {
          show();
          clearInterval(timer);
        } else if (tries >= 10) {
          clearInterval(timer);
        }
      }, 500);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', gateComments);
  } else {
    gateComments();
  }
})();
