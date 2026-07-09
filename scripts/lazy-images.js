const { parseDocument } = require('htmlparser2');
const render = require('dom-serializer').default || require('dom-serializer');

const CONTENT_CLASS_NAMES = new Set([
  'post-content',
  'fiction-summary',
  'fiction-notes-before',
  'fiction-notes-after'
]);

function isElement(node, tagName) {
  return Boolean(node && node.type === 'tag' && (!tagName || node.name === tagName));
}

function hasClass(node, className) {
  if (!isElement(node) || !node.attribs || !node.attribs.class) return false;

  return node.attribs.class.split(/\s+/).includes(className);
}

function walkNodes(nodes, visitor) {
  if (!Array.isArray(nodes)) return;

  nodes.forEach((node) => {
    visitor(node);

    if (Array.isArray(node.children) && node.children.length) {
      walkNodes(node.children, visitor);
    }
  });
}

function updateContentImages(container) {
  let imageIndex = 0;

  walkNodes(container.children, (node) => {
    if (!isElement(node, 'img')) return;

    if (!node.attribs) node.attribs = {};

    if (!node.attribs.decoding) {
      node.attribs.decoding = 'async';
    }

    if (imageIndex > 0 && !node.attribs.loading) {
      node.attribs.loading = 'lazy';
    }

    imageIndex += 1;
  });
}

function applyLazyImages(html) {
  if (!html || typeof html !== 'string' || html.indexOf('<img') === -1) return html;

  const document = parseDocument(html, {
    decodeEntities: false,
    recognizeSelfClosing: true
  });

  walkNodes(document.children, (node) => {
    if (!isElement(node)) return;

    for (const className of CONTENT_CLASS_NAMES) {
      if (hasClass(node, className)) {
        updateContentImages(node);
        break;
      }
    }
  });

  return render(document, { encodeEntities: false });
}

hexo.extend.filter.register('after_render:html', function(str) {
  return applyLazyImages(str);
}, 5);
