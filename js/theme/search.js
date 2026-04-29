var searchFunc = function(path, search_id, content_id) {
  'use strict';

  var escapeRegExp = function(text) {
    return text.replace(/[.*+?^${}()|[\]\]/g, '\$&');
  };

  var debounce = function(fn, wait) {
    var timer = null;
    return function() {
      var ctx = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function() {
        fn.apply(ctx, args);
      }, wait);
    };
  };

  $.ajax({
    url: path,
    dataType: 'xml',
    success: function(xmlResponse) {
      var datas = $('entry', xmlResponse).map(function() {
        return {
          title: $('title', this).text(),
          content: $('content', this).text(),
          url: $('url', this).text()
        };
      }).get().filter(function(item) {
        return item.title !== '同人小剧场合集';
      });

      var input = document.getElementById(search_id);
      var resultContent = document.getElementById(content_id);
      var searchCount = document.getElementById('search-count');
      var searchEmpty = document.getElementById('search-result-empty');
      if (!input || !resultContent) return;

      var initSearchCount = searchCount ? searchCount.innerText : '';

      var runSearch = function() {
        var keywordText = this.value ? this.value.trim().toLowerCase() : '';
        resultContent.innerHTML = '';

        if (!keywordText) {
          if (searchCount) searchCount.removeAttribute('search-count-show');
          if (searchEmpty) searchEmpty.removeAttribute('search-empty-show');
          return;
        }

        var keywords = keywordText.split(/[\s\-]+/).filter(Boolean);
        if (!keywords.length) {
          if (searchCount) searchCount.removeAttribute('search-count-show');
          if (searchEmpty) searchEmpty.removeAttribute('search-empty-show');
          return;
        }

        var str = '<ul class="search-result-list">';
        var matchCount = 0;
        var maxResultCount = 80;

        datas.forEach(function(data) {
          if (matchCount >= maxResultCount) return;

          var title = (data.title || 'Untitled').trim();
          var dataTitle = title.toLowerCase();
          var plainContent = (data.content || '').trim().replace(/<[^>]+>/g, '');
          var dataContent = plainContent.toLowerCase();

          var isMatch = true;
          var firstOccur = -1;

          keywords.forEach(function(keyword, i) {
            var indexTitle = dataTitle.indexOf(keyword);
            var indexContent = dataContent.indexOf(keyword);

            if (indexTitle < 0 && indexContent < 0) {
              isMatch = false;
              return;
            }

            if (indexContent >= 0 && i === 0) {
              firstOccur = indexContent;
            }
          });

          if (!isMatch) return;

          matchCount++;
          str += "<li><a href='" + data.url + "' class='search-result-title'>" + title + '</a>';

          if (plainContent.length > 0) {
            var start = firstOccur >= 0 ? Math.max(firstOccur - 20, 0) : 0;
            var end = Math.min(start + 100, plainContent.length);
            var matchContent = plainContent.substring(start, end);

            keywords.forEach(function(keyword) {
              var regS = new RegExp(escapeRegExp(keyword), 'gi');
              matchContent = matchContent.replace(regS, '<em class="search-keyword">' + keyword + '</em>');
            });

            str += '<p class="search-result-content">' + matchContent + '...</p>';
          }

          str += '</li>';
        });

        str += '</ul>';

        if (matchCount <= 0) {
          if (searchCount) searchCount.removeAttribute('search-count-show');
          if (searchEmpty) searchEmpty.setAttribute('search-empty-show', true);
          resultContent.innerHTML = '';
          return;
        }

        resultContent.innerHTML = str;
        if (searchCount) {
          searchCount.setAttribute('search-count-show', true);
          searchCount.innerText = initSearchCount + matchCount;
        }
        if (searchEmpty) searchEmpty.removeAttribute('search-empty-show');
      };

      input.addEventListener('input', debounce(runSearch, 120));
      if (input.value && input.value.trim().length > 0) {
        runSearch.call(input);
      }
    },
    error: function() {
      var searchEmpty = document.getElementById('search-result-empty');
      if (searchEmpty) {
        searchEmpty.setAttribute('search-empty-show', true);
        searchEmpty.innerText = '搜索索引加载失败，请刷新后重试。';
      }
    }
  });
};

function toggleSearchWindow() {
  'use strict';
  var searchPanel = document.getElementById('search-panel');
  if (!searchPanel) return;

  if (searchPanel.getAttribute('search-show')) {
    searchPanel.removeAttribute('search-show');
    return;
  }

  if (typeof closeTopMenu === 'function') {
    closeTopMenu();
  }

  searchPanel.setAttribute('search-show', true);

  var input = document.getElementById('search-input');
  if (input && typeof input.focus === 'function') {
    input.focus();
  }
}
