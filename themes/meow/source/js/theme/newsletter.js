(() => {
  const form = document.getElementById('newsletter-form');
  if (!form) return;

  const emailInput = form.querySelector('input[name="email"]');
  const honeypot = form.querySelector('input[name="website"]');
  const button = form.querySelector('button[type="submit"]');
  const status = document.getElementById('newsletter-status');
  const serviceError = '订阅功能发生了一些问题，请告知斋进行修复';
  const successMessage = '提交成功，请前往邮箱确认订阅';

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.reportValidity()) {
      status.textContent = '邮箱格式有误，请检查后再次提交';
      status.dataset.state = 'error';
      return;
    }

    button.disabled = true;
    status.textContent = '正在提交…';
    status.dataset.state = 'pending';

    try {
      const endpoint = new URL('/api/newsletter/subscribe', form.dataset.api);
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: emailInput.value,
          website: honeypot.value,
        }),
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(response.status >= 500 ? serviceError : (result.errmsg || serviceError));
      }
      if (typeof result.message !== 'string' || !result.message) {
        throw new Error(serviceError);
      }

      emailInput.value = '';
      honeypot.value = '';
      status.textContent = successMessage;
      status.dataset.state = 'success';
    } catch (error) {
      status.textContent = error instanceof TypeError ? serviceError : (error.message || serviceError);
      status.dataset.state = 'error';
    } finally {
      button.disabled = false;
    }
  });
})();
