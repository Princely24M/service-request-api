(() => {
  'use strict';

  const configuredApiBase = document.querySelector('meta[name="api-base"]')?.content.trim();
  const localHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const API_BASE = configuredApiBase || (
    localHost && window.location.port !== '3000'
      ? `${window.location.protocol}//${window.location.hostname}:3000/api`
      : '/api'
  );

  const CATEGORIES = {
    opportunity: 'Opportunity enquiry',
    application: 'Application support',
    portal: 'Portal or account',
    other: 'Something else',
  };
  const STATUSES = { open: 'Open', in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed' };

  const state = { requests: [], filter: 'all', editingId: null, newestId: null, panel: 'new' };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- API ---------- */

  async function api(path, { method = 'GET', body } = {}) {
    const options = { method, headers: { Accept: 'application/json' } };
    if (body !== undefined) {
      options.headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(body);
    }

    let response;
    try {
      response = await fetch(API_BASE + path, options);
    } catch {
      const error = new Error('Could not reach the server. Check that it is running and try again.');
      error.network = true;
      throw error;
    }

    if (response.status === 204) return null;

    let payload = null;
    try { payload = await response.json(); } catch { /* not JSON */ }

    if (!response.ok) {
      const error = new Error(payload?.error?.message || 'Something went wrong. Try again.');
      error.status = response.status;
      error.details = payload?.error?.details || [];
      throw error;
    }
    return payload;
  }

  /* ---------- Helpers ---------- */

  const refOf = (id) => `SB-${id.slice(0, 8).toUpperCase()}`;

  function timeAgo(iso) {
    const seconds = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
    const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });
    for (const [unit, size] of [['day', 86400], ['hour', 3600], ['minute', 60]]) {
      if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
    }
    return 'just now';
  }

  function el(tag, props = {}, ...children) {
    const node = document.createElement(tag);
    for (const [key, value] of Object.entries(props)) {
      if (value === undefined || value === null) continue;
      if (key === 'class') node.className = value;
      else if (key === 'text') node.textContent = value;
      else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
      else node.setAttribute(key, value);
    }
    children.flat().forEach((child) => child && node.append(child));
    return node;
  }

  let toastTimer;
  function toast(message) {
    const node = $('#toast');
    node.textContent = message;
    node.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove('is-visible'), 3200);
  }

  /* ---------- Panels ---------- */

  const panels = {
    new: { section: $('#panel-new'), tab: $('#tab-new'), body: $('#body-new'), title: $('#new-title') },
    requests: { section: $('#panel-requests'), tab: $('#tab-requests'), body: $('#body-requests'), title: $('#requests-title') },
  };

  function openPanel(name, { focus = true, updateHash = true } = {}) {
    if (!panels[name]) return;
    state.panel = name;
    Object.entries(panels).forEach(([key, p]) => {
      const open = key === name;
      p.section.classList.toggle('is-open', open);
      p.tab.inert = open;
      p.body.inert = !open;
      if (!open) p.section.scrollTop = 0;
    });
    if (updateHash) history.replaceState(null, '', name === 'new' ? '#new' : '#requests');
    if (focus) {
      // Wait for the content to become visible before moving focus there.
      setTimeout(() => panels[name].title.focus({ preventScroll: true }), reducedMotion.matches ? 0 : 260);
    }
  }

  $$('.tab').forEach((tab) => tab.addEventListener('click', () => openPanel(tab.dataset.open)));

  /* ---------- Validation (mirrors the server rules) ---------- */

  const RULES = {
    name: ['Name', 2, 80],
    subject: ['Subject', 3, 120],
    description: ['Description', 10, 2000],
  };

  function validate(values) {
    const errors = {};
    for (const [field, [label, min, max]] of Object.entries(RULES)) {
      const value = (values[field] || '').trim();
      if (!value) errors[field] = `${label} is required.`;
      else if (value.length < min) errors[field] = `${label} must be at least ${min} characters.`;
      else if (value.length > max) errors[field] = `${label} must be ${max} characters or fewer.`;
    }
    const email = (values.email || '').trim();
    if (!email) errors.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Enter a valid email address, like name@example.com.';
    if (!CATEGORIES[values.category]) errors.category = 'Choose a topic.';
    if (values.status !== undefined && !STATUSES[values.status]) errors.status = 'Choose a status.';
    return errors;
  }

  function showErrors(form, errors) {
    let first = null;
    $$('[data-error-for]', form).forEach((node) => {
      const field = node.dataset.errorFor;
      const input = form.elements[field];
      const message = errors[field];
      node.hidden = !message;
      node.textContent = message || '';
      if (input) {
        if (message) { input.setAttribute('aria-invalid', 'true'); first = first || input; }
        else input.removeAttribute('aria-invalid');
      }
    });
    if (first) first.focus();
  }

  const readForm = (form) =>
    Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v]));

  function setLoading(button, loading, idleLabel, busyLabel) {
    button.disabled = loading;
    button.classList.toggle('is-loading', loading);
    $('.button-label', button).textContent = loading ? busyLabel : idleLabel;
  }

  function clearErrorOnInput(formNode) {
    formNode.addEventListener('input', (event) => {
      const target = event.target;
      if (target.getAttribute('aria-invalid') === 'true') {
        target.removeAttribute('aria-invalid');
        const message = $(`[data-error-for="${target.name}"]`, formNode);
        if (message) message.hidden = true;
      }
    });
  }

  /* ---------- New request (POST) ---------- */

  const form = $('#request-form');
  const success = $('#success');
  clearErrorOnInput(form);

  $('#n-description').addEventListener('input', (event) => {
    $('[data-count]').textContent = event.target.value.length;
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = $('#form-status');
    status.textContent = '';
    status.classList.remove('is-error');

    const values = readForm(form);
    const errors = validate(values);
    showErrors(form, errors);
    if (Object.keys(errors).length) {
      status.textContent = 'Fix the marked fields and try again.';
      status.classList.add('is-error');
      return;
    }

    const button = $('#submit-btn');
    setLoading(button, true, 'Send request', 'Sending…');
    try {
      const { data } = await api('/requests', { method: 'POST', body: values });
      state.requests.unshift(data);
      state.newestId = data.id;
      form.reset();
      $('[data-count]').textContent = '0';
      $('#new-title').hidden = true;
      form.hidden = true;
      $('#success-ref').textContent = refOf(data.id);
      success.hidden = false;
      success.focus({ preventScroll: true });
      renderAll();
    } catch (error) {
      if (error.details?.length) {
        showErrors(form, Object.fromEntries(error.details.map((d) => [d.field, d.message])));
      }
      status.textContent = error.message;
      status.classList.add('is-error');
    } finally {
      setLoading(button, false, 'Send request', 'Sending…');
    }
  });

  $('#another-btn').addEventListener('click', () => {
    success.hidden = true;
    form.hidden = false;
    $('#new-title').hidden = false;
    $('#form-status').textContent = '';
    $('#n-name').focus();
  });

  $('#go-requests').addEventListener('click', () => {
    openPanel('requests');
    // The new row slides in with a highlight once the panel has opened.
    const row = $(`.req[data-id="${state.newestId}"]`);
    if (row) setTimeout(() => row.scrollIntoView({ block: 'center', behavior: reducedMotion.matches ? 'auto' : 'smooth' }), 500);
  });

  /* ---------- List rendering ---------- */

  const list = $('#req-list');
  const listState = $('#list-state');

  function renderCount() {
    const open = state.requests.filter((r) => r.status === 'open').length;
    $('#tab-count').textContent = open;
    panels.requests.tab.setAttribute('aria-label', `View requests, ${open} open`);
  }

  function renderList() {
    const items = state.filter === 'all' ? state.requests : state.requests.filter((r) => r.status === state.filter);
    list.setAttribute('aria-busy', 'false');
    list.replaceChildren(...items.map(renderRow));

    $('#list-summary').textContent = `${items.length} ${items.length === 1 ? 'request' : 'requests'}`
      + (state.filter === 'all' ? '' : ` ${STATUSES[state.filter].toLowerCase()}`) + '.';

    if (!items.length) {
      if (state.requests.length) showState('Nothing here.', 'No requests have this status. Try another filter.');
      else showState('No requests yet.', 'When you send one, it appears here.');
    } else {
      listState.hidden = true;
    }
  }

  function renderRow(request) {
    const select = el(
      'select',
      { class: 'status-select', id: `status-${request.id}`, 'aria-label': `Change status of ${request.subject}` },
      Object.entries(STATUSES).map(([value, text]) => el('option', { value, text })),
    );
    select.value = request.status;
    select.addEventListener('change', () => changeStatus(request, select));

    const editButton = el('button', { class: 'link-button', type: 'button', text: 'Edit', 'aria-label': `Edit ${request.subject}` });
    editButton.addEventListener('click', () => openEdit(request));

    const deleteButton = el('button', { class: 'link-button', type: 'button', text: 'Delete', 'aria-label': `Delete ${request.subject}` });
    let confirmTimer;
    deleteButton.addEventListener('click', () => {
      if (deleteButton.classList.contains('is-confirming')) {
        clearTimeout(confirmTimer);
        removeRequest(request, deleteButton);
        return;
      }
      deleteButton.classList.add('is-confirming');
      deleteButton.textContent = 'Confirm delete';
      confirmTimer = setTimeout(() => {
        deleteButton.classList.remove('is-confirming');
        deleteButton.textContent = 'Delete';
      }, 4000);
    });

    return el(
      'li',
      { class: 'req' + (request.id === state.newestId ? ' is-new' : ''), 'data-id': request.id },
      el(
        'div',
        { class: 'req-main' },
        el('h3', { class: 'req-title', text: request.subject }),
        el('p', { class: 'req-desc', text: request.description }),
        el(
          'p',
          { class: 'req-meta' },
          el('span', { text: CATEGORIES[request.category] }),
          el('span', { text: `From ${request.name}` }),
          el('span', { text: timeAgo(request.createdAt) }),
          el('span', { class: 'ref', text: refOf(request.id) }),
        ),
      ),
      el(
        'div',
        { class: 'req-side' },
        el('span', { class: `status status-${request.status}` }, el('i', { 'aria-hidden': 'true' }), STATUSES[request.status]),
        el('div', { class: 'req-controls' }, select, editButton, deleteButton),
      ),
    );
  }

  function showState(title, message, retry) {
    listState.replaceChildren(el('h3', { text: title }), el('p', { text: message }));
    if (retry) listState.append(el('button', { class: 'button button-solid', type: 'button', text: 'Try again', onclick: loadRequests }));
    listState.hidden = false;
  }

  function renderAll() {
    renderCount();
    renderList();
  }

  /* ---------- Load (GET) ---------- */

  async function loadRequests() {
    listState.hidden = true;
    list.setAttribute('aria-busy', 'true');
    list.replaceChildren(el('li', { class: 'skeleton', 'aria-hidden': 'true' }), el('li', { class: 'skeleton', 'aria-hidden': 'true' }));
    try {
      const { data } = await api('/requests');
      state.requests = data;
      renderAll();
    } catch (error) {
      list.replaceChildren();
      list.setAttribute('aria-busy', 'false');
      $('#list-summary').textContent = '';
      $('#tab-count').textContent = '!';
      showState('Requests could not load.', error.message, true);
    }
  }

  /* ---------- Change status (PATCH) ---------- */

  async function changeStatus(request, select) {
    const previous = request.status;
    select.disabled = true;
    try {
      const { data } = await api(`/requests/${request.id}`, { method: 'PATCH', body: { status: select.value } });
      Object.assign(request, data);
      toast(`Status changed to ${STATUSES[data.status].toLowerCase()}.`);
      const focusId = select.id;
      renderAll();
      $(`#${CSS.escape(focusId)}`)?.focus({ preventScroll: true });
    } catch (error) {
      select.value = previous;
      select.disabled = false;
      toast(error.message);
    }
  }

  /* ---------- Delete (DELETE) ---------- */

  async function removeRequest(request, button) {
    button.disabled = true;
    try {
      await api(`/requests/${request.id}`, { method: 'DELETE' });
      const row = $(`.req[data-id="${request.id}"]`);
      const finish = () => {
        state.requests = state.requests.filter((r) => r.id !== request.id);
        renderAll();
        toast('Request deleted.');
      };
      if (row && !reducedMotion.matches) {
        row.classList.add('is-leaving');
        setTimeout(finish, 260);
      } else finish();
    } catch (error) {
      button.disabled = false;
      button.classList.remove('is-confirming');
      button.textContent = 'Delete';
      toast(error.message);
    }
  }

  /* ---------- Edit (PUT) ---------- */

  const dialog = $('#edit-dialog');
  const editForm = $('#edit-form');
  clearErrorOnInput(editForm);

  function openEdit(request) {
    state.editingId = request.id;
    showErrors(editForm, {});
    $('#edit-status').textContent = '';
    ['name', 'email', 'category', 'status', 'subject', 'description'].forEach((field) => {
      editForm.elements[field].value = request[field];
    });
    dialog.showModal();
  }

  $$('[data-close]', dialog).forEach((button) => button.addEventListener('click', () => dialog.close()));
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });

  editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const status = $('#edit-status');
    status.textContent = '';
    status.classList.remove('is-error');

    const values = readForm(editForm);
    const errors = validate(values);
    showErrors(editForm, errors);
    if (Object.keys(errors).length) {
      status.textContent = 'Fix the marked fields and try again.';
      status.classList.add('is-error');
      return;
    }

    const button = $('#edit-save');
    setLoading(button, true, 'Save changes', 'Saving…');
    try {
      const { data } = await api(`/requests/${state.editingId}`, { method: 'PUT', body: values });
      const index = state.requests.findIndex((r) => r.id === data.id);
      if (index !== -1) state.requests[index] = data;
      dialog.close();
      renderAll();
      toast('Changes saved.');
    } catch (error) {
      if (error.details?.length) showErrors(editForm, Object.fromEntries(error.details.map((d) => [d.field, d.message])));
      status.textContent = error.message;
      status.classList.add('is-error');
    } finally {
      setLoading(button, false, 'Save changes', 'Saving…');
    }
  });

  /* ---------- Filters ---------- */

  $('#filters').addEventListener('click', (event) => {
    const button = event.target.closest('button[data-filter]');
    if (!button || button.dataset.filter === state.filter) return;
    state.filter = button.dataset.filter;
    $$('#filters button').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
    renderList();
  });

  /* ---------- Start ---------- */

  const startPanel = location.hash === '#requests' ? 'requests' : 'new';
  openPanel(startPanel, { focus: false, updateHash: false });
  window.addEventListener('hashchange', () => {
    const name = location.hash === '#requests' ? 'requests' : location.hash === '#new' ? 'new' : null;
    if (name && name !== state.panel) openPanel(name, { updateHash: false });
  });

  loadRequests();
})();
