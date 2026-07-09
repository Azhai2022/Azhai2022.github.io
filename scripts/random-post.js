hexo.extend.generator.register('posts_json', function (locals) {
  const posts = locals.posts.toArray().map(p => ({
    title: p.title,
    path: p.path,
    tags: p.tags.toArray().map(t => t.name)
  }));
  return {
    path: 'posts.json',
    data: JSON.stringify(posts)
  };
});
