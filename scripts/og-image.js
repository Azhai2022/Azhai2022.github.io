const { parseDocument } = require('htmlparser2');

function walk(nodes, visitor) {
  if (!Array.isArray(nodes)) return null;

  for (const node of nodes) {
    const result = visitor(node);
    if (result) return result;

    if (Array.isArray(node.children) && node.children.length) {
      const childResult = walk(node.children, visitor);
      if (childResult) return childResult;
    }
  }

  return null;
}

hexo.extend.helper.register('first_content_image', function(content) {
  if (!content || typeof content !== 'string' || !content.includes('<img')) {
    return null;
  }

  const document = parseDocument(content, {
    decodeEntities: false,
    recognizeSelfClosing: true
  });

  return walk(document.children, (node) => {
    if (node && node.type === 'tag' && node.name === 'img' && node.attribs && node.attribs.src) {
      const src = node.attribs.src.trim();
      return src && !src.startsWith('data:') ? src : null;
    }

    return null;
  });
});
