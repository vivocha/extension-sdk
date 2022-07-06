import { DynamoDB } from 'aws-sdk';
import { PersistentCollection, PersistentCollectionOptions } from './index.js';

export interface DynamoTableOptions extends PersistentCollectionOptions {
  region: string;
  create?: boolean;
  readUnits?: number;
  writeUnits?: number;
}

export class DynamoTable<T extends object> extends PersistentCollection<T> {
  protected opts: DynamoTableOptions;
  protected table: Promise<DynamoDB.DocumentClient>;

  constructor(opts: DynamoTableOptions) {
    super(opts);
    this.table = (async () => {
      if (this.opts.create) {
        const api = new DynamoDB({ region: this.opts.region });
        let existing;
        try {
          existing = await api.describeTable({ TableName: this.opts.name }).promise();
        } catch (err) {}

        if (!existing) {
          await api
            .createTable({
              TableName: this.opts.name,
              KeySchema: [{ AttributeName: 'ExtensionKey', KeyType: 'HASH' }],
              AttributeDefinitions: [{ AttributeName: 'ExtensionKey', AttributeType: 'S' }],
              ProvisionedThroughput: {
                ReadCapacityUnits: this.opts.readUnits || 5,
                WriteCapacityUnits: this.opts.writeUnits || 5
              }
            })
            .promise();
          await api
            .waitFor('tableExists', {
              TableName: this.opts.name
            })
            .promise();
          if (this.opts.ttlKey || this.opts.ttl) {
            await api
              .updateTimeToLive({
                TableName: this.opts.name,
                TimeToLiveSpecification: {
                  AttributeName: 'ExtensionTTL',
                  Enabled: true
                }
              })
              .promise();
          }
        }
      }
      return new DynamoDB.DocumentClient({ region: this.opts.region });
    })();
  }
  async ready(): Promise<boolean> {
    await this.table;
    return true;
  }
  async get(key: string): Promise<T> {
    const table = await this.table;
    const rawData: DynamoDB.DocumentClient.GetItemOutput = await table
      .get({
        TableName: this.opts.name,
        Key: { ExtensionKey: key }
      })
      .promise();
    if (rawData && rawData.Item && typeof rawData.Item.ExtensionData) {
      return JSON.parse(rawData.Item.ExtensionData) as T;
    } else {
      return;
    }
  }
  async remove(key: string): Promise<any> {
    const table = await this.table;
    await table
      .delete({
        TableName: this.opts.name,
        Key: { ExtensionKey: key }
      })
      .promise();
  }
  async replace(data: T): Promise<T> {
    if (!data || !data[this.opts.key]) {
      throw new Error('bad_data');
    }
    const table = await this.table;
    const _data: any = { ExtensionData: JSON.stringify(data) };

    if (this.opts.ttlKey) {
      _data.ExtensionTTL = Math.floor((+data[this.opts.ttlKey] + (this.opts.ttl || 0)) / 1000);
    } else if (this.opts.ttl) {
      _data.ExtensionTTL = Math.floor((+new Date() + this.opts.ttl) / 1000);
    }

    let expr: string[] = [];
    let attr: any = {};

    for (let k in _data) {
      const vk = `:v_${k}`;
      expr.push(`${k} = ${vk}`);
      attr[vk] = _data[k];
    }

    const opts: DynamoDB.DocumentClient.UpdateItemInput = {
      TableName: this.opts.name,
      Key: { ExtensionKey: data[this.opts.key] },
      ExpressionAttributeValues: attr,
      UpdateExpression: `set ${expr.join(', ')}`
    };

    return table.update(opts).promise() as Promise<T>;
  }
}
