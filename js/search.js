// search.js
(function () {
  const input = document.querySelector('.search-input');
  const resultContainer = document.querySelector('.search-result');

  if (!input || !resultContainer) return;

  fetch('/search.xml')
    .then(res => res.text())
    .then(xml => {
      const parser = new DOMParser();
      const data = [...parser.parseFromString(xml, 'text/xml').querySelectorAll('entry')].map(entry => ({
        title: entry.querySelector('title').textContent,
        content: entry.querySelector('content').textContent,
        url: entry.querySelector('url').textContent
      }));

      input.addEventListener('input', function () {
        const keywords = this.value.trim().toLowerCase().split(/[\s\-]+/);
        resultContainer.innerHTML = '';

        if (!this.value.trim()) return;

        const results = data.filter(item =>
          keywords.every(keyword =>
            item.title.toLowerCase().includes(keyword) ||
            item.content.toLowerCase().includes(keyword)
          )
        );

        resultContainer.innerHTML = results.length
          ? results.map(r => `<div><a href="${r.url}">${r.title}</a></div>`).join('')
          : '<div>没有找到匹配的内容</div>';
      });
    });
})();
