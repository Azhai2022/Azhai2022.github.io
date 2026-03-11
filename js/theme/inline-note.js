(() => {
  function ensurePopup() {
    let popup = document.getElementById('inline-note-popup');
    if (!popup) {
      popup = document.createElement('div');
      popup.id = 'inline-note-popup';
      popup.className = 'inline-note-popup';
      popup.setAttribute('role', 'tooltip');
      document.body.appendChild(popup);
    }
    return popup;
  }

  function positionPopup(popup, target) {
    const rect = target.getBoundingClientRect();
    popup.style.display = 'block';
    popup.style.left = '0px';
    popup.style.top = '0px';
    const popupRect = popup.getBoundingClientRect();

    let left = rect.left + window.scrollX;
    let top = rect.bottom + window.scrollY + 6;

    const maxLeft = window.scrollX + window.innerWidth - popupRect.width - 8;
    if (left > maxLeft) left = maxLeft;
    if (left < window.scrollX + 8) left = window.scrollX + 8;

    const maxTop = window.scrollY + window.innerHeight - popupRect.height - 8;
    if (top > maxTop) {
      top = rect.top + window.scrollY - popupRect.height - 6;
    }
    if (top < window.scrollY + 8) top = window.scrollY + 8;

    popup.style.left = `${left}px`;
    popup.style.top = `${top}px`;
  }

  function hidePopup(popup) {
    popup.style.display = 'none';
    popup.textContent = '';
    popup.removeAttribute('data-active');
  }

  function onReady() {
    const popup = ensurePopup();
    const refs = document.querySelectorAll('.inline-note-ref');
    if (!refs.length) return;

    document.addEventListener('click', (e) => {
      const ref = e.target.closest('.inline-note-ref');
      if (!ref) {
        hidePopup(popup);
        return;
      }
      e.preventDefault();
      const noteText = ref.getAttribute('data-note') || '';
      if (!noteText) return;
      if (popup.getAttribute('data-active') === noteText && popup.style.display === 'block') {
        hidePopup(popup);
        return;
      }
      popup.textContent = noteText;
      popup.setAttribute('data-active', noteText);
      positionPopup(popup, ref);
    });

    window.addEventListener('scroll', () => hidePopup(popup), true);
    window.addEventListener('resize', () => hidePopup(popup));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onReady);
  } else {
    onReady();
  }
})();
