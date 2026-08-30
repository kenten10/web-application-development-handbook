const items = JSON.parse(localStorage.getItem('todos') ?? '[]');
const list = document.querySelector('#list');
function render() { list.replaceChildren(...items.map((text) => { const li=document.createElement('li'); li.textContent=text; return li; })); localStorage.setItem('todos', JSON.stringify(items)); }
document.querySelector('#form').addEventListener('submit', (event) => { event.preventDefault(); const input=document.querySelector('#todo'); items.push(input.value); input.value=''; render(); });
render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./main.js').then((registration) => { document.querySelector('#status').textContent = registration.active ? 'offline ready' : 'installing'; });
