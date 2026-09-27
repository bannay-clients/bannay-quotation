(() => {
  'use strict';

  const STORAGE_KEY = 'bannay-quotation-draft-v1';
  const fieldIds = ['quoteNumber', 'issueDate', 'quoteTitle', 'projectName', 'clientName', 'contactName', 'scopeNotes', 'terms', 'taxNote', 'coordinator', 'phone'];
  const form = document.getElementById('quoteForm');
  const rows = document.getElementById('serviceRows');
  const status = document.getElementById('saveStatus');
  const authPanel = document.getElementById('authPanel');
  const authToggle = document.getElementById('authToggle');
  const printButton = document.getElementById('printQuote');
  const supabase = window.supabase?.createClient(
    'https://pufuhhqfbqqzskancrrp.supabase.co',
    'sb_publishable_zVYTPXVsNWyqE8zfO8CYig_Vn2ZQfc6'
  );
  const money = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 0 });
  let services = [];
  let saveTimer;
  let requestId = crypto.randomUUID();
  let issuedQuoteId = '';
  let signedInUser = null;

  function localDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function makeDefaults() {
    const now = new Date();
    return {
      quoteNumber: '', issueDate: localDate(now), requestId: crypto.randomUUID(), issuedQuoteId: '',
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
      if (!draft.issuedQuoteId) draft.quoteNumber = '';
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
    draft.requestId = requestId;
    draft.issuedQuoteId = issuedQuoteId;
    return draft;
  }

  function persistDraft() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(readDraft()));
      status.textContent = 'حُفظت المسودة على هذا الجهاز';
    } catch {
      status.textContent = 'تعذّر حفظ المسودة على هذا الجهاز';
    }
  }

  function saveDraft() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(persistDraft, 250);
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
    setText('viewNumber', data.quoteNumber, 'مسودة');
    setText('viewIssueDate', displayDate(data.issueDate));
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
    return true;
  }

  function loadDraft(data) {
    for (const id of fieldIds) document.getElementById(id).value = data[id] || '';
    requestId = data.requestId || crypto.randomUUID();
    issuedQuoteId = data.issuedQuoteId || '';
    services = data.services;
    renderRows(); renderPreview();
    applyIssuedState();
  }

  function applyIssuedState() {
    const issued = Boolean(issuedQuoteId);
    for (const element of form.querySelectorAll('input:not(#quoteNumber), textarea')) element.disabled = issued;
    for (const button of rows.querySelectorAll('button')) button.disabled = issued;
    document.getElementById('addService').disabled = issued;
    printButton.textContent = issued ? 'إعادة تصدير PDF' : 'إصدار وتصدير PDF';
    if (issued) status.textContent = `اعتمد العرض ${document.getElementById('quoteNumber').value}`;
  }

  async function refreshAuth() {
    if (!supabase) {
      authToggle.textContent = 'تعذّر تحميل تسجيل الدخول';
      authToggle.disabled = true;
      return;
    }
    const { data, error } = await supabase.auth.getUser();
    signedInUser = error ? null : data.user;
    authToggle.textContent = signedInUser ? 'تسجيل الخروج' : 'تسجيل الدخول';
    if (signedInUser) {
      authPanel.hidden = true;
      document.getElementById('authStatus').textContent = '';
    }
  }

  function openAuthPanel() {
    authPanel.hidden = false;
    document.getElementById('signInGoogle').focus();
  }

  function printIssuedQuote() {
    const number = document.getElementById('quoteNumber').value.trim();
    document.title = `عرض سعر ${number} - Bannay Solutions Establishment`;
    window.print();
  }

  form.addEventListener('input', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      event.target.removeAttribute('aria-invalid');
    }
    renderPreview(); saveDraft();
  });
  document.getElementById('addService').addEventListener('click', () => {
    services.push({ id: crypto.randomUUID(), name: '', performer: '', duration: '', quantity: 1, price: '' });
    renderRows(); renderPreview(); saveDraft();
    rows.lastElementChild?.querySelector('input')?.focus();
  });
  authToggle.addEventListener('click', async () => {
    if (signedInUser && supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) status.textContent = 'تعذّر تسجيل الخروج؛ حاول مرة أخرى';
      await refreshAuth();
    } else {
      authPanel.hidden ? openAuthPanel() : (authPanel.hidden = true);
    }
  });
  document.getElementById('signInGoogle').addEventListener('click', async () => {
    if (!supabase) {
      document.getElementById('authStatus').textContent = 'تعذّر تحميل تسجيل الدخول. أعد تحميل الصفحة.';
      return;
    }
    const signInButton = document.getElementById('signInGoogle');
    signInButton.disabled = true;
    document.getElementById('authStatus').textContent = 'جارٍ الانتقال إلى Google…';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://bannay-clients.github.io/bannay-quotation/' }
    });
    if (error) {
      signInButton.disabled = false;
      document.getElementById('authStatus').textContent = 'تعذّر بدء الدخول عبر Google. حاول مرة أخرى.';
    }
  });
  printButton.addEventListener('click', async () => {
    if (issuedQuoteId) {
      printIssuedQuote();
      return;
    }
    if (!validate()) return;
    clearTimeout(saveTimer);
    persistDraft();
    if (!supabase) {
      status.textContent = 'تعذّر تحميل خدمة الترقيم؛ أعد تحميل الصفحة.';
      return;
    }
    const { data: authData, error: authError } = await supabase.auth.getUser();
    signedInUser = authError ? null : authData.user;
    if (!signedInUser) {
      status.textContent = 'سجّل الدخول أولًا لإصدار رقم العرض.';
      openAuthPanel();
      return;
    }
    printButton.disabled = true;
    status.textContent = 'جارٍ اعتماد رقم العرض…';
    const draft = readDraft();
    const { data, error } = await supabase.rpc('issue_quotation', {
      p_request_id: requestId,
      p_issue_date: draft.issueDate,
      p_snapshot: draft
    });
    printButton.disabled = false;
    if (error || !data?.[0]) {
      status.textContent = error?.code === '42501'
        ? 'حسابك غير مخوّل لإصدار العروض.'
        : 'تعذّر اعتماد العرض. حاول مرة أخرى؛ لن يُستهلك رقم إضافي عند إعادة المحاولة.';
      return;
    }
    issuedQuoteId = data[0].quotation_id;
    document.getElementById('quoteNumber').value = data[0].quotation_number;
    renderPreview();
    applyIssuedState();
    persistDraft();
    status.textContent = `اعتمد العرض ${data[0].quotation_number}`;
    printIssuedQuote();
  });
  document.getElementById('newQuote').addEventListener('click', () => {
    if (!window.confirm('إنشاء عرض جديد سيستبدل المسودة المحفوظة على هذا الجهاز. هل تريد المتابعة؟')) return;
    const fresh = makeDefaults();
    loadDraft(fresh);
    persistDraft();
    document.getElementById('clientName').focus();
  });

  loadDraft(getDraft());
  refreshAuth();
})();
