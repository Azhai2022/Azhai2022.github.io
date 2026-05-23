(function () {
  'use strict';

  // Only gate the homepage (/) and do it once per tab session.
  var isHome = location.pathname === '/' || location.pathname === '';
  if (!isHome) return;
  if (sessionStorage.getItem('homeGatePassed') === '1') return;

  function createGate() {
    var overlay = document.createElement('div');
    overlay.id = 'home-gate-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');

    var card = document.createElement('div');
    card.id = 'home-gate-card';

    var title = document.createElement('h2');
    title.textContent = '入站提示';

    var content = document.createElement('div');
    content.id = 'home-gate-content';
    content.innerHTML = [
      '<p class="gate-warn">禁止二传二改本站任何内容；</p>',
      '<p class="gate-warn">禁止传播本站网址，截图时请勿露出网址。</p>',
      '<p>继续访问即表示你已知悉并同意相关提示。</p>'
    ].join('');

    var btn = document.createElement('button');
    btn.id = 'home-gate-confirm';
    btn.type = 'button';
    btn.textContent = '我已知晓，进入首页';

    card.appendChild(title);
    card.appendChild(content);
    card.appendChild(btn);
    overlay.appendChild(card);

    var style = document.createElement('style');
    style.id = 'home-gate-style';
    style.textContent = [
      '#home-gate-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);}',
      '#home-gate-card{width:min(92vw,560px);background:#fffdf6;border:1px solid #f2dfb7;border-radius:14px;padding:22px 18px;box-shadow:0 12px 30px rgba(0,0,0,.18);}',
      '#home-gate-card h2{margin:0 0 12px 0;color:#c07a1a;font-size:24px;line-height:1.25;text-align:center;}',
      '#home-gate-content{color:#5a4a2d;font-size:15px;line-height:1.8;}',
      '#home-gate-content p{margin:0 0 8px 0;}',
      '#home-gate-content .gate-warn{color:#d93025;font-weight:700;}',
      '#home-gate-confirm{margin-top:12px;width:100%;height:42px;border:0;border-radius:10px;background:#e8ae4a;color:#fff;font-size:15px;font-weight:700;cursor:pointer;}',
      '#home-gate-confirm:active{transform:translateY(1px);}'
    ].join('');

    document.head.appendChild(style);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    btn.addEventListener('click', function () {
      sessionStorage.setItem('homeGatePassed', '1');
      document.body.style.overflow = '';
      overlay.remove();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', createGate);
  } else {
    createGate();
  }
})();
