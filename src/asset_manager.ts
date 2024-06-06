import { AssetManagerAPITypes } from '@vivocha/public-types';
import { APIRequest, APIRequestHandler, APIResponse, Resource } from 'arrest';
import { NextFunction, Router, RouterOptions } from 'express';
import { unlinkSync } from 'fs';
import * as multer from 'multer';
import { OpenAPIV3 } from 'openapi-police';
import { APIContext, ExtensionAPI, ExtensionBaseOperation, IExtensionSettings } from './extension';

export interface IAssetManagerAPI {
  create(
    request: AssetManagerAPITypes.Create.Request,
    file: AssetManagerAPITypes.AssetInfo,
    context: APIContext
  ): Promise<AssetManagerAPITypes.Create.Response>;
  retrieve(request: AssetManagerAPITypes.Retrieve.Request, context: APIContext): Promise<any>;
  list(request: AssetManagerAPITypes.List.Request, context: APIContext): Promise<AssetManagerAPITypes.List.Response>;
  remove(request: AssetManagerAPITypes.Remove.Request, context: APIContext): Promise<any>;
  usage?(request: AssetManagerAPITypes.Usage.Request, context: APIContext): Promise<AssetManagerAPITypes.Usage.Response>;
}

export abstract class AssetManagerAPI extends ExtensionAPI implements IExtensionSettings, IAssetManagerAPI {
  abstract settings(context: APIContext): OpenAPIV3.SchemaObject;
  abstract create(
    request: AssetManagerAPITypes.Create.Request,
    file: AssetManagerAPITypes.AssetInfo,
    context: APIContext
  ): Promise<AssetManagerAPITypes.Create.Response>;
  abstract retrieve(request: AssetManagerAPITypes.Retrieve.Request, context: APIContext): Promise<any>;
  abstract list(request: AssetManagerAPITypes.List.Request, context: APIContext): Promise<AssetManagerAPITypes.List.Response>;
  abstract remove(request: AssetManagerAPITypes.Remove.Request, context: APIContext): Promise<any>;

  router(options?: RouterOptions): Promise<Router> {
    const resource: Resource = new Resource({
      name: 'Asset'
    });
    resource.addOperation(new AssetCreate(resource));
    resource.addOperation(new AssetRetrieve(resource));
    resource.addOperation(new AssetList(resource));
    resource.addOperation(new AssetRemove(resource));

    if ('usage' in this) {
      resource.addOperation(new AssetUsage(resource));
    }

    this.addResource(resource);
    return super.router(options);
  }
}

class AssetCreate extends ExtensionBaseOperation {
  api: AssetManagerAPI;

  constructor(resource: Resource) {
    super(resource, '/', 'post', 'create');
  }
  protected getBodySpec(): OpenAPIV3.MediaTypeObject {
    return {
      schema: { $ref: '#/components/schemas/protocol/definitions/assetManagerAPI/definitions/createRequest' }
    };
  }
  protected getCustomInfo(): OpenAPIV3.OperationObject {
    return {
      description: 'Upload a new asset',
      requestBody: {
        content: {
          'multipart/form-data': {
            schema: {
              allOf: [
                this.getBodySpec().schema,
                {
                  required: ['id', 'file'],
                  properties: {
                    file: {
                      type: 'string',
                      format: 'binary'
                    }
                  }
                }
              ]
            }
          }
        }
      },
      responses: {
        '200': {
          description: 'Operation successfully completed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/protocol/definitions/assetManagerAPI/definitions/createResponse' }
            }
          }
        }
      }
    };
  }
  protected createBodyValidators(): APIRequestHandler[] {
    return [
      multer({
        storage: multer.diskStorage({
          destination: process.env.UPLOADS
        })
      }).single('file'),
      (req: APIRequest, res: APIResponse, next: NextFunction) => {
        req.logger.debug('AssetCreate', 'asset', req['file']);
        if (req.body.opts) {
          Object.assign(req.body, JSON.parse(req.body.opts));
          delete req.body.opts;
        }
        next();
      },
      this.createBodyValidator('multipart/form-data', this.getBodySpec(), true)
    ];
  }
  protected errorHandler(err: any, req: APIRequest, res: APIResponse, next: NextFunction) {
    this.unlink(req);
    next(err);
  }
  async handler(req: APIRequest, res: APIResponse, next: NextFunction) {
    try {
      const asset: AssetManagerAPITypes.AssetInfo = req['file'];
      res.json(await this.api.create(req.body, asset, { req, res }));
      this.unlink(req);
    } catch (e) {
      next(e);
    }
  }
  protected unlink(req: APIRequest) {
    if (req['file']) {
      const asset: AssetManagerAPITypes.AssetInfo = req['file'];
      try {
        unlinkSync(asset.path);
      } catch (e) {}
    }
  }
}

