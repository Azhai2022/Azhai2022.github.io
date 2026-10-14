var searchDataCache = {};

var loadSearchData = function(path) {
  'use strict';

  if (searchDataCache[path] && searchDataCache[path].datas) {
    return $.Deferred().resolve(searchDataCache[path].datas).promise();
  }

  if (searchDataCache[path] && searchDataCache[path].request) {
    return searchDataCache[path].request;
  }

  var request = $.ajax({
    url: path,
    dataType: 'xml'
  }).then(function(xmlResponse) {
    var datas = $('entry', xmlResponse).map(function() {
      return {
        title: $('title', this).text(),
        url: $('url', this).text()
      };
    }).get().filter(function(item) {
      return item.title !== '同人小剧场合集';
    });

    searchDataCache[path] = { datas: datas };
    return datas;
  }, function() {
    delete searchDataCache[path];
    return $.Deferred().reject().promise();
  });

  searchDataCache[path] = { request: request };
  return request;
};

var searchFunc = function(path, search_id, content_id) {
  'use strict';

  var escapeRegExp = function(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
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

  var input = document.getElementById(search_id);
  var resultContent = document.getElementById(content_id);
  var searchCount = document.getElementById('search-count');
  var searchEmpty = document.getElementById('search-result-empty');
  if (!input || !resultContent || input.getAttribute('data-search-bound')) return;

  input.setAttribute('data-search-bound', 'true');

  var initSearchCount = searchCount ? searchCount.innerText : '';

  var resetSearchState = function() {
    if (searchCount) searchCount.removeAttribute('search-count-show');
    if (searchEmpty) searchEmpty.removeAttribute('search-empty-show');
  };

  var renderSearchResults = function(datas, keywordText) {
    if ((input.value ? input.value.trim().toLowerCase() : '') !== keywordText) return;

    var keywords = keywordText.split(/[\s\-]+/).filter(Boolean);
    var str = '<ul class="search-result-list">';
    var matchCount = 0;
    var maxResultCount = 80;

    datas.forEach(function(data) {
      if (matchCount >= maxResultCount) return;

      var title = (data.title || 'Untitled').trim();
      var dataTitle = title.toLowerCase();

      var isMatch = true;

      keywords.forEach(function(keyword) {
        var indexTitle = dataTitle.indexOf(keyword);

        if (indexTitle < 0) {
          isMatch = false;
        }
      });

      if (!isMatch) return;

      matchCount++;
      var highlightedTitle = title;

      keywords.forEach(function(keyword) {
        var regS = new RegExp(escapeRegExp(keyword), 'gi');
        highlightedTitle = highlightedTitle.replace(regS, '<em class="search-keyword">' + keyword + '</em>');
      });

      str += "<li><a href='" + data.url + "' class='search-result-title'>" + highlightedTitle + '</a>';

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

  var runSearch = function() {
    var keywordText = this.value ? this.value.trim().toLowerCase() : '';
    resultContent.innerHTML = '';

    if (!keywordText) {
      resetSearchState();
      return;
    }

    var keywords = keywordText.split(/[\s\-]+/).filter(Boolean);
    if (!keywords.length) {
      resetSearchState();
      return;
    }

    loadSearchData(path).done(function(datas) {
      renderSearchResults(datas, keywordText);
    }).fail(function() {
      if ((input.value ? input.value.trim().toLowerCase() : '') !== keywordText) return;
      if (searchEmpty) {
        searchEmpty.setAttribute('search-empty-show', true);
        searchEmpty.innerText = '搜索索引加载失败，请刷新后重试。';
      }
    });
  };

  input.addEventListener('input', debounce(runSearch, 120));
  if (input.value && input.value.trim().length > 0) {
    runSearch.call(input);
  }
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
