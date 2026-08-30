export async function getServerSideProps() { return { props: { todos: ['HTTPを学ぶ', 'SSRを実装する'] } }; }
export default function HomePage(props: Record<string, unknown>): string { const todos = props.todos as string[]; return `<h1>Todo</h1><ul>${todos.map((todo) => `<li>${todo}</li>`).join('')}</ul>`; }
