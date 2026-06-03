export class BaseProvider {
  protected cache = new Map<string, string>();

  protected getCacheKey(...args: unknown[]): string {
    return JSON.stringify(args);
  }

  protected readCache(key: string): string | undefined {
    return this.cache.get(key);
  }

  protected writeCache(key: string, value: string): void {
    this.cache.set(key, value);
  }
}
