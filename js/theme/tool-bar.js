window.onscroll = function () {
  'use strict';
  if (window.scrollY > 200 || document.body.scrollTop > 200 || document.documentElement.scrollTop > 200) {
    document.getElementById('back-to-top').style.display = 'block';
    document.getElementById('go-to-bottom').style.display = 'block';
  } else {
    document.getElementById('back-to-top').style.display = 'none';
    document.getElementById('go-to-bottom').style.display = 'none';
  }
};

function scrollToTop() {
  'use strict';
  window.scrollTo(0, 0);
  document.body.scrollTop = 0; // Safari
  document.documentElement.scrollTop = 0; // Chrome, Firefox, IE, Opera
}

function scrollToBottom() {
  'use strict';
  window.scrollTo(0, document.body.scrollHeight);
  document.body.scrollTop = document.body.scrollHeight; // Safari
  document.documentElement.scrollTop = document.body.scrollHeight; // Chrome, Firefox, IE, Opera
}

function tocToggle() {
  'use strict';
  var tocContainer = document.getElementById('post-toc');
  if (tocContainer != null) {
    if (!tocContainer.getAttribute('toc-show')) {
      tocContainer.setAttribute('toc-show', true);
      // 
      if (document.getElementById('hbePass')) {
        document.getElementById('toc-body').style.display = 'none';
      } else {
        document.getElementById('toc-body').style.display = 'block';
      }
    } else {
      tocContainer.removeAttribute('toc-show')
    }
  }
}

function gotoComment() {
  'use strict';
  var commentContainer = document.getElementById('comment');
  if (commentContainer) {
    commentContainer.scrollIntoView({ behavior: 'smooth' });
  }
}

function toolToggle() {
  'use strict';
  var moreToolsContainer = document.getElementById('tool-bar-more');
  if (moreToolsContainer.style.display == 'none') {
    moreToolsContainer.style.display = 'block';
  } else {
    moreToolsContainer.style.display = 'none';
  }
}

function darkmodeSwitch() {
  'use strict';
  darkMode.toggleMode();
  // change comment theme synchronously 同步修改评论区主题
  if (document.getElementById('comment')) {
    if (darkMode.getMode() == "dark") {
      sendGiscusMessage({
        setConfig: {
          theme: 'noborder_dark',
        }
      });
    } else {
      sendGiscusMessage({
        setConfig: {
          theme: GLOBAL_CONFIG.comment.theme,
        }
      });
    }
  }
}

function sendGiscusMessage(message) {
  const iframe = document.getElementsByClassName('giscus-frame')[0];
  if (!iframe) return;
  iframe.contentWindow.postMessage({ giscus: message }, 'https://giscus.app');
}

function fontSizeIncrease() {
  'use strict';
  var postContent = document.querySelector('.post-content');
  if (postContent) {
    var sizeNum = 18;
    if (localStorage.getItem('font-size')) {
      sizeNum = parseInt(localStorage.getItem('font-size')) + 2;
    } else {
      var currentSize = window.getComputedStyle(postContent).getPropertyValue('font-size');
      sizeNum = parseInt(currentSize) + 2;
    }
    postContent.style.fontSize = sizeNum + 'px';
    localStorage.setItem('font-size', sizeNum);
  }
}

function fontSizeDecrease() {
  'use strict';
  var postContent = document.querySelector('.post-content');
  if (postContent) {
    var sizeNum = 18;
    if (localStorage.getItem('font-size')) {
      sizeNum = parseInt(localStorage.getItem('font-size')) - 2;
    } else {
      var currentSize = window.getComputedStyle(postContent).getPropertyValue('font-size');
      sizeNum = parseInt(currentSize) - 2;
    }
    postContent.style.fontSize = sizeNum + 'px';
    localStorage.setItem('font-size', sizeNum);
  }
}

function randomPost(tag) {
  'use strict';
  fetch('/posts.json')
    .then(function(res) { return res.json(); })
    .then(function(posts) {
      if (tag) {
        posts = posts.filter(function(p) {
          return p.tags && p.tags.some(function(t) { return t.indexOf(tag) !== -1; });
        });
      }
      if (posts && posts.length) {
        var post = posts[Math.floor(Math.random() * posts.length)];
        window.location.href = '/' + post.path;
      }
    });
}