class AssetRetrieve extends ExtensionBaseOperation {
  api: AssetManagerAPI;

  constructor(resource: Resource) {
    super(resource, '/retrieve', 'post', 'retrieve');
  }
  protected getCustomInfo(): OpenAPIV3.OperationObject {
    return {
      description: 'Retrieve an asset',
      requestBody: {
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/protocol/definitions/assetManagerAPI/definitions/retrieveRequest' }
          }
        }
      },
      responses: {
        '200': {
          description: 'The requested asset',
          content: {
            '*/*': {}
          }
        }
      }
    };
  }
  async handler(req: APIRequest, res: APIResponse, next: NextFunction) {
    try {
      await this.api.retrieve(req.body, { req, res });
    } catch (e) {
      next(e);
    }
  }
}

class AssetList extends ExtensionBaseOperation {
  api: AssetManagerAPI;

  constructor(resource: Resource) {
    super(resource, '/list', 'post', 'list');
  }
  protected getCustomInfo(): OpenAPIV3.OperationObject {
    return {
      description: 'Retrieve a list of asset metadata',
      requestBody: {
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/protocol/definitions/assetManagerAPI/definitions/listRequest' }
          }
        }
      },
      responses: {
        '200': {
          description: 'The metadata of the matching assets',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/protocol/definitions/assetManagerAPI/definitions/listResponse' }
            }
          }
        }
      }
    };
  }
  async handler(req: APIRequest, res: APIResponse, next: NextFunction) {
    try {
      res.json(await this.api.list(req.body, { req, res }));
    } catch (e) {
      next(e);
    }
  }
}

class AssetRemove extends ExtensionBaseOperation {
  api: AssetManagerAPI;

  constructor(resource: Resource) {
    super(resource, '/remove', 'post', 'remove');
  }
  protected getCustomInfo(): OpenAPIV3.OperationObject {
    return {
      description: 'Remove an asset',
      requestBody: {
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/protocol/definitions/assetManagerAPI/definitions/removeRequest' }
          }
        }
      },
      responses: {
        '200': {
          description: 'Operation successfully completed',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/protocol/definitions/assetManagerAPI/definitions/removeResponse' }
            }
          }
        }
      }
    };
  }
  async handler(req: APIRequest, res: APIResponse, next: NextFunction) {
    try {
      await this.api.remove(req.body, { req, res });
      res.end();
    } catch (e) {
      next(e);
    }
  }
}

class AssetUsage extends ExtensionBaseOperation {
  api: AssetManagerAPI;

  constructor(resource: Resource) {
    super(resource, '/usage', 'post', 'usage');
  }
  protected getCustomInfo(): OpenAPIV3.OperationObject {
    return {
      description: 'Calculate the current size of stored assets',
      requestBody: {
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/protocol/definitions/assetManagerAPI/definitions/usageRequest' }
          }
        }
      },
      responses: {
        '200': {
          description: 'Total size in bytes of matching Assets',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/protocol/definitions/assetManagerAPI/definitions/usageResponse' }
            }
          }
        }
      }
    };
  }
  async handler(req: APIRequest, res: APIResponse, next: NextFunction) {
    try {
      res.json(await this.api['usage'](req.body, { req, res }));
    } catch (e) {
      next(e);
    }
  }
}
