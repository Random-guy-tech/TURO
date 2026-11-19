(() => {
  'use strict';
  const { copy, categories, telegramUsername } = window.TURO_CONTENT;
  const language = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  const text = copy[language];
  const form = document.querySelector('#inquiry-form');
  const courseInput = document.querySelector('#course-title');
  const categoryButtons = [...document.querySelectorAll('[data-category]')];
  const selectedRow = document.querySelector('#selected-category');
  const selectedName = document.querySelector('#selected-name');
  const clearButton = document.querySelector('#clear-category');
  const status = document.querySelector('#request-status');
  let selectedCategory = '';

  // Native form navigation preserves Enter-to-submit and new-tab behavior.
  // Without JavaScript, the visible input submits its title directly to Telegram.
  const draftField = document.createElement('input');
  draftField.type = 'hidden';
  draftField.name = 'text';
  courseInput.removeAttribute('name');
  form.appendChild(draftField);

  function getDraft(categoryId = selectedCategory) {
    const category = categories.find(item => item.id === categoryId);
    const title = courseInput.value.trim();
    const lines = [text.draftGreeting];
    if (category) lines.push(`${text.draftCategory}: ${category[language]}`);
    if (title) lines.push(`${text.draftTitle}: ${title}`);
    lines.push(text.draftQuestion);
    return lines.join('\n');
  }
  function telegramUrl() {
    return `https://t.me/${telegramUsername}?text=${encodeURIComponent(getDraft())}`;
  }
  function track(event, details = {}) {
    // Integration hooks only. No provider, network request, title or link is logged.
    const payload = { event, language, category: selectedCategory || 'unspecified', ...details };
    if (!Array.isArray(window.dataLayer)) window.dataLayer = [];
    window.dataLayer.push(payload);
    window.dispatchEvent(new CustomEvent('turo:conversion', { detail: payload }));
  }
  function updateInquiry() {
    draftField.value = getDraft();
    document.querySelectorAll('[data-telegram]').forEach(link => { link.href = telegramUrl(); });
  }
  function setCategory(categoryId, shouldTrack = true) {
    selectedCategory = categories.some(item => item.id === categoryId) ? categoryId : '';
    const category = categories.find(item => item.id === selectedCategory);
    categoryButtons.forEach(button => { button.setAttribute('aria-pressed', String(button.dataset.category === selectedCategory)); });
    selectedName.textContent = category ? category[language] : '';
    selectedRow.hidden = !category;
    status.hidden = true;
    updateInquiry();
    if (shouldTrack) track('category_select');
  }
  categoryButtons.forEach(button => {
    button.addEventListener('click', () => { setCategory(selectedCategory === button.dataset.category ? '' : button.dataset.category); });
  });
  clearButton.addEventListener('click', () => {
    const previousButton = categoryButtons.find(button => button.dataset.category === selectedCategory);
    setCategory('');
    previousButton?.focus();
  });
  courseInput.addEventListener('input', () => { status.hidden = true; updateInquiry(); });
  form.addEventListener('submit', () => {
    updateInquiry();
    track('telegram_click', { placement: 'request' });
    status.textContent = text.requestStatus;
    status.hidden = false;
  });
  document.querySelectorAll('[data-telegram]').forEach(link => {
    link.addEventListener('click', () => { updateInquiry(); track('telegram_click', { placement: link.dataset.placement }); });
  });
  document.querySelectorAll('[data-support]').forEach(link => {
    link.addEventListener('click', () => track('support_click', { placement: link.dataset.placement }));
  });
  document.querySelector('#lang-toggle').addEventListener('click', () => {
    // Preserve an unfinished request only within this tab during a language switch.
    try { sessionStorage.setItem('turo-draft', JSON.stringify({ category: selectedCategory, title: courseInput.value })); } catch {}
    track('language_change', { destination_language: language === 'ar' ? 'en' : 'ar' });
  });
  try {
    const savedDraft = JSON.parse(sessionStorage.getItem('turo-draft') || 'null');
    sessionStorage.removeItem('turo-draft');
    if (savedDraft && typeof savedDraft.title === 'string') {
      courseInput.value = savedDraft.title.slice(0, courseInput.maxLength);
      setCategory(savedDraft.category, false);
    }
  } catch {}
  updateInquiry();
})();