function toggleRandomMenu() {
  'use strict';
  var header = document.querySelector('.random-header');
  var menu = document.querySelector('.random-menu');
  if (menu && header) {
    menu.classList.toggle('open');
    header.classList.toggle('open');
  }
}

document.addEventListener('click', function(e) {
  'use strict';
  var random = document.querySelector('.sidebar-random');
  if (random && !random.contains(e.target)) {
    var menu = document.querySelector('.random-menu');
    var header = document.querySelector('.random-header');
    if (menu && header) {
      menu.classList.remove('open');
      header.classList.remove('open');
    }
  }
});

// ===== 书签功能 =====
function getBookmarkKey() {
  'use strict';
  return 'meow-bookmark-' + window.location.pathname;
}

function saveBookmark() {
  'use strict';
  var key = getBookmarkKey();
  var scrollTop = window.scrollY || document.documentElement.scrollTop;
  var docHeight = document.documentElement.scrollHeight - window.innerHeight;
  var percent = docHeight > 0 ? Math.round((scrollTop / docHeight) * 100) : 0;
  var data = {
    position: scrollTop,
    percent: percent,
    timestamp: Date.now()
  };
  localStorage.setItem(key, JSON.stringify(data));
  updateBookmarkIcon(true);
}

function loadBookmark() {
  'use strict';
  var key = getBookmarkKey();
  var raw = localStorage.getItem(key);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function clearBookmark() {
  'use strict';
  var key = getBookmarkKey();
  localStorage.removeItem(key);
  updateBookmarkIcon(false);
  hideBookmarkBanner();
}

function toggleBookmark() {
  'use strict';
  var existing = loadBookmark();
  if (existing) {
    clearBookmark();
  } else {
    saveBookmark();
  }
}

function updateBookmarkIcon(hasBookmark) {
  'use strict';
  var btn = document.getElementById('bookmark-toggle');
  if (!btn) return;
  var icon = btn.querySelector('i');
  if (hasBookmark) {
    icon.className = 'fa-solid fa-bookmark';
    btn.title = '已设置书签（点击清除）';
  } else {
    icon.className = 'fa-regular fa-bookmark';
    btn.title = '添加书签';
  }
}

function showBookmarkBanner(data) {
  'use strict';
  var banner = document.getElementById('bookmark-banner');
  var info = document.getElementById('bookmark-info');
  if (!banner || !info) return;
  info.textContent = '已读 ' + data.percent + '%';
  banner.style.display = 'block';
}

function hideBookmarkBanner() {
  'use strict';
  var banner = document.getElementById('bookmark-banner');
  if (banner) banner.style.display = 'none';
}

// 书签初始化
(function initBookmark() {
  'use strict';
  var data = loadBookmark();
  if (data) {
    updateBookmarkIcon(true);
    showBookmarkBanner(data);
  }

  // 恢复按钮
  var restoreBtn = document.getElementById('bookmark-restore');
  if (restoreBtn) {
    restoreBtn.addEventListener('click', function() {
      var saved = loadBookmark();
      if (saved && saved.position > 0) {
        hideBookmarkBanner();
        setTimeout(function() {
          window.scrollTo({ top: saved.position, behavior: 'smooth' });
        }, 100);
      } else {
        hideBookmarkBanner();
      }
    });
  }

  // 清除按钮
  var clearBtn = document.getElementById('bookmark-clear');
  if (clearBtn) {
    clearBtn.addEventListener('click', function() {
      clearBookmark();
    });
  }

  // 自动保存（防抖500ms）
  var bookmarkTimer = null;
  window.addEventListener('scroll', function() {
    clearTimeout(bookmarkTimer);
    bookmarkTimer = setTimeout(function() {
      var scrollTop = window.scrollY || document.documentElement.scrollTop;
      if (scrollTop > 200) {
        saveBookmark();
      }
    }, 500);
  });

  // 页面关闭前保存
  window.addEventListener('beforeunload', function() {
    var scrollTop = window.scrollY || document.documentElement.scrollTop;
    if (scrollTop > 200) {
      saveBookmark();
    }
  });
})();