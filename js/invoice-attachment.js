export function invoiceDate(quote) {
  return quote.invoice?.issueDate ? new Date(`${quote.invoice.issueDate}T12:00:00`).getTime()
    : quote.invoicedAt || quote.events?.find(event => event.status === 'delivered')?.createdAt || quote.createdAt;
}

export function createInvoiceAttachment(documentRoot, quote, { api, onSaved, onBusy = () => {} }) {
  const node = (tag, text) => {
    const element = documentRoot.createElement(tag);
    if (text !== undefined) element.textContent = text;
    return element;
  };
  const section = node('section');
  section.className = 'invoice-attachment';
  section.append(node('h3', 'Factura adjunta'));
  if (quote.invoice) {
    const link = node('a', `Descargar factura · ${quote.invoice.filename}`);
    link.href = `/api/work/quotes/${encodeURIComponent(quote.id)}/invoice`;
    link.download = quote.invoice.filename;
    section.append(link);
    return section;
  }
  const picker = node('input');
  picker.type = 'file';
  picker.accept = '.pdf,.xml,application/pdf,application/xml,text/xml';
  picker.hidden = true;
  picker.dataset.invoiceFile = '';
  const choose = node('button', 'Añadir factura');
  choose.type = 'button';
  choose.dataset.invoiceChoose = '';
  const status = node('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const form = node('form');
  form.hidden = true;
  const fields = {};
  for (const [name, labelText, type] of [['number', 'Folio de la factura', 'text'], ['issueDate', 'Fecha de emisión', 'date'], ['total', 'Monto total en pesos', 'number']]) {
    const label = node('label', labelText);
    const input = node('input');
    input.name = name;
    input.type = type;
    input.required = true;
    input.dataset.invoiceField = name;
    if (name === 'number') { input.pattern = '[1-9][0-9]{0,9}'; input.maxLength = 10; input.inputMode = 'numeric'; }
    if (name === 'total') { input.min = '0'; input.step = '1'; }
    label.append(input);
    form.append(label);
    fields[name] = input;
  }
  const confirm = node('button', quote.status === 'accepted' ? 'Confirmar factura y continuar' : 'Guardar factura');
  confirm.type = 'submit';
  confirm.dataset.invoiceConfirm = '';
  const cancel = node('button', 'Cancelar');
  cancel.type = 'button';
  form.append(confirm, cancel);
  section.append(node('p', quote.status === 'accepted'
    ? 'Adjunta la factura para continuar con este trabajo. PDF o XML, hasta 5 MB.'
    : 'Esta cotización antigua no tiene un archivo adjunto. Puedes añadirlo aquí.'), choose, picker, status, form);
  let selected = null;
  let busy = false;
  function setBusy(value) {
    busy = value;
    choose.disabled = confirm.disabled = cancel.disabled = value;
    for (const field of Object.values(fields)) field.disabled = value;
    onBusy(value);
  }
  function fileData() {
    const data = new (documentRoot.defaultView?.FormData || globalThis.FormData)();
    data.append('invoice', selected);
    return data;
  }
  async function request(suffix, body) {
    const response = await api(`/api/work/quotes/${encodeURIComponent(quote.id)}/invoice${suffix}`, { method: 'POST', credentials: 'same-origin', headers: { 'X-Invoice-Upload': '1' }, body });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo guardar la factura.');
    return result;
  }
  choose.addEventListener('click', () => { if (!busy) picker.click(); });
  cancel.addEventListener('click', () => {
    selected = null;
    picker.value = '';
    form.hidden = true;
    status.textContent = '';
    choose.focus();
  });
  picker.addEventListener('change', async () => {
    if (busy) return;
    selected = picker.files?.[0] || null;
    form.hidden = true;
    if (!selected) return;
    if (selected.size > 5 * 1024 * 1024) {
      status.textContent = 'La factura supera el límite de 5 MB.';
      selected = null;
      picker.value = '';
      return;
    }
    setBusy(true);
    status.textContent = 'Leyendo factura…';
    try {
      const preview = await request('/preview', fileData());
      for (const [name, input] of Object.entries(fields)) {
        input.value = preview.metadata?.[name] ?? (name === 'number' && /^\d+$/.test(quote.invoiceNumber || '') ? quote.invoiceNumber : '');
        input.readOnly = Boolean(preview.metadata);
      }
      status.textContent = preview.metadata
        ? `${preview.filename} · Emisor: ${preview.metadata.issuerRut} · Cliente: ${preview.metadata.receiverName} (${preview.metadata.receiverRut}). Revisa que corresponda a ${quote.code} antes de confirmar.`
        : `${preview.filename}. Completa los datos que figuran en el PDF y confirma que corresponde a ${quote.code}.`;
      form.hidden = false;
    } catch (error) {
      selected = null;
      picker.value = '';
      status.textContent = error.message || 'No se pudo leer el archivo.';
    } finally { setBusy(false); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !selected || !form.reportValidity()) return;
    const body = fileData();
    for (const [name, input] of Object.entries(fields)) body.append(name, input.value);
    setBusy(true);
    status.textContent = 'Guardando factura…';
    try {
      const updated = await request('', body);
      onSaved(updated);
    } catch (error) { status.textContent = error.message || 'No se pudo guardar la factura. Vuelve a intentarlo.'; }
    finally { setBusy(false); }
  });
  return section;
}
