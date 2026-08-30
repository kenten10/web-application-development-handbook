export type OutboxEvent = { id: number; eventType: string; payload: unknown; createdAt: Date; attempts: number; sentAt?: Date };
export type User = { id: string; name: string };

export class InMemoryDatabase {
  readonly users = new Map<string, User>();
  readonly outbox: OutboxEvent[] = [];
  private nextId = 1;
  transaction<T>(operation: (tx: { createUser: (user: User) => void; addEvent: (type: string, payload: unknown) => void }) => T): T {
    const pendingUsers: User[] = []; const pendingEvents: Array<{ type: string; payload: unknown }> = [];
    const result = operation({ createUser: (user) => pendingUsers.push(user), addEvent: (type, payload) => pendingEvents.push({ type, payload }) });
    for (const user of pendingUsers) this.users.set(user.id, user);
    for (const event of pendingEvents) this.outbox.push({ id: this.nextId++, eventType: event.type, payload: event.payload, createdAt: new Date(), attempts: 0 });
    return result;
  }
}

export class OutboxRelay {
  constructor(private readonly db: InMemoryDatabase, private readonly publish: (event: OutboxEvent) => Promise<void>) {}
  async runOnce(limit = 100): Promise<number> {
    let sent = 0;
    for (const event of this.db.outbox.filter((item) => item.sentAt === undefined).slice(0, limit)) {
      event.attempts++;
      try { await this.publish(event); event.sentAt = new Date(); sent++; } catch { /* retry on next poll */ }
    }
    return sent;
  }
}

export async function demo(): Promise<void> {
  const db = new InMemoryDatabase(); const published: string[] = [];
  db.transaction((tx) => { tx.createUser({ id: 'u1', name: 'Alice' }); tx.addEvent('user.created', { userId: 'u1', name: 'Alice' }); });
  await new OutboxRelay(db, async (event) => { published.push(event.eventType); }).runOnce();
  console.log(JSON.stringify({ users: db.users.size, published }));
}
if (import.meta.url === `file://${process.argv[1]}`) await demo();
