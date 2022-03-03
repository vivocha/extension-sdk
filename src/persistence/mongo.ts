import { Collection, Db, MongoClient } from 'mongodb';
import { DEFAULT_TTL, PersistentCollection, PersistentCollectionOptions } from '.';

export interface MongoCollectionOptions extends PersistentCollectionOptions {
  mongoUrl: string;
  db: string;
}

export class MongoCollection<T extends object> extends PersistentCollection<T> {
  protected opts: MongoCollectionOptions;
  protected db: Promise<Db>;
  protected collection: Promise<Collection>;

  constructor(opts: MongoCollectionOptions) {
    super(opts);
    this.db = (async () => {
      const dbClient = await MongoClient.connect(opts.mongoUrl);
      return dbClient.db(opts.db);
    })();
    this.collection = (async () => {
      const collection = (await this.db).collection(opts.name);
      await collection.createIndex(opts.key, { unique: true });
      if (opts.ttl || opts.ttlKey) {
        await collection.createIndex(opts.ttlKey || 'expires', { expireAfterSeconds: opts.ttl || (opts.ttlKey ? 0 : DEFAULT_TTL) });
      }
      return collection;
    })();
  }
  async ready(): Promise<boolean> {
    await this.collection;
    return true;
  }
  async get(key: string): Promise<T> {
    const c = await this.collection;
    return c.findOne({ [this.opts.key]: key }) as Promise<T>;
  }
  async remove(key: string): Promise<any> {
    const c = await this.collection;
    return c.findOneAndDelete({ [this.opts.key]: key });
  }
  async replace(record: T): Promise<T> {
    const c = await this.collection;
    return c.findOneAndReplace(
      {
        [this.opts.key]: record[this.opts.key]
      },
      this.opts.ttl || this.opts.ttlKey
        ? (Object.assign(
            {
              [this.opts.ttlKey || 'expires']: new Date(+new Date() + (this.opts.ttl || DEFAULT_TTL))
            },
            record
          ) as any)
        : record,
      {
        upsert: true
      }
    ) as Promise<T>;
  }
}
