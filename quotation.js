(() => {
  'use strict';

  const STORAGE_KEY = 'bannay-quotation-draft-v1';
  const fieldIds = ['quoteNumber', 'issueDate', 'validUntil', 'quoteTitle', 'projectName', 'clientName', 'contactName', 'scopeNotes', 'terms', 'taxNote', 'coordinator', 'phone'];
  const form = document.getElementById('quoteForm');
  const rows = document.getElementById('serviceRows');
  const status = document.getElementById('saveStatus');
  const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  let services = [];
  let saveTimer;

  function localDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function makeDefaults() {
    const now = new Date();
    const until = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14);
    const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}${String(now.getSeconds()).padStart(2, '0')}`;
    return {
      quoteNumber: `Q-${stamp}`, issueDate: localDate(now), validUntil: localDate(until),
      quoteTitle: '', projectName: '', clientName: '', contactName: '', scopeNotes: '', terms: '',
      taxNote: 'المؤسسة غير مسجلة حاليًا في ضريبة القيمة المضافة؛ لذا لا تُضاف ضريبة القيمة المضافة إلى قيمة هذا العرض.',
      coordinator: 'أنس عمر', phone: '0599599527',
      services: [{ id: crypto.randomUUID(), name: '', performer: '', duration: '', quantity: 1, price: '' }]
    };
  }

  function getDraft() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return makeDefaults();
      const saved = JSON.parse(raw);
      if (!saved || typeof saved !== 'object') return makeDefaults();
      const draft = { ...makeDefaults(), ...saved };
      draft.services = Array.isArray(saved.services) && saved.services.length
        ? saved.services.map(item => ({ id: item.id || crypto.randomUUID(), name: String(item.name || ''), performer: String(item.performer || ''), duration: String(item.duration || ''), quantity: Number(item.quantity) || 1, price: item.price === 0 ? '0' : String(item.price || '') }))
        : makeDefaults().services;
      return draft;
    } catch {
      return makeDefaults();
    }
  }

  function readDraft() {
    const draft = {};
    for (const id of fieldIds) draft[id] = document.getElementById(id).value.trim();
    draft.services = services.map(({ id, name, performer, duration, quantity, price }) => ({ id, name, performer, duration, quantity, price }));
    return draft;
  }

  function saveDraft() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(readDraft()));
        status.textContent = 'حُفظت المسودة على هذا الجهاز';
      } catch {
        status.textContent = 'تعذّر حفظ المسودة على هذا الجهاز';
      }
    }, 250);
  }

  function setText(id, value, fallback = '—') {
    document.getElementById(id).textContent = value || fallback;
  }

  function displayDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '—';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  function formatAmount(value) {
    return `${money.format(Number(value) || 0)} ريال`;
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function renderPreview() {
    const data = readDraft();
    setText('viewNumber', data.quoteNumber);
    setText('viewIssueDate', displayDate(data.issueDate));
    setText('viewValidUntil', displayDate(data.validUntil));
    setText('viewClient', data.clientName, 'اسم العميل');
    setText('viewTitle', data.quoteTitle, 'عنوان العرض');
    setText('viewCoordinator', data.coordinator, '');
    setText('viewPhone', data.phone, '');
    const contact = document.getElementById('viewContact');
    contact.hidden = !data.contactName;
    contact.textContent = data.contactName ? `عناية: ${data.contactName}` : '';
    const project = document.getElementById('viewProject');
    project.hidden = !data.projectName;
    project.textContent = data.projectName || '';

    const body = document.getElementById('viewServices');
    body.replaceChildren();
    let total = 0;
    for (const service of services) {
      const lineTotal = (Number(service.quantity) || 0) * (Number(service.price) || 0);
      total += lineTotal;
      const row = document.createElement('tr');
      const nameCell = document.createElement('td');
      nameCell.appendChild(makeElement('span', 'paper-service-name', service.name || 'اسم الخدمة'));
      if (service.performer) nameCell.appendChild(makeElement('span', 'paper-service-detail', `المنفذ: ${service.performer}`));
      row.appendChild(nameCell);
      row.appendChild(makeElement('td', '', service.duration || '—'));
      row.appendChild(makeElement('td', '', String(service.quantity || 1)));
      row.appendChild(makeElement('td', '', formatAmount(lineTotal)));
      body.appendChild(row);
    }
    setText('viewTotal', formatAmount(total));
    const taxNote = document.getElementById('viewTaxNote');
    taxNote.hidden = !data.taxNote;
    taxNote.textContent = data.taxNote;
    for (const [sectionId, targetId, value] of [
      ['viewNotesSection', 'viewNotes', data.scopeNotes],
      ['viewTermsSection', 'viewTerms', data.terms]
    ]) {
      document.getElementById(sectionId).hidden = !value;
      document.getElementById(targetId).textContent = value;
    }
  }

  function makeField(labelText, key, value, options = {}) {
    const label = makeElement('label', 'field');
    label.appendChild(makeElement('span', '', labelText));
    const input = document.createElement('input');
    input.type = options.type || 'text';
    input.value = value;
    input.dataset.key = key;
    if (options.placeholder) input.placeholder = options.placeholder;
    if (options.min !== undefined) input.min = String(options.min);
    if (options.step !== undefined) input.step = String(options.step);
    if (options.required) input.required = true;
    if (options.inputMode) input.inputMode = options.inputMode;
    label.appendChild(input);
    return label;
  }

  function renderRows() {
    rows.replaceChildren();
    services.forEach((service, index) => {
      const card = makeElement('div', 'service-row');
      card.dataset.id = service.id;
      const top = makeElement('div', 'service-row__top');
      top.appendChild(makeElement('strong', '', `الخدمة ${index + 1}`));
      const remove = makeElement('button', 'icon-button', 'حذف');
      remove.type = 'button';
      remove.setAttribute('aria-label', `حذف الخدمة ${index + 1}`);
      remove.disabled = services.length === 1;
      remove.addEventListener('click', () => {
        services = services.filter(item => item.id !== service.id);
        renderRows(); renderPreview(); saveDraft();
      });
      top.appendChild(remove);
      card.appendChild(top);
      const fields = makeElement('div', 'service-row__fields');
      fields.appendChild(makeField('وصف الخدمة *', 'name', service.name, { required: true, placeholder: 'مثال: تصوير وتغطية حدث' }));
      fields.appendChild(makeField('المدة', 'duration', service.duration, { placeholder: 'مثال: ٤ ساعات' }));
      fields.appendChild(makeField('الكمية *', 'quantity', service.quantity, { type: 'number', min: 1, step: 1, required: true, inputMode: 'numeric' }));
      fields.appendChild(makeField('سعر الوحدة *', 'price', service.price, { type: 'number', min: 0.01, step: 0.01, required: true, inputMode: 'decimal' }));
      card.appendChild(fields);
      const extra = makeElement('div', 'service-row__extra');
      extra.appendChild(makeField('اسم المنفذ أو المودل (اختياري)', 'performer', service.performer));
      card.appendChild(extra);
      const subtotal = makeElement('div', 'service-row__subtotal', formatAmount((Number(service.quantity) || 0) * (Number(service.price) || 0)));
      card.appendChild(subtotal);
      card.addEventListener('input', event => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || !input.dataset.key) return;
        service[input.dataset.key] = input.value;
        input.removeAttribute('aria-invalid');
        subtotal.textContent = formatAmount((Number(service.quantity) || 0) * (Number(service.price) || 0));
        renderPreview(); saveDraft();
      });
      rows.appendChild(card);
    });
  }

  function validate() {
    document.getElementById('validUntil').setCustomValidity('');
    const required = [...form.querySelectorAll('[required]')];
    for (const input of required) {
      if (!input.checkValidity()) {
        input.setAttribute('aria-invalid', 'true');
        input.reportValidity();
        input.focus();
        status.textContent = 'أكمل الحقول المطلوبة قبل التصدير';
        return false;
      }
    }
    const issue = document.getElementById('issueDate');
    const until = document.getElementById('validUntil');
    if (until.value < issue.value) {
      until.setCustomValidity('تاريخ الصلاحية يجب أن يساوي تاريخ الإصدار أو يأتي بعده');
      until.reportValidity();
      until.focus();
      status.textContent = 'راجع تاريخ صلاحية العرض';
      return false;
    }
    until.setCustomValidity('');
    return true;
  }

  function loadDraft(data) {
    for (const id of fieldIds) document.getElementById(id).value = data[id] || '';
    services = data.services;
    renderRows(); renderPreview();
  }

  form.addEventListener('input', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      event.target.removeAttribute('aria-invalid');
      if (event.target.id === 'validUntil') event.target.setCustomValidity('');
    }
    renderPreview(); saveDraft();
  });
  document.getElementById('addService').addEventListener('click', () => {
    services.push({ id: crypto.randomUUID(), name: '', performer: '', duration: '', quantity: 1, price: '' });
    renderRows(); renderPreview(); saveDraft();
    rows.lastElementChild?.querySelector('input')?.focus();
  });
  document.getElementById('printQuote').addEventListener('click', () => {
    if (!validate()) return;
    renderPreview();
    document.title = `عرض سعر ${document.getElementById('quoteNumber').value.trim()} - Bannay Solutions Establishment`;
    window.print();
  });
  document.getElementById('newQuote').addEventListener('click', () => {
    if (!window.confirm('إنشاء عرض جديد سيستبدل المسودة المحفوظة على هذا الجهاز. هل تريد المتابعة؟')) return;
    const fresh = makeDefaults();
    loadDraft(fresh);
    saveDraft();
    document.getElementById('clientName').focus();
  });

  loadDraft(getDraft());
})();
