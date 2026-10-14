function toIsoDate(value) {
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

hexo.extend.generator.register('newsletter-updates', function (locals) {
  const now = Date.now();
  const posts = locals.posts.toArray()
    .filter((post) => {
      const publishedAt = toIsoDate(post.date);
      return publishedAt && new Date(publishedAt).getTime() <= now;
    })
    .map((post) => ({
      title: String(post.title || '').trim(),
      url: `/${String(post.path || '').replace(/^\/+/, '')}`,
      date: toIsoDate(post.date),
      update_date: toIsoDate(post.update_date),
    }))
    .filter((post) => post.title && post.url !== '/');

  return {
    path: 'updates.json',
    data: JSON.stringify({ posts }),
  };
});
