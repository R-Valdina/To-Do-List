import { deadline } from '../dates.js';
import { isComplete, progressText, listProgress, completionText } from '../model.js';
import { applyAppearance } from '../themes.js';
import { $, element, button, deadlineBadge } from './dom.js';

const collator = new Intl.Collator(undefined, { sensitivity: 'base', numeric: true });
let sequence = 0;

export function renderApp(state, view, actions, drag) {
  const dark = state.settings.theme === 'dark';
  document.body.classList.toggle('dark', dark);
  $('#theme').setAttribute('aria-pressed', dark);
  const ordered = [...state.lists].sort((a, b) => {
    const comparison = collator.compare(a.name, b.name);
    return state.settings.sort === 'asc' ? comparison : -comparison;
  });
  const current = state.lists.find(list => list.id === view.selected);
  if (!current) view.selected = 'all';
  const all = view.selected === 'all';
  const navigation = $('#navigation');
  navigation.replaceChildren();
  const allButton = button('', '', () => actions.navigate('all'));
  allButton.append(element('span', 'nav-name', 'All lists'), element('small', '', String(state.lists.length)));
  allButton.classList.toggle('active', all);
  allButton.setAttribute('aria-pressed', all);
  navigation.append(allButton);
  ordered.forEach(list => {
    const item = button('', 'list-link', () => actions.navigate(list.id));
    item.dataset.listId = list.id;
    applyAppearance(item, list.appearance, dark);
    item.classList.toggle('active', view.selected === list.id);
    item.setAttribute('aria-pressed', view.selected === list.id);
    const meta = element('span', 'nav-meta');
    const status = deadline(list.due, isComplete(list));
    if (status && ['warning', 'urgent', 'overdue'].includes(status.kind)) meta.append(deadlineBadge(status, true));
    item.classList.toggle('sidebar-overdue', status?.kind === 'overdue');
    meta.append(element('small', '', progressText(list)));
    item.append(element('span', 'nav-name', list.name), meta);
    navigation.append(item);
  });
  const ascending = state.settings.sort === 'asc';
  $('#sort-lists').textContent = ascending ? 'A–Z ↓' : 'Z–A ↑';
  $('#sort-lists').setAttribute('aria-label', ascending ? 'Sorted A to Z. Switch to Z to A.' : 'Sorted Z to A. Switch to A to Z.');
  $('#heading').textContent = all ? 'All lists' : current.name;
  $('#top-add-task').hidden = all;
  $('#top-add-task').setAttribute('aria-label', all ? 'Add task' : `Add task to ${current.name}`);
  $('#search').placeholder = all ? 'Search all lists and tasks…' : `Search tasks in ${current.name}…`;
  $('#search').setAttribute('aria-label', $('#search').placeholder);

  const query = $('#search').value.trim().toLowerCase();
  const container = $('#lists');
  container.replaceChildren();
  ordered.filter(list => all || list.id === view.selected).forEach(list => {
    const matchesName = all && list.name.toLowerCase().includes(query);
    const visible = list.tasks.filter(task => !query || matchesName || task.text.toLowerCase().includes(query));
    if (all && query && !matchesName && !visible.length) return;
    const status = deadline(list.due, isComplete(list));
    const card = element('section', `list-card${status?.kind === 'overdue' ? ' is-overdue' : ''}`);
    card.dataset.listId = list.id;
    applyAppearance(card, list.appearance, dark);
    const heading = element('div', 'list-heading');
    const info = element('div', 'list-info');
    const title = element('h2', '', list.name);
    title.id = `list-heading-${++sequence}`;
    card.setAttribute('aria-labelledby', title.id);
    info.append(title);
    if (status) {
      const due = element('div', 'list-deadline');
      due.append(deadlineBadge(status));
      info.append(due);
    }
    const details = element('details');
    const summary = element('summary', '', '•••');
    summary.setAttribute('aria-label', `Options for ${list.name}`);
    const menu = element('div', 'menu');
    menu.append(button('Edit list', '', () => actions.editList(list, summary)));
    details.append(summary, menu);
    heading.append(info, details);
    const progress = document.createElement('progress');
    const { done, total } = listProgress(list);
    progress.max = total || 1;
    progress.value = done;
    progress.setAttribute('aria-label', `${list.name} progress`);
    const progressSummary = element('div', 'progress-summary');
    const caption = element('p', 'list-count', completionText(list));
    caption.id = `list-progress-${sequence}`;
    progress.setAttribute('aria-describedby', caption.id);
    progressSummary.append(progress, caption);
    const tasks = element('ol', 'tasks');
    visible.forEach(task => tasks.append(renderTask(list, task, query, actions, drag)));
    card.append(heading, progressSummary, tasks);
    if (!visible.length) card.append(element('p', 'empty', query ? 'No matching tasks in this list.' : 'No tasks yet. Add your first step.'));
    const add = button('＋ Add task', 'add-task', () => actions.editTask(list, null, add));
    card.append(add);
    container.append(card);
  });
  if (!container.children.length) container.append(element('p', 'empty', query ?
    'No matching lists or tasks.' : 'Create your first list to get started.'));
}

function renderTask(list, task, query, actions, drag) {
  const status = deadline(task.due, task.done);
  const row = element('li', `task${task.done ? ' done' : ''}${status?.kind === 'overdue' ? ' is-overdue' : ''}`);
  row.dataset.taskId = task.id;
  const handle = drag.createHandle(list, task, row, Boolean(query));
  const check = document.createElement('input');
  check.type = 'checkbox';
  check.className = 'check';
  check.dataset.action = 'check';
  check.checked = task.done;
  check.setAttribute('aria-label', `Mark ${task.text} ${task.done ? 'incomplete' : 'complete'}`);
  check.addEventListener('change', () => actions.completeTask(list.id, task.id, check.checked));
  const body = element('div', 'task-body');
  const metadata = element('div', 'metadata');
  metadata.append(element('span', `badge priority-${task.priority.toLowerCase()}`, task.priority));
  if (status) metadata.append(deadlineBadge(status));
  body.append(element('div', 'task-title', task.text), metadata);
  const controls = element('div', 'actions');
  const edit = button('Edit', '', () => actions.editTask(list, task, edit));
  edit.dataset.action = 'edit';
  edit.setAttribute('aria-label', `Edit ${task.text}`);
  const remove = button('Delete', 'danger', () => actions.deleteTask(list.id, task.id));
  remove.setAttribute('aria-label', `Delete ${task.text}`);
  controls.append(edit, remove);
  row.append(handle, check, body, controls);
  return row;
}
