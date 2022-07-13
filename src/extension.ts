import { AssetManagerAPITypes, ExtensionAPITypes, ExtensionInfo, ExtensionType, MultiLanguageString } from '@vivocha/public-entities';
import { API, APIRequest, APIRequestHandler, APIResponse, Method, Operation, Resource } from 'arrest';
import bodyParserPkg from 'body-parser';
const { json: jsonParser } = bodyParserPkg;
import camelcase from 'camelcase';
import { getLogger } from 'debuggo';
import express from 'express';
import { NextFunction, Router, RouterOptions } from 'express';
import { createReadStream, readFile, readFileSync } from 'fs';
import mustache from 'mustache';
import needle from 'needle';
import { OpenAPIV3 } from 'openapi-police';
import path from 'path';
import { PersistentCollection } from './persistence/index.js';
import { DynamoTable } from './persistence/dynamo.js';
import { MongoCollection } from './persistence/mongo.js';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const logger = getLogger('extension-sdk');

export interface APIContext {
  req: APIRequest;
  res: APIResponse;
}
export interface IExtensionSettings {
  settings(context: APIContext): OpenAPIV3.SchemaObject;
  settingsClient?(context: APIContext): any; // TODO extentions can return a client to configure settings (e.g. for oauth flows, complex foundries, etc)
}
export interface IExtensionAsynchronous {
  subscribe(request: ExtensionAPITypes.Subscribe.Request, context: APIContext): Promise<ExtensionAPITypes.Subscribe.Response>;
  unsubscribe(request: ExtensionAPITypes.Unsubscribe.Request, context: APIContext): Promise<ExtensionAPITypes.Unsubscribe.Response>;
  refresh?(request: ExtensionAPITypes.Refresh.Request, context: APIContext): Promise<ExtensionAPITypes.Refresh.Response>;
  check?(request: ExtensionAPITypes.Check.Request, context: APIContext): Promise<ExtensionAPITypes.Check.Response>;
  repair?(request: ExtensionAPITypes.Repair.Request, context: APIContext): Promise<ExtensionAPITypes.Repair.Response>;
  customService?(request: ExtensionAPITypes.CustomService.Request, context: APIContext): Promise<ExtensionAPITypes.CustomService.Response>;
}

function isIExtensionSettings(obj: object): obj is IExtensionSettings {
  return 'settings' in obj;
}
function isIExtensionAsynchronous(obj: object): obj is IExtensionAsynchronous {
  return 'subscribe' in obj && 'unsubscribe' in obj;
}

export class ExtensionAPI<Record extends object = any, TempRecord extends object = any> extends API {
  collection?: PersistentCollection<Record>;
  tempCollection?: PersistentCollection<TempRecord>;
  assetsPath: string;
  settingsClientPath: string;

  constructor(type: ExtensionType, collection?: PersistentCollection<Record>, tempCollection?: PersistentCollection<TempRecord>);
  constructor(info: ExtensionInfo, collection?: PersistentCollection<Record>, tempCollection?: PersistentCollection<TempRecord>);
  constructor(data: any, collection?: PersistentCollection<Record>, tempCollection?: PersistentCollection<TempRecord>) {
    if (typeof data === 'string') {
      super({
        'x-vivocha': {
          type: data as ExtensionType
        }
      } as any as ExtensionInfo);
    } else {
      super(data as ExtensionInfo);
    }
    this.document.components.schemas = {
      errorResponse: this.document.components.schemas.errorResponse
    };
    // TODO: the following statement has been removed because it creates issues with schemas, remove code after testing it
    // Arrest default params already has the id
    /*
    this.document.components.parameters = {
      id: this.document.components.parameters.id
    };
    */
    this.collection = collection;
    this.tempCollection = tempCollection;
    this.registerSchema('common', require('@vivocha/public-entities/schemas/common.json'));
    this.registerSchema('protocol', require('@vivocha/public-entities/schemas/extension_protocol.json'));
    this.registerSchema('text_message', require('@vivocha/public-entities/schemas/text_message.json'));
    this.registerSchema('is_writing_message', require('@vivocha/public-entities/schemas/is_writing_message.json'));
    this.registerSchema('ack_message', require('@vivocha/public-entities/schemas/ack_message.json'));
    this.registerSchema('action_message', require('@vivocha/public-entities/schemas/action_message.json'));
    this.registerSchema('attachment_message', require('@vivocha/public-entities/schemas/attachment_message.json'));
    this.registerSchema('postback_message', require('@vivocha/public-entities/schemas/postback_message.json'));
    this.registerSchema('location_message', require('@vivocha/public-entities/schemas/location_message.json'));
  }
  async ready(): Promise<this> {
    if (this.collection) {
      await this.collection.ready();
    }
    if (this.tempCollection) {
      await this.tempCollection.ready();
    }
    return this;
  }

