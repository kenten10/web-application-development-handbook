// アプリ本体。この演習の主題は Service Worker なので、ここは完成した状態で渡す。
const items = JSON.parse(localStorage.getItem('todos') ?? '[]');
const list = document.querySelector('#list');

function render() {
  list.replaceChildren(...items.map((text) => {
    const li = document.createElement('li');
    li.textContent = text;
    return li;
  }));
  localStorage.setItem('todos', JSON.stringify(items));
}

document.querySelector('#form').addEventListener('submit', (event) => {
  event.preventDefault();
  const input = document.querySelector('#todo');
  items.push(input.value);
  input.value = '';
  render();
});

render();

// TODO: main.js を Service Worker として登録し、状態を #status へ表示する。
// registration.installing / waiting / active のどれになるかを観察できるようにする。
