function decodeToc() {
  'use strict';
  if (document.getElementById('toc-body')) {
    document.getElementById('toc-body').addEventListener('click', function (event) {
      var targetLink = event.target.closest('a.toc-content-link');
      if (!targetLink) return;
      var decodeId = decodeURIComponent(targetLink.getAttribute('href').replace('#', ''));
      var targetHeading = document.getElementById(decodeId);
      if (!targetHeading) return;
      event.preventDefault();
      targetHeading.scrollIntoView({ behavior: 'smooth' });
    });
  }
}
