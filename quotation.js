(() => {
  'use strict';

  const STORAGE_KEY = 'bannay-quotation-draft-v1';
  const fieldIds = ['quoteNumber', 'issueDate', 'quoteTitle', 'projectName', 'clientName', 'contactName', 'scopeNotes', 'taxNote', 'coordinator', 'phone', 'approvalRepresentative', 'approvalDate'];
  const form = document.getElementById('quoteForm');
  const rows = document.getElementById('serviceRows');
  const termRows = document.getElementById('termRows');
  const addTerm = document.getElementById('addTerm');
  const approvalToggle = document.getElementById('showApproval');
  const status = document.getElementById('saveStatus');
  const suggestionsStatus = document.getElementById('suggestionsStatus');
  const authToggle = document.getElementById('authToggle');
  const printButton = document.getElementById('printQuote');
  const paper = document.getElementById('quotePaper');
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
  let serviceSuggestions = [];

  function localDate(date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  }

  function makeDefaults() {
    const now = new Date();
    return {
      quoteNumber: '', issueDate: localDate(now), requestId: crypto.randomUUID(), issuedQuoteId: '',
      quoteTitle: '', projectName: '', clientName: '', contactName: '', scopeNotes: '', terms: '', termItems: [],
      taxNote: 'المؤسسة غير مسجلة حاليًا في ضريبة القيمة المضافة، لذلك لا تُضاف الضريبة إلى هذا العرض.',
      showApproval: false, approvalRepresentative: '', approvalDate: '',
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
      draft.termItems = Array.isArray(saved.termItems)
        ? saved.termItems.filter(item => typeof item === 'string')
        : String(saved.terms || '').split(/\r?\n/).filter(item => item.trim());
      draft.taxNote = String(draft.taxNote ?? '').replaceAll('نظام ضريبة القيمة المضافة', 'ضريبة القيمة المضافة');
      draft.services = Array.isArray(saved.services) && saved.services.length
        ? saved.services.map(item => ({ id: item.id || crypto.randomUUID(), name: String(item.name || ''), performer: String(item.performer || ''), duration: String(item.duration || ''), quantity: item.quantity === '' ? '' : Number(item.quantity) || 1, price: item.price === 0 ? '0' : String(item.price || '') }))
        : makeDefaults().services;
      return draft;
    } catch {
      return makeDefaults();
    }
  }

  function readDraft() {
    const draft = {};
    for (const id of fieldIds) draft[id] = document.getElementById(id).value.trim();
    draft.termItems = Array.from(termRows.querySelectorAll('textarea'), input => input.value.trim()).filter(Boolean);
    draft.terms = draft.termItems.join('\n');
    draft.showApproval = approvalToggle.checked;
    draft.services = services.map(({ id, name, performer, duration, quantity, price }) => ({
      id, name: name.trim(), performer: performer.trim(), duration: duration.trim(), quantity, price
    }));
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

  function setText(id, value) {
    document.getElementById(id).textContent = value;
  }

  function showIf(id, value) {
    document.getElementById(id).hidden = !value;
  }

  function displayDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return '';
    const [year, month, day] = value.split('-');
    return `${day}/${month}/${year}`;
  }

  function makeElement(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function hasLineTotal(service) {
    return service.quantity !== '' && service.price !== '';
  }

  function amountNumber(value) {
    const number = makeElement('bdi', 'paper-amount__number', money.format(Number(value) || 0));
    number.dir = 'ltr';
    return number;
  }

  function renderServices(data) {
    const visibleServices = data.services.filter(service =>
      service.name || service.performer || service.duration || service.price !== '' ||
      (service.quantity !== '' && Number(service.quantity) !== 1)
    );
    const columns = [
      { key: 'name', label: 'الخدمة', visible: visibleServices.some(service => service.name || service.performer) },
      { key: 'duration', label: 'المدة', visible: visibleServices.some(service => service.duration) },
      { key: 'quantity', label: 'العدد', visible: visibleServices.some(service => service.quantity !== '') },
      { key: 'price', label: 'سعر الوحدة (ر.س)', visible: visibleServices.some(service => service.price !== '') }
    ].filter(column => column.visible);
    const head = document.getElementById('viewServiceHead');
    const body = document.getElementById('viewServices');
    head.replaceChildren();
    body.replaceChildren();
    for (const column of columns) {
      const header = makeElement('th', '', column.label);
      header.scope = 'col';
      header.dataset.column = column.key;
      head.appendChild(header);
    }

    let total = 0;
    for (const service of visibleServices) {
      const lineTotal = (Number(service.quantity) || 0) * (Number(service.price) || 0);
      total += lineTotal;
      const row = makeElement('tr');
      for (const { key } of columns) {
        const cell = makeElement('td');
        cell.dataset.column = key;
        if (key === 'name') {
          if (service.name) cell.appendChild(makeElement('span', 'paper-service-name', service.name));
          if (service.performer) cell.appendChild(makeElement('span', 'paper-service-detail', `المنفذ: ${service.performer}`));
        } else if (key === 'price') {
          if (service.price !== '') cell.appendChild(amountNumber(service.price));
        } else {
          cell.textContent = service[key];
        }
        row.appendChild(cell);
      }
      body.appendChild(row);
    }
    const hasTotal = visibleServices.some(hasLineTotal);
    showIf('viewServicesTable', columns.length);
    showIf('paperServicesTitle', columns.length);
    showIf('viewTotalBlock', hasTotal);
    showIf('viewServicesSection', columns.length || data.taxNote);
    showIf('viewTaxNote', data.taxNote);
    setText('viewTaxNote', data.taxNote);
    const totalValue = document.getElementById('viewTotal');
    totalValue.replaceChildren();
    if (hasTotal) totalValue.append(amountNumber(total), ' ريال سعودي');
  }

  function renderPreview() {
    const data = readDraft();
    const issueDate = displayDate(data.issueDate);
    showIf('viewNumberBlock', data.quoteNumber);
    showIf('viewDraftStatus', !issuedQuoteId);
    showIf('viewIssueDateBlock', issueDate);
    showIf('viewMeta', data.quoteNumber || issueDate || !issuedQuoteId);
    setText('viewNumber', data.quoteNumber);
    setText('viewIssueDate', issueDate);

    showIf('viewClientSection', data.clientName || data.contactName || data.quoteTitle || data.projectName);
    showIf('viewClientLabel', data.clientName);
    showIf('viewClient', data.clientName);
    showIf('viewContact', data.contactName);
    showIf('viewTitleBlock', data.quoteTitle);
    showIf('viewProjectBlock', data.projectName);
    setText('viewClient', data.clientName);
    setText('viewContact', data.contactName ? `عناية: ${data.contactName}` : '');
    setText('viewTitle', data.quoteTitle);
    setText('viewProject', data.projectName);

    renderServices(data);
    showIf('viewNotesSection', data.scopeNotes);
    setText('viewNotes', data.scopeNotes);
    showIf('viewTermsSection', data.termItems.length);
    document.getElementById('viewTerms').replaceChildren(...data.termItems.map(item => {
      const text = makeElement('span', '', item);
      text.dir = 'auto';
      const line = makeElement('li');
      line.appendChild(text);
      return line;
    }));

    showIf('approvalFields', data.showApproval);
    showIf('viewApproval', data.showApproval);
    setText('viewApprovalRepresentative', data.approvalRepresentative);
    setText('viewApprovalDate', displayDate(data.approvalDate));
    setText('viewCoordinator', data.coordinator);
    setText('viewPhone', data.phone);
    showIf('viewCoordinator', data.coordinator);
    showIf('viewPhone', data.phone);
    showIf('viewFooter', data.coordinator || data.phone);
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
    if (options.inputMode) input.inputMode = options.inputMode;
    label.appendChild(input);
    return label;
  }

  function renderSuggestionChoices(service, input, menu) {
    const query = input.value.trim().toLocaleLowerCase('ar');
    const matches = serviceSuggestions.filter(item => item.name.toLocaleLowerCase('ar').includes(query));
    menu.replaceChildren();
    for (const suggestion of matches) {
      const item = makeElement('div', 'service-suggestion');
      const choice = makeElement('button', 'service-suggestion__choice', suggestion.name);
      choice.type = 'button';
      choice.dir = 'auto';
      choice.addEventListener('click', () => {
        input.value = suggestion.name;
        service.name = suggestion.name;
        menu.hidden = true;
        renderPreview();
        saveDraft();
        input.closest('.service-row')?.querySelector('[data-key="duration"]')?.focus();
      });
      const remove = makeElement('button', 'service-suggestion__remove', '×');
      remove.type = 'button';
      remove.setAttribute('aria-label', `حذف اقتراح ${suggestion.name}`);
      remove.addEventListener('click', async () => {
        remove.disabled = true;
        const { data, error } = await supabase.from('quotation_service_suggestions')
          .delete().eq('id', suggestion.id).select('id');
        if (error || !data?.length) {
          remove.disabled = false;
          suggestionsStatus.textContent = 'تعذّر حذف الاقتراح. حاول مرة أخرى.';
          return;
        }
        serviceSuggestions = serviceSuggestions.filter(item => item.id !== suggestion.id);
        suggestionsStatus.textContent = `حُذف اقتراح ${suggestion.name}`;
        input.focus();
        renderSuggestionChoices(service, input, menu);
      });
      item.append(choice, remove);
      menu.appendChild(item);
    }
    menu.hidden = matches.length === 0;
  }

  function makeServiceNameField(service) {
    const field = makeElement('div', 'field service-name-field');
    const id = `service-name-${service.id}`;
    const label = makeElement('label', '', 'وصف الخدمة');
    label.htmlFor = id;
    const input = document.createElement('input');
    input.id = id;
    input.type = 'text';
    input.value = service.name;
    input.dataset.key = 'name';
    input.className = 'service-name-input';
    input.maxLength = 150;
    input.autocomplete = 'off';
    input.placeholder = 'مثال: تصوير وتغطية حدث';
    const menu = makeElement('div', 'service-suggestions');
    menu.setAttribute('role', 'group');
    menu.setAttribute('aria-label', 'اقتراحات وصف الخدمة');
    menu.hidden = true;
    input.addEventListener('focus', () => renderSuggestionChoices(service, input, menu));
    input.addEventListener('input', () => renderSuggestionChoices(service, input, menu));
    field.addEventListener('focusout', event => {
      if (!field.contains(event.relatedTarget)) menu.hidden = true;
    });
    field.append(label, input, menu);
    return field;
  }

  async function loadServiceSuggestions() {
    if (!supabase || !signedInUser) {
      serviceSuggestions = [];
      suggestionsStatus.textContent = '';
      return;
    }
    const userId = signedInUser.id;
    const loaded = [];
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase.from('quotation_service_suggestions')
        .select('id,name').order('last_used_at', { ascending: false })
        .order('id', { ascending: true }).range(from, from + pageSize - 1);
      if (signedInUser?.id !== userId) return;
      if (error) {
        serviceSuggestions = [];
        suggestionsStatus.textContent = 'تعذّر تحميل اقتراحات الخدمات. أعد تحميل الصفحة.';
        return;
      }
      loaded.push(...(data || []));
      if (!data || data.length < pageSize) break;
    }
    serviceSuggestions = loaded;
    suggestionsStatus.textContent = '';
    const focused = rows.querySelector('.service-name-input:focus');
    if (focused) renderSuggestionChoices(
      services.find(service => `service-name-${service.id}` === focused.id),
      focused,
      focused.parentElement.querySelector('.service-suggestions')
    );
  }

  function numberTermRows() {
    Array.from(termRows.children).forEach((row, index) => {
      row.querySelector('label span').textContent = `البند ${index + 1}`;
      row.querySelector('button').setAttribute('aria-label', `حذف البند ${index + 1}`);
    });
  }

  function appendTermRow(value = '') {
    const row = makeElement('div', 'term-row');
    const label = makeElement('label', 'field');
    const field = document.createElement('textarea');
    field.rows = 2;
    field.value = value;
    field.placeholder = 'اكتب شرطًا واحدًا';
    label.append(makeElement('span'), field);
    const remove = makeElement('button', 'icon-button', 'حذف');
    remove.type = 'button';
    remove.addEventListener('click', () => {
      const adjacent = row.nextElementSibling || row.previousElementSibling;
      row.remove();
      numberTermRows();
      (adjacent?.querySelector('textarea') || addTerm).focus();
      renderPreview();
      saveDraft();
    });
    row.append(label, remove);
    termRows.appendChild(row);
    return field;
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
      fields.appendChild(makeServiceNameField(service));
      fields.appendChild(makeField('المدة', 'duration', service.duration, { placeholder: 'مثال: ٤ ساعات' }));
      fields.appendChild(makeField('العدد', 'quantity', service.quantity, { type: 'number', min: 1, step: 1, inputMode: 'numeric' }));
      fields.appendChild(makeField('سعر الشخص', 'price', service.price, { type: 'number', min: 0, step: 0.01, inputMode: 'decimal' }));
      card.appendChild(fields);
      const extra = makeElement('div', 'service-row__extra');
      extra.appendChild(makeField('اسم المنفذ أو المودل (اختياري)', 'performer', service.performer));
      card.appendChild(extra);
      const subtotal = makeElement('div', 'service-row__subtotal');
      const updateSubtotal = () => {
        subtotal.hidden = !hasLineTotal(service);
        subtotal.replaceChildren();
        if (!subtotal.hidden) subtotal.append(amountNumber(Number(service.quantity) * Number(service.price)), ' ريال');
      };
      updateSubtotal();
      card.appendChild(subtotal);
      card.addEventListener('input', event => {
        const input = event.target;
        if (!(input instanceof HTMLInputElement) || !input.dataset.key) return;
        service[input.dataset.key] = input.value;
        input.removeAttribute('aria-invalid');
        updateSubtotal();
        renderPreview(); saveDraft();
      });
      rows.appendChild(card);
    });
  }

  function validate() {
    for (const input of form.querySelectorAll('input:not([readonly])')) {
      if (input.value && !input.checkValidity()) {
        input.setAttribute('aria-invalid', 'true');
        input.reportValidity();
        input.focus();
        status.textContent = 'تحقق من صحة القيمة التي أدخلتها.';
        return false;
      }
    }
    return true;
  }

  function loadDraft(data) {
    for (const id of fieldIds) document.getElementById(id).value = data[id] || '';
    approvalToggle.checked = data.showApproval === true;
    termRows.replaceChildren();
    for (const item of data.termItems.length ? data.termItems : ['']) appendTermRow(item);
    numberTermRows();
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
    for (const button of termRows.querySelectorAll('button')) button.disabled = issued;
    addTerm.disabled = issued;
    for (const menu of rows.querySelectorAll('.service-suggestions')) menu.hidden = true;
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
    await loadServiceSuggestions();
  }

  async function startGoogleSignIn() {
    if (!supabase) {
      status.textContent = 'تعذّر تحميل تسجيل الدخول. أعد تحميل الصفحة.';
      return;
    }
    authToggle.disabled = true;
    authToggle.textContent = 'جارٍ الانتقال إلى Google…';
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: 'https://bannay-clients.github.io/bannay-quotation/' }
    });
    if (error) {
      authToggle.disabled = false;
      authToggle.textContent = 'تسجيل الدخول';
      status.textContent = 'تعذّر بدء الدخول عبر Google. حاول مرة أخرى.';
    }
  }

  function fitPrintPage() {
    // Keep a small buffer below the full A4 height for print rounding.
    const maxHeight = 295 * 96 / 25.4;
    paper.style.removeProperty('--print-scale');
    paper.dataset.printLayout = 'standard';
    if (paper.getBoundingClientRect().height <= maxHeight) return;

    paper.dataset.printLayout = 'compact';
    const height = paper.getBoundingClientRect().height;
    if (height > maxHeight) paper.style.setProperty('--print-scale', String(maxHeight / height));
  }

  window.addEventListener('beforeprint', fitPrintPage);
  window.addEventListener('afterprint', () => {
    delete paper.dataset.printLayout;
    paper.style.removeProperty('--print-scale');
  });

  async function printIssuedQuote() {
    await Promise.allSettled([
      document.fonts.ready,
      ...Array.from(paper.querySelectorAll('img'), image => image.decode())
    ]);
    const originalTitle = document.title;
    const clientName = document.getElementById('clientName').value.trim();
    const safeClientName = clientName
      .replace(/[<>:"\/\\|?*\u0000-\u001f]/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[. ]+$/g, '')
      .trim();
    document.title = safeClientName ? `عرض سعر - ${safeClientName}` : 'عرض سعر';
    try {
      window.print();
    } finally {
      document.title = originalTitle;
    }
  }

  form.addEventListener('input', event => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      event.target.removeAttribute('aria-invalid');
    }
    renderPreview(); saveDraft();
  });
  addTerm.addEventListener('click', () => {
    const field = appendTermRow();
    numberTermRows();
    field.focus();
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
      await startGoogleSignIn();
    }
  });
  printButton.addEventListener('click', async () => {
    if (issuedQuoteId) {
      printIssuedQuote();
      return;
    }
    if (!validate()) return;
    const issueDate = document.getElementById('issueDate');
    if (!issueDate.value) issueDate.value = localDate(new Date());
    clearTimeout(saveTimer);
    persistDraft();
    if (!supabase) {
      status.textContent = 'تعذّر تحميل خدمة الترقيم؛ أعد تحميل الصفحة.';
      return;
    }
    const { data: authData, error: authError } = await supabase.auth.getUser();
    signedInUser = authError ? null : authData.user;
    if (!signedInUser) {
      status.textContent = 'سجّل الدخول عبر Google، ثم اضغط إصدار مرة أخرى.';
      await startGoogleSignIn();
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
    loadServiceSuggestions();
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
