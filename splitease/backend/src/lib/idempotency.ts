export class IdempotencyStore<T> {
  private readonly values = new Map<string, T>();
  get(key: string) { return this.values.get(key); }
  set(key: string, value: T) { this.values.set(key, value); }
}
