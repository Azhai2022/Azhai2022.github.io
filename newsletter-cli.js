const { createInterface } = require('node:readline/promises');
const { readFileSync } = require('node:fs');
const { stdin, stdout } = require('node:process');
const { resolve } = require('node:path');
const { sendChangesInBatches } = require('./scripts/newsletter-batches');

const apiUrl = (process.env.NEWSLETTER_API_URL || 'https://comments.azhai.space').replace(/\/+$/, '');
const siteUrl = process.env.SITE_URL || 'https://gh99.azhai.space';
const token = process.env.NEWSLETTER_ADMIN_TOKEN || '';
const mode = process.argv[2];

if (!token || token.length < 32) {
  console.error('请先设置 NEWSLETTER_ADMIN_TOKEN（至少 32 个字符）。');
  process.exit(1);
}

async function api(path, options = {}) {
  const response = await fetch(`${apiUrl}/api/newsletter/${path}`, {
    ...options,
    headers: {
      authorization: `Bearer ${token}`,
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.errmsg || `请求失败：${response.status}`);
    error.status = response.status;
    throw error;
  }
  return result;
}

function manifestSnapshot(manifest) {
  if (!Array.isArray(manifest?.posts)) {
    throw new Error('updates.json 格式无效：缺少 posts 列表。');
  }

  const posts = manifest.posts.map((post) => ({
    title: String(post.title || '').trim(),
    url: new URL(String(post.url || ''), siteUrl).pathname,
    date: new Date(post.date).toISOString(),
    update_date: post.update_date ? new Date(post.update_date).toISOString() : null,
  }));
  posts.sort((left, right) => left.url < right.url ? -1 : left.url > right.url ? 1 : 0);
  return JSON.stringify(posts);
}

function wait(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function checkNewsletterApi() {
  const response = await fetch(`${apiUrl}/api/newsletter/pending`, {
    cache: 'no-store',
    headers: { authorization: `Bearer ${token}` },
  });
  const result = await response.json().catch(() => ({}));

  if (response.status === 409 && /尚未初始化文章基线/.test(result.errmsg || '')) {
    console.log('Newsletter API 可用，首次部署会初始化文章基线。');
    return;
  }

  if (!response.ok) {
    throw new Error(`Newsletter API 预检失败：${result.errmsg || response.status}`);
  }
  if (!Array.isArray(result.data) || typeof result.fingerprint !== 'string') {
    throw new Error('Newsletter API 未返回有效的待发送清单；请先部署 Worker 并初始化数据库。');
  }
}

async function waitForPublishedManifest(localManifest) {
  const timeout = Number(process.env.NEWSLETTER_DEPLOY_WAIT_MS) || 10 * 60 * 1000;
  const interval = Number(process.env.NEWSLETTER_DEPLOY_POLL_MS) || 15 * 1000;
  const expected = manifestSnapshot(localManifest);
  const deadline = Date.now() + timeout;
  let lastError = '线上更新清单尚未同步';

  console.log('等待线上 updates.json 与本次部署内容同步…');
  while (Date.now() <= deadline) {
    try {
      const manifestUrl = new URL('/updates.json', siteUrl);
      manifestUrl.searchParams.set('_', String(Date.now()));
      const response = await fetch(manifestUrl, {
        cache: 'no-store',
        headers: { 'cache-control': 'no-cache' },
      });
      if (!response.ok) {
        lastError = `线上清单请求失败：${response.status}`;
      } else if (manifestSnapshot(await response.json()) === expected) {
        return;
      }
    } catch (error) {
      lastError = error.message;
    }

    await wait(Math.min(interval, Math.max(0, deadline - Date.now())));
  }

  throw new Error(`等待线上更新清单超时：${lastError}`);
}

function displayChanges(changes) {
  if (!Array.isArray(changes)) {
    throw new Error('Newsletter API 返回的数据格式无效；请检查 Worker 是否已部署。');
  }
  if (!changes.length) {
    console.log('没有待发送的文章更新。');
    return;
  }

  console.log(`待发送更新：${changes.length} 篇`);
  for (const change of changes) {
    const type = change.kind === 'updated' ? '章节更新' : '新文章';
    const date = (change.kind === 'updated' ? change.update_date : change.date).slice(0, 10);
    console.log(`- [${type}] ${change.title} (${date})`);
    console.log(`  ${new URL(change.url, siteUrl).toString()}`);
  }
}

async function sendChanges(changes) {
  const result = await sendChangesInBatches(changes, api);
  console.log(`已发送 ${result.sent} 封邮件，涉及 ${changes.length} 篇文章。`);
}

async function confirmSend() {
  if (process.argv.includes('--yes')) return true;
  if (!stdin.isTTY) {
    throw new Error('非交互终端不会自动发送；确认后请添加 --yes。');
  }

  const prompt = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await prompt.question('确认向订阅者发送以上更新邮件？输入 yes 继续：');
    return answer.trim().toLowerCase() === 'yes';
  } finally {
    prompt.close();
  }
}

async function main() {
  if (mode === 'preflight') {
    await checkNewsletterApi();
    console.log('Newsletter 管理令牌检查通过。');
    return;
  }

  if (mode === 'baseline') {
    const result = await api('baseline', { method: 'POST' });
    console.log(result.message);
    return;
  }

  if (mode === 'deployed') {
    const localManifest = JSON.parse(readFileSync(resolve('public/updates.json'), 'utf8'));
    await waitForPublishedManifest(localManifest);

    let pending;
    try {
      pending = await api('pending');
    } catch (error) {
      if (error.status !== 409 || !error.message.includes('尚未初始化文章基线')) throw error;
      const baseline = await api('baseline', { method: 'POST' });
      console.log(`${baseline.message} 首次部署仅登记现有文章，不发送邮件。`);
      return;
    }

    displayChanges(pending.data);
    if (!pending.data.length) return;

    await sendChanges(pending.data);
    return;
  }

  if (mode !== 'preview' && mode !== 'send') {
    throw new Error('用法：newsletter-cli.js preflight | baseline | preview | send | deployed [--yes]');
  }

  const result = await api('pending');
  displayChanges(result.data);
  if (mode === 'preview' || !result.data.length) return;

  if (!await confirmSend()) {
    console.log('已取消，没有发送邮件。');
    return;
  }

  await sendChanges(result.data);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
