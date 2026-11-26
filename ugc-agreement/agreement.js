'use strict';

const form = document.querySelector('#agreement-form');
const clips = document.querySelector('#clips');
const clipTemplate = document.querySelector('#clip-editor');
const title = document.title;
const numbers = new Intl.NumberFormat('ar-SA', { maximumFractionDigits: 2 });
const demo = location.hash === '#example';

function value(container, name) {
  return container.querySelector('[name="' + name + '"]').value.trim();
}

function node(tag, text) {
  const element = document.createElement(tag);
  element.textContent = text;
  return element;
}

function setText(id, text) {
  document.getElementById(id).textContent = text;
}

function dateLabel(date) {
  if (!date) return '—';
  const [year, month, day] = date.split('-');
  return day + '/' + month + '/' + year + ' م';
}

function fact(list, label, content) {
  const group = node('div', '');
  const detail = node('dd', '');
  detail.dir = 'auto';
  detail.append(content || '—');
  group.append(node('dt', label), detail);
  list.append(group);
}

function briefLink(raw) {
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null;
    const link = node('a', raw);
    link.dir = 'ltr';
    link.href = url.href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    return link;
  } catch {
    return null;
  }
}

function render() {
  for (const name of ['creator', 'brand', 'payment']) setText('out-' + name, value(form, name) || '—');
  setText('out-representative', value(form, 'representative'));
  setText('signature-creator', value(form, 'creator'));
  const fee = value(form, 'fee');
  setText('out-fee', fee ? numbers.format(Number(fee)) + ' ريال سعودي' : '—');

  const summaries = document.querySelector('#out-clips');
  summaries.replaceChildren();
  setText('count', numbers.format(clips.children.length));
  setText('out-count', clips.children.length ? numbers.format(clips.children.length) : '—');
  if (!clips.children.length) summaries.append(node('p', '—'));

  [...clips.children].forEach((clip, index) => {
    const name = 'المقطع ' + numbers.format(index + 1);
    clip.querySelector('h3').textContent = name;
    clip.querySelector('.remove').setAttribute('aria-label', 'حذف ' + name);
    const publish = value(clip, 'publish');
    clip.querySelector('.publication').hidden = publish !== 'yes';
    for (const field of clip.querySelectorAll('.publication input')) {
      field.disabled = publish !== 'yes';
      field.required = publish === 'yes';
    }
    const brief = clip.querySelector('[name=brief]');
    const link = briefLink(brief.value.trim());
    brief.setCustomValidity(brief.value.trim() && !link ? 'أدخل رابطًا يبدأ بـ https:// أو http://.' : '');

    const card = node('section', '');
    card.className = 'clip-summary';
    const list = node('dl', '');
    list.className = 'facts';
    fact(list, 'الفكرة الأساسية', value(clip, 'idea'));
    fact(list, 'النقاط الإلزامية', value(clip, 'points'));
    const date = node('bdi', dateLabel(value(clip, 'due')));
    date.dir = 'ltr';
    fact(list, 'موعد التسليم', date);
    fact(list, 'النشر', publish === 'yes' ? 'النشر مطلوب' : publish === 'no' ? 'التسليم فقط' : '');
    if (publish === 'yes') {
      fact(list, 'منصة النشر', value(clip, 'platform'));
    }
    if (link) fact(list, 'البريف أو السكربت', link);
    card.append(node('h4', name), list);
    summaries.append(card);
  });
}

function addClip(data) {
  const clip = clipTemplate.content.firstElementChild.cloneNode(true);
  for (const [name, input] of Object.entries(data || {})) {
    clip.querySelector('[name="' + name + '"]').value = input;
  }
  clips.append(clip);
  return clip;
}

const addButton = document.querySelector('#add');
addButton.addEventListener('click', () => {
  const clip = addClip();
  setText('status', '');
  render();
  clip.querySelector('textarea').focus();
});
clips.addEventListener('click', event => {
  const remove = event.target.closest('.remove');
  if (!remove) return;
  const clip = remove.closest('.clip');
  const adjacent = clip.nextElementSibling || clip.previousElementSibling;
  clip.remove();
  render();
  (adjacent?.querySelector('.remove') || addButton).focus();
});
form.addEventListener('input', render);
form.addEventListener('change', render);
form.addEventListener('submit', async event => {
  event.preventDefault();
  if (!clips.children.length) {
    setText('status', 'أضف مقطعًا واحدًا على الأقل قبل التصدير.');
    addButton.focus();
    return;
  }
  for (const field of form.querySelectorAll('input[required], textarea[required]')) {
    if (!field.value.trim()) {
      setText('status', 'أكمل الحقول المطلوبة قبل التصدير.');
      field.focus();
      return;
    }
  }
  setText('status', '');
  await document.fonts.ready;
  const name = value(form, 'creator').replace(/[<>:"/\\|?*]/g, ' ').replace(/\s+/g, ' ').replace(/[. ]+$/, '');
  document.title = (demo ? 'مثال تجريبي - ' : '') + 'اتفاق محتوى UGC - ' + name;
  window.print();
});
window.addEventListener('afterprint', () => { document.title = title; });
render();

if (demo) {
  document.querySelector('#example-note').hidden = false;
  document.querySelector('#sample-stamp').hidden = false;
  const script = document.createElement('script');
  script.src = 'example-data.js';
  document.head.append(script);
}
