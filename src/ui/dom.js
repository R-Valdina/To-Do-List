export const $ = selector => document.querySelector(selector);
export function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}
export function button(text, className, action) {
  const node = element('button', className, text);
  node.type = 'button';
  node.addEventListener('click', action);
  return node;
}

export function warningIcon(kind) {
  const wrapper = element('span', 'deadline-icon');
  wrapper.setAttribute('aria-hidden', 'true');
  // Fixed markup only. User-entered content must always use textContent/value.
  const shapes = {
    warning: '<path d="M12 2.5 22 21H2L12 2.5Z" fill="#F6C644" stroke="#725000" stroke-width="1.5"/><path d="M12 8v6" stroke="#352700" stroke-width="2.5" stroke-linecap="round"/><circle cx="12" cy="17.5" r="1.4" fill="#352700"/>',
    overdue: '<circle cx="12" cy="12" r="10" fill="#B51F38" stroke="#FFF"/><path d="M12 6v6l4 2" stroke="#FFF" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>',
    urgent: '<path d="M7 2h10l5 5v10l-5 5H7l-5-5V7l5-5Z" fill="#B51F38" stroke="#FFF"/><path d="M12 6.5v7" stroke="#FFF" stroke-width="2.5" stroke-linecap="round"/><circle cx="12" cy="17.5" r="1.4" fill="#FFF"/>',
  };
  wrapper.innerHTML = `<svg viewBox="0 0 24 24" fill="none">${shapes[kind] ?? shapes.urgent}</svg>`;
  return wrapper;
}

export function deadlineBadge(status, sidebar = false) {
  const warning = ['warning', 'urgent', 'overdue'].includes(status.kind);
  const badge = element('span', sidebar ? `sidebar-deadline ${status.kind}` :
    `badge ${status.kind}${warning ? ' deadline-badge' : ''}`);
  if (warning) badge.append(warningIcon(status.kind));
  const label = sidebar ? { warning: 'Due soon', urgent: 'Urgent', overdue: 'Overdue' }[status.kind] : status.text;
  badge.append(element('span', '', label));
  if (sidebar) {
    badge.title = status.text;
    badge.setAttribute('aria-label', status.text);
  }
  return badge;
}

export function showError(target, message = '') {
  target.textContent = message;
  target.hidden = !message;
}

export function focusTask(id, action = 'edit') {
  const row = [...document.querySelectorAll('#lists .task')].find(node => node.dataset.taskId === id);
  const target = row?.querySelector(`[data-action="${action}"]`);
  if (target && !target.disabled) target.focus();
  else (row?.querySelector('[data-action="edit"]') ?? $('#new-list')).focus();
}
