/* Regenerate both static pages: node scripts/build-pages.cjs
 * Add --origin https://your-domain.example when the real hosting URL is known.
 * Viewing the generated pages needs no dependencies, server or build step.
 */
const fs = require('node:fs');
const path = require('node:path');
const content = require('../content.js');
const root = path.resolve(__dirname, '..');
const template = fs.readFileSync(path.join(root, 'templates/page.html'), 'utf8');
const configPath = path.join(root, 'site.config.json');
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};
const originIndex = process.argv.indexOf('--origin');
if (originIndex >= 0) {
  const value = process.argv[originIndex + 1];
  if (!value) throw new Error('--origin needs the real public base URL.');
  const url = new URL(value);
  if (url.protocol !== 'https:') throw new Error('The production base URL must use HTTPS.');
  url.search = '';
  url.hash = '';
  config.origin = url.href.endsWith('/') ? url.href : `${url.href}/`;
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
}
const escape = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
for (const language of ['en', 'ar']) {
  const text = content.copy[language];
  const values = {
    ...text, language,
    direction: language === 'ar' ? 'rtl' : 'ltr',
    otherLanguage: language === 'ar' ? 'en' : 'ar',
    assetPrefix: language === 'ar' ? '../' : './',
    languageHref: language === 'ar' ? '../index.html' : './ar/index.html',
    telegramUsername: content.telegramUsername,
    telegramHref: `https://t.me/${content.telegramUsername}?text=${encodeURIComponent([text.draftGreeting, text.draftQuestion].join('\n'))}`,
    footerNavigation: language === 'ar' ? 'روابط المساعدة' : 'Help and support'
  };
  const raw = {
    categories: content.categories.map(category => `        <button class="category-button" type="button" data-category="${category.id}" aria-pressed="false"><svg class="icon" aria-hidden="true"><use href="#icon-${category.icon}"/></svg><span>${escape(category[language])}</span><span class="category-check" aria-hidden="true">✓</span></button>`).join('\n'),
    productionMetadata: ''
  };
  if (config.origin) {
    const base = new URL(config.origin);
    const english = new URL('index.html', base).href;
    const arabic = new URL('ar/index.html', base).href;
    const canonical = language === 'ar' ? arabic : english;
    const image = new URL('assets/social-preview.png', base).href;
    raw.productionMetadata = [
      `  <link rel="canonical" href="${escape(canonical)}">`,
      `  <link rel="alternate" hreflang="en" href="${escape(english)}">`,
      `  <link rel="alternate" hreflang="ar" href="${escape(arabic)}">`,
      `  <link rel="alternate" hreflang="x-default" href="${escape(english)}">`,
      `  <meta property="og:url" content="${escape(canonical)}">`,
      `  <meta property="og:image" content="${escape(image)}">`,
      '  <meta property="og:image:width" content="1200">',
      '  <meta property="og:image:height" content="630">',
      `  <meta property="og:image:alt" content="${escape(language === 'ar' ? 'تورو — دورات وكتب حسب طلبك' : 'Turo — courses and books, by request')}">`,
      `  <meta name="twitter:image" content="${escape(image)}">`
    ].join('\n');
  }
  const html = template.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    if (key in raw) return raw[key];
    if (!(key in values)) throw new Error(`Missing ${language} text: ${key}`);
    return escape(values[key]);
  });
  const output = path.join(root, language === 'ar' ? 'ar/index.html' : 'index.html');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, html);
  console.log(`Generated ${path.relative(root, output)} (${language})`);
}
if (!config.origin) console.log('Production domain not set; canonical, hreflang and absolute image URLs will be added when it is supplied.');
