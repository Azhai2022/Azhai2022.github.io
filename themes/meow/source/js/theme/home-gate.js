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

    var warning = document.createElement('div');
    warning.id = 'home-gate-warning';
    warning.setAttribute('role', 'alert');
    warning.innerHTML = [
      '<strong>禁止传播本站网址</strong>',
      '<span>截图时请勿露出网址</span>'
    ].join('');

    var content = document.createElement('div');
    content.id = 'home-gate-content';
    content.innerHTML = [
      '<p class="gate-warn">禁止二传二改本站任何内容；</p>',
      '<p>继续访问即表示你已知悉并同意相关提示。</p>'
    ].join('');

    var btn = document.createElement('button');
    btn.id = 'home-gate-confirm';
    btn.type = 'button';
    btn.textContent = '我已知晓，进入首页';
    var step = 1;

    card.appendChild(warning);
    card.appendChild(content);
    card.appendChild(btn);
    overlay.appendChild(card);

    var style = document.createElement('style');
    style.id = 'home-gate-style';
    style.textContent = [
      '#home-gate-overlay{position:fixed;inset:0;z-index:99999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,.55);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);}',
      '#home-gate-card{width:min(92vw,560px);overflow:hidden;background:#fffdf6;border:1px solid #f2dfb7;border-radius:14px;padding:0 18px 22px;box-shadow:0 12px 30px rgba(0,0,0,.18);}',
      '#home-gate-warning{margin:0 -18px 18px;padding:18px 18px 16px;background:#c62828;color:#fff;text-align:center;box-shadow:inset 0 -3px 0 rgba(90,0,0,.2);}',
      '#home-gate-warning strong{display:block;font-size:30px;line-height:1.2;letter-spacing:2px;text-shadow:0 2px 0 rgba(90,0,0,.3);}',
      '#home-gate-warning span{display:block;margin-top:7px;font-size:16px;font-weight:700;line-height:1.4;letter-spacing:1px;}',
      '#home-gate-content{color:#5a4a2d;font-size:15px;line-height:1.8;}',
      '#home-gate-content p{margin:0 0 8px 0;}',
      '#home-gate-content .gate-warn{color:#d93025;font-weight:700;}',
      '#home-gate-content .gate-question{margin:12px 0 8px;color:#c62828;font-size:28px;font-weight:800;line-height:1.35;text-align:center;}',
      '#home-gate-content .gate-oath{margin:12px 0 8px;color:#c62828;font-size:25px;font-weight:800;line-height:1.5;text-align:center;}',
      '#home-gate-confirm{margin-top:12px;width:100%;height:42px;border:0;border-radius:10px;background:#e8ae4a;color:#fff;font-size:15px;font-weight:700;cursor:pointer;}',
      '#home-gate-confirm:active{transform:translateY(1px);}',
      '@media (max-width:420px){#home-gate-card{padding:0 14px 18px;}#home-gate-warning{margin-right:-14px;margin-left:-14px;padding:16px 14px 14px;}#home-gate-warning strong{font-size:25px;letter-spacing:1px;}#home-gate-warning span{font-size:14px;letter-spacing:0;}#home-gate-content .gate-question{font-size:24px;}#home-gate-content .gate-oath{font-size:22px;}}'
    ].join('');

    document.head.appendChild(style);
    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';

    btn.addEventListener('click', function () {
      if (step === 1) {
        step = 2;
        content.innerHTML = '<p class="gate-question">你真的知晓了？</p>';
        btn.textContent = '真的';
        return;
      }

      if (step === 2) {
        step = 3;
        content.innerHTML = '<p class="gate-oath">你保证不传播！<br>你发誓！</p>';
        btn.textContent = '我保证我发誓';
        return;
      }

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
