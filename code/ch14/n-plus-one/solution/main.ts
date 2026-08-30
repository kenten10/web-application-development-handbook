export interface User { id: number; name: string; }
export interface Post { id: number; userId: number; title: string; }
export interface PostWithAuthor extends Post { authorName: string; }

export class QueryCountingDatabase {
  queryCount = 0;
  constructor(readonly users: readonly User[], readonly posts: readonly Post[]) {}
  findPosts(): Post[] { this.queryCount += 1; return this.posts.map((post) => ({ ...post })); }
  findUser(id: number): User | undefined { this.queryCount += 1; return this.users.find((user) => user.id === id); }
  joinPostsAndUsers(): PostWithAuthor[] { this.queryCount += 1; const users = new Map(this.users.map((user) => [user.id, user])); return this.posts.map((post) => ({ ...post, authorName: users.get(post.userId)?.name ?? 'unknown' })); }
  explain(kind: 'n+1' | 'join'): string[] { return kind === 'n+1' ? ['Seq Scan posts', `Index Lookup users × ${this.posts.length}`] : ['Hash Join posts.user_id = users.id', 'Seq Scan posts', 'Hash users']; }
}

export function loadWithNPlusOne(db: QueryCountingDatabase): PostWithAuthor[] { return db.findPosts().map((post) => ({ ...post, authorName: db.findUser(post.userId)?.name ?? 'unknown' })); }
export function loadWithJoin(db: QueryCountingDatabase): PostWithAuthor[] { return db.joinPostsAndUsers(); }
