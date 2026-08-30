export type ChatMessage =
  | { type: 'join'; room: string; user: string }
  | { type: 'leave'; room: string; user: string }
  | { type: 'message'; room: string; user: string; text: string }
  | { type: 'ping'; at: number }
  | { type: 'pong'; at: number };

export function parseMessage(value: unknown): ChatMessage {
  if (!value || typeof value !== 'object') throw new TypeError('Message must be an object');
  const item = value as Record<string, unknown>;
  if (!['join', 'leave', 'message', 'ping', 'pong'].includes(String(item.type))) throw new TypeError('Unknown message type');
  if ((item.type === 'join' || item.type === 'leave' || item.type === 'message') && (typeof item.room !== 'string' || typeof item.user !== 'string')) throw new TypeError('room and user are required');
  if (item.type === 'message' && typeof item.text !== 'string') throw new TypeError('text is required');
  if ((item.type === 'ping' || item.type === 'pong') && typeof item.at !== 'number') throw new TypeError('at is required');
  return item as ChatMessage;
}

export function encodeServerTextFrame(text: string): Buffer {
  const payload = Buffer.from(text);
  if (payload.length >= 126) throw new Error('Educational frame encoder supports payloads under 126 bytes');
  return Buffer.concat([Buffer.from([0x81, payload.length]), payload]);
}

export function decodeClientTextFrame(frame: Buffer): string {
  if ((frame[0]! & 0x0f) !== 1) throw new Error('Only text frames are supported');
  const masked = (frame[1]! & 0x80) !== 0;
  const length = frame[1]! & 0x7f;
  if (!masked || length >= 126 || frame.length < 6 + length) throw new Error('Invalid educational client frame');
  const mask = frame.subarray(2, 6);
  const payload = Buffer.alloc(length);
  for (let index = 0; index < length; index += 1) payload[index] = frame[6 + index]! ^ mask[index % 4]!;
  return payload.toString('utf8');
}

export class RoomBroker {
  readonly #rooms = new Map<string, Map<string, (message: ChatMessage) => void>>();
  join(room: string, user: string, send: (message: ChatMessage) => void): () => void {
    const members = this.#rooms.get(room) ?? new Map(); this.#rooms.set(room, members); members.set(user, send);
    this.publish({ type: 'join', room, user });
    return () => { members.delete(user); this.publish({ type: 'leave', room, user }); if (members.size === 0) this.#rooms.delete(room); };
  }
  publish(message: Extract<ChatMessage, { room: string }>): void {
    for (const send of this.#rooms.get(message.room)?.values() ?? []) send(message);
  }
  memberCount(room: string): number { return this.#rooms.get(room)?.size ?? 0; }
}

export function reconnectDelay(attempt: number, baseMs = 250, maxMs = 10_000): number { return Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt)); }