  loadStrings(path: string) {
    const data: MultiLanguageString[] = JSON.parse(readFileSync(path).toString());
    const info = this.document.info as ExtensionInfo;
    info['x-vivocha'].strings = data.reduce((strings, mls) => {
      strings[mls.id] = Object.keys(mls.values).reduce((values, lang) => {
        values[lang] = mls.values[lang].value;
        return values;
      }, {});
      return strings;
    }, {});
  }
  getRecord(key: string): Promise<Record> {
    if (!this.collection) {
      throw new Error('no collection');
    } else {
      return this.collection.get(key);
    }
  }
  deleteRecord(key: string): Promise<any> {
    if (!this.collection) {
      throw new Error('no collection');
    } else {
      return this.collection.remove(key);
    }
  }
  replaceRecord(record: Record): Promise<Record> {
    if (!this.collection) {
      throw new Error('no collection');
    } else {
      return this.collection.replace(record);
    }
  }
  getTempRecord(key: string): Promise<TempRecord> {
    if (!this.tempCollection) {
      throw new Error('no collection');
    } else {
      return this.tempCollection.get(key);
    }
  }
  deleteTempRecord(key: string): Promise<any> {
    if (!this.tempCollection) {
      throw new Error('no collection');
    } else {
      return this.tempCollection.remove(key);
    }
  }
  replaceTempRecord(record: TempRecord): Promise<TempRecord> {
    if (!this.tempCollection) {
      throw new Error('no collection');
    } else {
      return this.tempCollection.replace(record);
    }
  }

  cors(req: APIRequest, res: APIResponse, next: NextFunction) {
    let origin = req.headers['origin'];
    if (Array.isArray(origin)) {
      origin = origin[0];
    }
    if (!origin) {
      origin = `http://${req.hostname}`;
    }
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Authorization, Origin, X-Requested-With, Content-Type, Accept');
    res.header('Access-Control-Expose-Headers', 'Access-Control-Allow-Origin');
    res.header('P3P', 'CP="IDC DSP COR ADM DEVi TAIi PSA PSD IVAi IVDi CONi HIS OUR IND CNT"');
    next();
  }
  async router(options?: RouterOptions): Promise<Router> {
    if (isIExtensionSettings(this) || isIExtensionAsynchronous(this)) {
      const resource: Resource = new Resource({
        name: 'Extension',
        namePlural: 'Extension'
      });

      if (isIExtensionSettings(this)) {
        resource.addOperation(new ExtensionOperationSettings(resource));
        if (this.settingsClientPath) {
          resource.addOperation(new ExtensionOperationSettingsClient(resource));
        }
      }
      if (isIExtensionAsynchronous(this)) {
        resource.addOperation(
          new ExtensionBaseOperationProxy({
            resource,
            api: 'extensionAPI',
            operation: 'subscribe',
            requestDescription: 'Subscribe to asyncronous events and notifications',
            responseDescription: 'Subscription result'
          })
        );
        resource.addOperation(
          new ExtensionBaseOperationProxy({
            resource,
            api: 'extensionAPI',
            operation: 'unsubscribe',
            requestDescription: 'Cancel a subscription',
            responseDescription: 'Unsubscribe successful'
          })
        );

        if ('refresh' in this) {
          resource.addOperation(
            new ExtensionBaseOperationProxy({
              resource,
              api: 'extensionAPI',
              operation: 'refresh',
              requestDescription: 'Refresh a subscription to asyncronous events and notifications',
              responseDescription: 'Refresh result'
            })
          );
        }
        if ('check' in this) {
          resource.addOperation(
            new ExtensionBaseOperationProxy({
              resource,
              api: 'extensionAPI',
              operation: 'check',
              requestDescription: 'Check if a subscription is still valid',
              responseDescription: 'Check successful'
            })
          );
        }
        if ('repair' in this) {
          resource.addOperation(
            new ExtensionBaseOperationProxy({
              resource,
              api: 'extensionAPI',
              operation: 'repair',
              requestDescription: 'Repair a subscription that stopped working',
              responseDescription: 'Repair successful'
            })
          );
        }
        if ('customService' in this) {
          resource.addOperation(
            new ExtensionBaseOperationProxy({
              resource,
              api: 'extensionAPI',
              operation: 'customService',
              requestDescription: 'Perform a custom service',
              responseDescription: 'Custom service successful'
            })
          );
        }
      }
      if (this.assetsPath) {
        resource.addOperation(new ExtensionOperationAssets(resource));
      }
      this.addResource(resource);
    }
    const base = Router(options);
    base.use(this.cors.bind(this));
    if (process.env.TOKEN) {
      base.get('/openapi.json', (req: APIRequest, res: APIResponse, next: NextFunction) => {
        if (!req.headers.authorization || req.headers.authorization !== `Bearer ${process.env.TOKEN}`) {
          next(API.newError(401, 'unauthorized'));
        } else {
          next();
        }
      });
    }
    base.use(await super.router(options));
    return base;
  }
  async postToWebhook(environment: ExtensionAPITypes.Environment, event: string, context?: any, payload?: any): Promise<any> {
    const url = `${environment.apiUrl}/extensions/${environment.extensionId}/webhook/${environment.instanceId}`;
    const body: ExtensionAPITypes.Messages.Event = {
      event,
      ts: new Date(),
      context,
      payload
    };
    logger.debug('postToWebhook', url, JSON.stringify(body, null, 2));

    // return await request({
    //   url,
    //   method: 'POST',
    //   json: true,
    //   body
    // });

    return await needle('post', url, body, {
      json: true
    });
  }

