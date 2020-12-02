export const DEFAULT_TTL = 5 * 60 * 1000;

export interface PersistentCollectionOptions {
  name: string;
  key: string;
  ttl?: number;
  ttlKey?: string;
}

export abstract class PersistentCollection<T extends object> {
  constructor(protected opts: PersistentCollectionOptions) {}
  abstract get(key: string): Promise<T>;
  abstract remove(key: string): Promise<any>;
  abstract replace(data: T): Promise<T>;
  abstract ready(): Promise<boolean>;
}
