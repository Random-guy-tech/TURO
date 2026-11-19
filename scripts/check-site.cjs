// Dependency-free source and interaction checks. This is not a browser renderer.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const content = require(path.join(root, 'content.js'));
const script = fs.readFileSync(path.join(root, 'script.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'styles.css'), 'utf8');
let passed = 0;
function check(label, run) {
  try { run(); passed++; }
  catch (error) { throw new Error(`Check failed: ${label}`, { cause: error }); }
}
function decode(value) {
  return value.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}
function parseAttributes(source) {
  const result = {};
  const pattern = /([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(pattern)) result[match[1]] = decode(match[2] ?? match[3] ?? match[4] ?? '');
  return result;
}
class FixtureElement extends EventTarget {
  constructor(tag, attributes = {}) {
    super();
    this.tag = tag;
    this.attributes = { ...attributes };
    this.dataset = {};
    this.children = [];
    this.value = '';
    this.textContent = '';
    this.hidden = 'hidden' in attributes;
    this.name = attributes.name || '';
    this.href = attributes.href || '';
    this.maxLength = Number(attributes.maxlength || -1);
    for (const [key, value] of Object.entries(attributes)) {
      if (key.startsWith('data-')) this.dataset[key.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
    }
  }
  setAttribute(key, value) { this.attributes[key] = String(value); }
  getAttribute(key) { return this.attributes[key] ?? null; }
  removeAttribute(key) { delete this.attributes[key]; if (key === 'name') this.name = ''; }
  appendChild(node) { this.children.push(node); return node; }
  focus() { this.focused = true; }
}
function load(language, store = new Map(), denyStorage = false) {
  const file = language === 'ar' ? 'ar/index.html' : 'index.html';
  const filename = path.join(root, file);
  const html = fs.readFileSync(filename, 'utf8');
  const nodes = [...html.matchAll(/<([a-z][\w:-]*)\b([^>]*?)>/gi)].map(match => new FixtureElement(match[1], parseAttributes(match[2])));
  const queryAll = selector => selector.startsWith('#')
    ? nodes.filter(node => node.attributes.id === selector.slice(1))
    : nodes.filter(node => selector.startsWith('[') && selector.endsWith(']') && selector.slice(1, -1) in node.attributes);
  const document = {
    documentElement: { lang: language },
    querySelector: selector => queryAll(selector)[0] || null,
    querySelectorAll: queryAll,
    createElement: tag => new FixtureElement(tag)
  };
  const events = [];
  const window = { TURO_CONTENT: content, dispatchEvent: event => { events.push(event.detail); return true; } };
  const sessionStorage = {
    getItem(key) { if (denyStorage) throw new Error('Storage denied'); return store.get(key) ?? null; },
    setItem(key, value) { if (denyStorage) throw new Error('Storage denied'); store.set(key, value); },
    removeItem(key) { if (denyStorage) throw new Error('Storage denied'); store.delete(key); }
  };
  vm.runInNewContext(script, { window, document, sessionStorage, CustomEvent, Event });
  return { html, filename, nodes, events, window, store, all: queryAll, get: id => document.querySelector(`#${id}`), click: node => node.dispatchEvent(new Event('click')) };
}

for (const language of ['en', 'ar']) {
  const state = load(language);
  check(`${language}: static language and direction`, () => assert(state.html.includes(`<html lang="${language}" dir="${language === 'ar' ? 'rtl' : 'ltr'}">`)));
  check(`${language}: unique IDs`, () => {
    const ids = state.nodes.filter(node => node.attributes.id).map(node => node.attributes.id);
    assert.equal(new Set(ids).size, ids.length);
  });
  check(`${language}: complete static content`, () => {
    assert(!state.html.includes('{{'));
    assert.equal(state.all('[data-category]').length, content.categories.length);
    assert.equal((state.html.match(/<details>/g) || []).length, 6);
    for (const category of content.categories) assert(state.html.includes(category[language].replace(/&/g, '&amp;')));
  });
  check(`${language}: every local asset and language link exists`, () => {
    for (const node of state.nodes) for (const attribute of ['href', 'src']) {
      const value = node.attributes[attribute];
      if (!value || value.startsWith('#') || /^https?:/.test(value)) continue;
      assert(fs.existsSync(path.resolve(path.dirname(state.filename), value)), value);
    }
  });
  check(`${language}: fragment targets and accessible references exist`, () => {
    const ids = new Set(state.nodes.map(node => node.attributes.id));
    for (const node of state.nodes) {
      if (node.attributes.href?.startsWith('#')) assert(ids.has(node.attributes.href.slice(1)));
      for (const attribute of ['for', 'aria-labelledby', 'aria-describedby']) {
        if (node.attributes[attribute]) for (const id of node.attributes[attribute].split(/\s+/)) assert(ids.has(id), id);
      }
    }
  });
  check(`${language}: static Telegram links and no-script form fallback`, () => {
    for (const link of state.all('[data-telegram]')) {
      const url = new URL(link.attributes.href);
      assert.equal(url.origin + url.pathname, 'https://t.me/ibsaks');
      assert(url.searchParams.get('text').includes(content.copy[language].draftQuestion));
      assert.equal(link.attributes.target, '_blank');
      assert(link.attributes.rel.includes('noopener'));
    }
    assert.equal(state.get('inquiry-form').attributes.action, 'https://t.me/ibsaks');
    // A fresh fixture preserves the attribute separately from the script's property changes.
    assert(/<input[^>]+id="course-title"[^>]+name="text"/.test(state.html));
  });
  for (const category of content.categories) {
    const button = state.all('[data-category]').find(node => node.dataset.category === category.id);
    state.click(button);
    check(`${language}: ${category.id} inquiry`, () => {
      assert.equal(state.all('[data-category]').filter(node => node.getAttribute('aria-pressed') === 'true').length, 1);
      assert.equal(state.get('selected-name').textContent, category[language]);
      assert.equal(state.get('selected-category').hidden, false);
      for (const link of state.all('[data-telegram]')) assert(new URL(link.href).searchParams.get('text').includes(`${content.copy[language].draftCategory}: ${category[language]}`));
    });
  }
  const category = content.categories.find(item => item.id === 'ai');
  const button = state.all('[data-category]').find(node => node.dataset.category === 'ai');
  state.click(button);
  const title = 'Private title & query?x=1#fragment <script>alert(1)</script> كتاب';
  state.get('course-title').value = title;
  state.get('course-title').dispatchEvent(new Event('input'));
  check(`${language}: special characters stay inside draft text`, () => {
    for (const link of state.all('[data-telegram]')) {
      const url = new URL(link.href);
      assert.deepEqual([...url.searchParams.keys()], ['text']);
      assert(url.searchParams.get('text').includes(title));
      assert(url.searchParams.get('text').includes(category[language]));
    }
  });
  const form = state.get('inquiry-form');
  const submit = new Event('submit', { cancelable: true });
  form.dispatchEvent(submit);
  check(`${language}: composed form draft and native navigation`, () => {
    assert.equal(submit.defaultPrevented, false);
    const fields = [state.get('course-title'), ...form.children].filter(node => node.name);
    assert.equal(fields.length, 1);
    assert.equal(fields[0].name, 'text');
    assert(fields[0].value.includes(title));
    assert(fields[0].value.includes(category[language]));
    assert.equal(state.get('request-status').hidden, false);
  });
  state.click(state.all('[data-telegram]').find(node => node.dataset.placement === 'hero'));
  state.click(state.all('[data-support]')[0]);
  state.click(state.get('lang-toggle'));
  check(`${language}: event labels and no title in tracking`, () => {
    assert(state.events.some(event => event.event === 'telegram_click' && event.placement === 'hero'));
    assert(state.events.some(event => event.event === 'support_click'));
    assert(state.events.some(event => event.event === 'language_change'));
    assert(!JSON.stringify(state.window.dataLayer).includes('Private title'));
    for (const event of state.events) for (const key of Object.keys(event)) assert(['event', 'language', 'category', 'placement', 'destination_language'].includes(key));
  });
  const otherLanguage = language === 'ar' ? 'en' : 'ar';
  const restored = load(otherLanguage, state.store);
  check(`${language}: language switch preserves and clears stored draft`, () => {
    assert.equal(restored.get('course-title').value, title);
    assert.equal(restored.get('selected-name').textContent, category[otherLanguage]);
    assert.equal(state.store.has('turo-draft'), false);
  });
  state.click(state.get('clear-category'));
  check(`${language}: clear category resets drafts and returns focus`, () => {
    assert.equal(state.get('selected-category').hidden, true);
    assert.equal(state.all('[data-category]').filter(node => node.getAttribute('aria-pressed') === 'true').length, 0);
    assert(button.focused);
    for (const link of state.all('[data-telegram]')) assert(!new URL(link.href).searchParams.get('text').includes(`${content.copy[language].draftCategory}:`));
  });
  state.click(button);
  state.click(button);
  check(`${language}: repeated click toggles category off`, () => assert.equal(state.get('selected-category').hidden, true));
}
check('denied browser storage does not break initialization', () => {
  const state = load('en', new Map(), true);
  assert(state.all('[data-telegram]').every(link => link.href.startsWith('https://t.me/ibsaks?text=')));
  state.click(state.get('lang-toggle'));
});
check('translation keys match', () => assert.deepEqual(Object.keys(content.copy.en).sort(), Object.keys(content.copy.ar).sort()));
function luminance(hex) {
  const values = hex.match(/\w\w/g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return .2126 * values[0] + .7152 * values[1] + .0722 * values[2];
}
const contrast = {};
for (const [name, variable] of [['normal', '--blue'], ['hover', '--blue-hover']]) {
  const color = css.match(new RegExp(`${variable}: #([a-f0-9]{6})`))[1];
  const ratio = 1.05 / (luminance(color) + .05);
  check(`${name} CTA text contrast`, () => assert(ratio >= 4.5));
  contrast[name] = Number(ratio.toFixed(2));
}
check('social image dimensions', () => {
  const image = fs.readFileSync(path.join(root, 'assets/social-preview.png'));
  assert.equal(image.readUInt32BE(16), 1200);
  assert.equal(image.readUInt32BE(20), 630);
});
console.log(JSON.stringify({ passed, languages: ['en', 'ar'], categories: content.categories.length, contrast, scope: 'Source and DOM-fixture checks only. Device rendering and native Telegram handoff require browser testing.' }, null, 2));
