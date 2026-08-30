import { createHash } from 'node:crypto';

export class BloomFilter {
  private readonly bits: Uint8Array;
  constructor(readonly bitCount: number, readonly hashCount: number) {
    if (!Number.isInteger(bitCount) || bitCount <= 0) throw new Error('bitCount must be positive');
    if (!Number.isInteger(hashCount) || hashCount <= 0) throw new Error('hashCount must be positive');
    this.bits = new Uint8Array(Math.ceil(bitCount / 8));
  }
  private indexes(value: string): number[] {
    const digest = createHash('sha256').update(value).digest();
    const h1 = digest.readUInt32BE(0);
    const h2 = digest.readUInt32BE(4) || 0x9e3779b9;
    return Array.from({ length: this.hashCount }, (_, i) => (h1 + i * h2 + i * i) % this.bitCount);
  }
  add(value: string): void {
    for (const index of this.indexes(value)) {
      const byte = index >> 3;
      this.bits[byte] = (this.bits[byte] ?? 0) | (1 << (index & 7));
    }
  }
  has(value: string): boolean {
    return this.indexes(value).every((index) => (this.bits[index >> 3]! & (1 << (index & 7))) !== 0);
  }
  estimatedFalsePositiveRate(inserted: number): number {
    return (1 - Math.exp((-this.hashCount * inserted) / this.bitCount)) ** this.hashCount;
  }
}