  async postMediaToWebhook(
    environment: ExtensionAPITypes.Environment,
    event: string,
    asset: AssetManagerAPITypes.AssetInfo,
    context?: any,
    payload?: any
  ): Promise<any> {
    const url = `${environment.apiUrl}/extensions/${environment.extensionId}/webhook/${environment.instanceId}/attach`;
    const body: ExtensionAPITypes.Messages.Event = {
      event,
      ts: new Date(),
      context,
      payload
    };
    logger.debug('postMediaToWebhook', url, JSON.stringify(body, null, 2));

    // read the file and create a stream with needle
    const buffer = readFileSync(asset.path);

    var formData = {
      opts: JSON.stringify(body),
      file: {
        value: buffer,
        options: {
          filename: asset.originalname,
          contentType: asset.mimetype
        }
      }
    };

    const response = await needle('post', url, formData, { multipart: true });
    return response ? response : undefined;
  }

  /**
   * Return the base URL of the extension, using BASE_URL env var or the API context request headers
   * @param context
   * @returns the base URL string
   */
  baseURL(req: APIRequest): string {
    return process.env.BASE_URL || `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers['host']}`;
  }

  static isLambda(): boolean {
    return !!process.env.AWS_LAMBDA_RUNTIME_API;
  }

  static initApplication(router: Promise<express.Router>, app: express.Application = express()): express.Application {
    if (ExtensionAPI.isLambda()) {
      app.use((req, res, next) => {
        process.env.BASE_URL = `${req.headers['x-forwarded-proto'] || req.protocol}://${req.headers['host']}${req.baseUrl}`;
        next();
      });
    }
    app.use(async (req, res, next) => {
      (await router)(req, res, next);
    });

    process.on('SIGTERM', () => process.exit(0));
    process.on('SIGINT', () => process.exit(0));

    return app;
  }
  /**
   * Init serverless-http framework to deploy the extension as AWS Lambda
   * @param app
   * @param options an object like {binary: ['application/json', 'image/*']}, see: https://github.com/dougmoscrop/serverless-http/blob/master/docs/ADVANCED.md
   */
  static initLambda(app: express.Application, options?: any) {
    if (options) {
      return require('serverless-http')(app, options);
    }
    return require('serverless-http')(app);
  }
  static createCollection<T extends object>(defaultName: string, key: string, ttlKey?: string, ttl?: number): PersistentCollection<T> {
    if (process.env.MONGO_URL) {
      return new MongoCollection<T>({
        mongoUrl: process.env.MONGO_URL,
        db: process.env.MONGO_DB || 'extensions',
        name: process.env.MONGO_COLLECTION || defaultName,
        key,
        ttlKey,
        ttl
      });
    } else {
      return new DynamoTable<T>({
        region: process.env.DYNAMO_REGION || 'eu-central-1',
        name: process.env.DYNAMO_TABLE || camelcase(`channel-${defaultName}`, { pascalCase: true }),
        create: true,
        key,
        ttlKey,
        ttl
      });
    }
  }
}

export abstract class ExtensionBaseOperation extends Operation {
  api: ExtensionAPI;

  protected securityValidator(req: APIRequest, res: APIResponse, next: NextFunction) {
    if (process.env.TOKEN && (!req.headers.authorization || req.headers.authorization !== `Bearer ${process.env.TOKEN}`)) {
      next(API.newError(401, 'unauthorized'));
    } else {
      super.securityValidator(req, res, next);
    }
  }
}

