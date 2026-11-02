const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const test = require('node:test');
const vm = require('node:vm');

const source = readFileSync(`${__dirname}/../src/content.js`, 'utf8');

function setup() {
  let observeMutations;
  const context = vm.createContext({
    window: { location: { hostname: 'example.com' } },
    chrome: {
      storage: { sync: { get() {} } },
      runtime: { onMessage: { addListener() {} } },
    },
    Node: { ELEMENT_NODE: 1, TEXT_NODE: 3 },
    MutationObserver: class {
      constructor(callback) { observeMutations = callback; }
      observe() {}
    },
    document: {
      documentElement: {},
      createTextNode: text => ({ textContent: text }),
      createElement: () => ({ className: '', textContent: '' }),
      createDocumentFragment: () => ({
        children: [],
        appendChild(node) { this.children.push(node); },
      }),
    },
  });
  vm.runInContext(source, context);
  vm.runInContext('emojiProcessingEnabled = true', context);
  return { wrap: context.wrapEmojisInTextNode, observeMutations };
}

function textNode(text, { connected = true, tag = 'DIV', wrapped = false } = {}) {
  const parent = {
    tagName: tag,
    classList: { contains: name => wrapped && name === 'darkify-emoji' },
    replacements: [],
    replaceChild(fragment, original) {
      assert.equal(original.parentNode, this);
      this.replacements.push(fragment.children);
      original.parentNode = null;
      original.parentElement = null;
      original.isConnected = false;
    },
  };
  return {
    nodeType: 3,
    textContent: text,
    parentNode: parent,
    parentElement: parent,
    isConnected: connected,
  };
}

test('duplicate mutation records do not replace an already removed text node', () => {
  const { observeMutations } = setup();
  const node = textNode('⭐ Home');
  const parent = node.parentNode;
  assert.doesNotThrow(() => observeMutations([
    { addedNodes: [node] },
    { addedNodes: [node] },
  ]));
  assert.equal(parent.replacements.length, 1);
  const replacement = parent.replacements[0];
  assert.equal(replacement.map(node => node.textContent).join(''), '⭐ Home');
  assert.equal(replacement[0].className, 'darkify-emoji');
});

test('text removed before observer delivery is ignored', () => {
  const { wrap } = setup();
  const node = textNode('⭐ Home', { connected: false });
  node.parentNode = null;
  node.parentElement = null;
  assert.doesNotThrow(() => wrap(node));
});

test('text in a detached subtree is ignored even if it still has a parent', () => {
  const { wrap } = setup();
  const node = textNode('⭐ Home', { connected: false });
  const parent = node.parentNode;
  wrap(node);
  assert.equal(parent.replacements.length, 0);
});

test('native textarea values and existing emoji wrappers are left intact', () => {
  const { wrap } = setup();
  for (const options of [{ tag: 'TEXTAREA' }, { wrapped: true }]) {
    const skipped = textNode('⭐', options);
    const parent = skipped.parentNode;
    wrap(skipped);
    assert.equal(parent.replacements.length, 0);
    const next = textNode('⭐');
    const nextParent = next.parentNode;
    wrap(next);
    assert.equal(nextParent.replacements.length, 1);
  }
});
