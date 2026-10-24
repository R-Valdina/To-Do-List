import { dateKey, parseDate, formatDate } from '../dates.js';
import { element, button } from './dom.js';

/** In-flow date picker: no native popup styling and no clipped overlay. */
export function createDatePicker(container, labelId, onChange = () => {}) {
  let value = '';
  let month = new Date();
  let open = false;
  const root = element('div', 'date-picker');
  const toggle = button('', 'date-toggle', () => {
    open = !open;
    draw();
    if (open) root.querySelector('.selected, .today, .calendar-days button')?.focus();
  });
  const valueText = element('span');
  valueText.id = `${labelId}-value`;
  toggle.setAttribute('aria-labelledby', `${labelId} ${valueText.id}`);
  const icon = element('span', '', '▦');
  icon.setAttribute('aria-hidden', 'true');
  toggle.append(valueText, icon);
  const calendar = element('div', 'calendar');
  calendar.id = `${labelId}-calendar`;
  toggle.setAttribute('aria-controls', calendar.id);
  root.append(toggle, calendar);
  container.append(root);

  function choose(next) {
    value = next;
    open = false;
    draw();
    onChange(value);
    toggle.focus();
  }
  function draw() {
    valueText.textContent = value ? formatDate(value) : 'Select date';
    toggle.setAttribute('aria-expanded', open);
    calendar.hidden = !open;
    calendar.replaceChildren();
    if (!open) return;
    const heading = element('div', 'calendar-heading');
    function monthButton(text, offset, label) {
      const control = button(text, '', () => {
        month = new Date(month.getFullYear(), month.getMonth() + offset, 1);
        draw();
        calendar.querySelector(`[data-offset="${offset}"]`).focus();
      });
      control.dataset.offset = offset;
      control.setAttribute('aria-label', label);
      return control;
    }
    const title = element('strong', '', month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }));
    title.setAttribute('aria-live', 'polite');
    heading.append(monthButton('‹', -1, 'Previous month'), title, monthButton('›', 1, 'Next month'));
    const week = element('div', 'calendar-week');
    const names = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    names.forEach(name => {
      const label = element('span', '', name.slice(0, 2));
      label.setAttribute('aria-label', name);
      week.append(label);
    });
    const days = element('div', 'calendar-days');
    const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
    const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    for (let i = 0; i < first; i++) days.append(element('span'));
    for (let day = 1; day <= count; day++) {
      const date = new Date(month.getFullYear(), month.getMonth(), day, 12);
      const key = dateKey(date);
      const control = button(String(day), '', () => choose(key));
      control.dataset.date = key;
      control.classList.toggle('selected', key === value);
      control.classList.toggle('today', key === dateKey(new Date()));
      control.setAttribute('aria-pressed', key === value);
      control.setAttribute('aria-label', date.toLocaleDateString(undefined, {
        weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
      }));
      if (key === dateKey(new Date())) control.setAttribute('aria-current', 'date');
      days.append(control);
    }
    days.addEventListener('keydown', event => {
      const current = event.target.dataset.date;
      const offsets = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
      if (!current || !Object.hasOwn(offsets, event.key)) return;
      event.preventDefault();
      const next = parseDate(current);
      next.setDate(next.getDate() + offsets[event.key]);
      month = new Date(next.getFullYear(), next.getMonth(), 1);
      draw();
      calendar.querySelector(`[data-date="${dateKey(next)}"]`)?.focus();
    });
    const actions = element('div', 'calendar-actions');
    actions.append(button('Clear', '', () => choose('')), button('Today', '', () => choose(dateKey(new Date()))),
      button('Close', '', close));
    calendar.append(heading, week, days, actions);
  }
  function close() {
    open = false;
    draw();
    toggle.focus();
  }
  root.addEventListener('keydown', event => {
    if (event.key === 'Escape' && open) {
      event.preventDefault();
      event.stopPropagation();
      close();
    }
  });
  return {
    get value() { return value; },
    set(next) {
      value = next || '';
      const date = value ? parseDate(value) : new Date();
      month = new Date(date.getFullYear(), date.getMonth(), 1);
      open = false;
      draw();
    },
  };
}
