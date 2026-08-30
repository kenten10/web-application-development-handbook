type Filter = 'all' | 'active' | 'completed';
interface Todo { id: string; text: string; completed: boolean; }
const storageKey = 'handbook-ch04-todos';
let todos: Todo[] = load(); let filter: Filter = 'all';
const form = document.querySelector<HTMLFormElement>('#todo-form')!;
const input = document.querySelector<HTMLInputElement>('#todo-input')!;
const list = document.querySelector<HTMLUListElement>('#todo-list')!;
const status = document.querySelector<HTMLElement>('#status')!;
function load(): Todo[] { try { const value = JSON.parse(localStorage.getItem(storageKey) ?? '[]'); return Array.isArray(value) ? value : []; } catch { return []; } }
function save(): void { localStorage.setItem(storageKey, JSON.stringify(todos)); }
function visible(todo: Todo): boolean { return filter === 'all' || (filter === 'active' && !todo.completed) || (filter === 'completed' && todo.completed); }
function render(): void {
  list.replaceChildren(...todos.filter(visible).map((todo) => {
    const item = document.createElement('li'); item.dataset.id = todo.id; item.className = todo.completed ? 'completed' : '';
    const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.checked = todo.completed; checkbox.setAttribute('aria-label', `${todo.text}を完了にする`);
    checkbox.addEventListener('change', () => update(todo.id, { completed: checkbox.checked }));
    const text = document.createElement('span'); text.textContent = todo.text;
    const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = '削除'; remove.setAttribute('aria-label', `${todo.text}を削除`); remove.addEventListener('click', () => removeTodo(todo.id));
    item.append(checkbox, text, remove); return item;
  }));
  status.textContent = `${todos.filter((todo) => !todo.completed).length}件が未完了`;
  document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
}
function update(id: string, patch: Partial<Todo>): void { todos = todos.map((todo) => todo.id === id ? { ...todo, ...patch } : todo); save(); render(); }
function removeTodo(id: string): void { todos = todos.filter((todo) => todo.id !== id); save(); render(); input.focus(); }
form.addEventListener('submit', (event) => { event.preventDefault(); const text = input.value.trim(); if (!text) return; todos = [...todos, { id: crypto.randomUUID(), text, completed: false }]; input.value = ''; save(); render(); input.focus(); });
document.querySelectorAll<HTMLButtonElement>('[data-filter]').forEach((button) => button.addEventListener('click', () => { filter = button.dataset.filter as Filter; render(); }));
input.addEventListener('keydown', (event) => { if (event.key === 'Escape') input.value = ''; if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') { todos = todos.map((todo) => ({ ...todo, completed: true })); save(); render(); } });
render();

export {};