export interface ExtensionBaseOperationProxyOptions {
  resource: Resource;
  api: string;
  operation: string;
  requestDescription: string;
  responseDescription?: string;
  method?: Method;
  jsonBodyLimit?: string;
}
export class ExtensionBaseOperationProxy extends ExtensionBaseOperation {
  constructor(protected opts: ExtensionBaseOperationProxyOptions) {
    super(opts.resource, `/${opts.operation}`, opts.method || 'post', opts.operation, opts);
  }
  protected getCustomInfo(opts?: ExtensionBaseOperationProxyOptions): OpenAPIV3.OperationObject {
    return {
      description: opts.requestDescription,
      requestBody: {
        content: {
          'application/json': {
            schema: { $ref: `#/components/schemas/protocol/definitions/${opts.api}/definitions/${opts.operation}Request` }
          }
        },
        required: true
      },
      responses: {
        '200': {
          description: opts.requestDescription || 'Operation result',
          content: {
            'application/json': {
              schema: { $ref: `#/components/schemas/protocol/definitions/${opts.api}/definitions/${opts.operation}Response` }
            }
          }
        }
      }
    };
  }
  protected createJSONParser() {
    if (this.opts.jsonBodyLimit) {
      return jsonParser({ limit: this.opts.jsonBodyLimit });
    } else {
      return super.createJSONParser();
    }
  }
  async handler(req: APIRequest, res: APIResponse, next: NextFunction) {
    try {
      if (this.opts.operation in this.api) {
        res.json(
          await this.api[this.opts.operation](req.body, {
            req,
            res
          })
        );
      } else {
        throw API.newError(501, 'Not implemented');
      }
    } catch (e) {
      next(e);
    }
  }
}

class ExtensionOperationSettings extends ExtensionBaseOperation {
  constructor(resource: Resource) {
    super(resource, '/settings', 'get', 'settings');
  }
  protected getCustomInfo(): OpenAPIV3.OperationObject {
    return {
      description: 'Retrieve the settings schema',
      responses: {
        '200': {
          description: 'Settings schema',
          content: {
            'application/json': {
              schema: {
                type: 'object'
              }
            }
          }
        }
      }
    };
  }
  async handler(req: APIRequest, res: APIResponse, next: NextFunction) {
    try {
      if (isIExtensionSettings(this.api)) {
        res.json(await this.api.settings({ req, res }));
      } else {
        throw API.newError(501, 'Not implemented');
      }
    } catch (e) {
      next(e);
    }
  }
}

class ExtensionOperationSettingsClient extends ExtensionBaseOperation {
  constructor(resource: Resource) {
    super(resource, '/settings-client', 'get', 'settingsClient');
  }

  /**
   * Express middlware that uses Mustache to render templates in html pages, refering environment vars
   * @param {*} req
   * @param {*} res
   * @param {*} next
   */
  async mustacheMiddleware(req: APIRequest, res: APIResponse, next: express.NextFunction) {
    try {
      let reqPath = req.path;
      if (req.path === '/') {
        reqPath = '/index.html';
      }
      if (reqPath.endsWith('.html')) {
        const file: string = await new Promise((resolve, reject) => {
          const filePath = path.join(this.api.settingsClientPath, reqPath);
          readFile(filePath, 'utf8', (err, data) => {
            if (err) {
              reject(err);
            } else {
              resolve(data);
            }
          });
        });
        res.send(mustache.render(file, Object.assign({}, process.env, { BASE_URL: this.api.baseURL(req) })));
      } else {
        next();
      }
    } catch (error) {
      req.logger.error('error parsing mustache template', error);
      next();
    }
  }
  protected getCustomInfo(): OpenAPIV3.OperationObject {
    return {
      description: 'Retrieve the settings schema',
      responses: {
        '200': {
          description: 'Settings client',
          content: {
            'text/html': {}
          }
        }
      }
    };
  }
  protected securityValidator(req: APIRequest, res: APIResponse, next: NextFunction) {
    next();
  }
  async router(router: Router): Promise<Router> {
    let client = Router();
    const middlewares: APIRequestHandler[] = [];
    if (this.useSecurityValidator()) {
      middlewares.push(this.securityValidator.bind(this));
    }
    client.use(...middlewares, this.mustacheMiddleware.bind(this), express.static(this.api.settingsClientPath));
    router.use(this.path, client);
    return router;
  }
  async handler(req: APIRequest, res: APIResponse, next: NextFunction) {
    // NOOP
  }
}

class ExtensionOperationAssets extends ExtensionBaseOperation {
  constructor(resource: Resource) {
    super(resource, '/assets', 'get', 'assets');
  }
  protected getCustomInfo(): OpenAPIV3.OperationObject {
    return {
      description: 'Retrieve a static asset'
    };
  }
  protected securityValidator(req: APIRequest, res: APIResponse, next: NextFunction) {
    next();
  }
  async router(router: Router): Promise<Router> {
    let assets = Router();
    const middlewares: APIRequestHandler[] = [];
    if (this.useSecurityValidator()) {
      middlewares.push(this.securityValidator.bind(this));
    }
    assets.use(...middlewares, express.static(this.api.assetsPath));
    router.use(this.path, assets);
    return router;
  }
  async handler(req: APIRequest, res: APIResponse, next: NextFunction) {
    // NOOP
  }
}
