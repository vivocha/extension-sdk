import { TranslationManagerAPITypes } from '@vivocha/public-entities';
import { APIRequest, APIResponse, Resource } from 'arrest';
import { NextFunction, Router, RouterOptions } from 'express';
import { OpenAPIV3 } from 'openapi-police';
import { APIContext, ExtensionAPI, ExtensionBaseOperation, IExtensionSettings } from './extension';

export interface ITranslationManagerAPI {
  translate(
    request: TranslationManagerAPITypes.Translate.Request,
    context: APIContext
  ): Promise<TranslationManagerAPITypes.Translate.Response>;
  detect(request: TranslationManagerAPITypes.Detect.Request, context: APIContext): Promise<TranslationManagerAPITypes.Detect.Response>;
}

export abstract class TranslationManagerAPI extends ExtensionAPI implements IExtensionSettings, ITranslationManagerAPI {
  abstract settings(context: APIContext): OpenAPIV3.SchemaObject;
  abstract translate(
    request: TranslationManagerAPITypes.Translate.Request,
    context: APIContext
  ): Promise<TranslationManagerAPITypes.Translate.Response>;
  abstract detect(request: TranslationManagerAPITypes.Detect.Request, context: APIContext): Promise<TranslationManagerAPITypes.Detect.Response>;

  router(options?: RouterOptions): Promise<Router> {
    const resource: Resource = new Resource({
      name: "language",
      namePlural: "language"
    });
    resource.addOperation(new LanguageTranslate(resource));
    resource.addOperation(new LanguageDetect(resource));

    this.addResource(resource);
    return super.router(options);
  }
}

class LanguageTranslate extends ExtensionBaseOperation {
  api: TranslationManagerAPI;

  constructor(resource: Resource) {
    super(resource, '/translate', 'post', 'translate');
  }
  protected getBodySpec(): OpenAPIV3.MediaTypeObject {
    return {
      schema: { $ref: '#/components/schemas/protocol/definitions/translationManagerAPI/definitions/translateRequest' }
    };
  }
  protected getCustomInfo(): OpenAPIV3.OperationObject {
    return {
      description: 'Detect the resource language',
      requestBody: {
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/protocol/definitions/translationManagerAPI/definitions/translateRequest' }
          }
        }
      },
      responses: {
        '200': {
          description: 'The detected language',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/protocol/definitions/translationManagerAPI/definitions/translateResponse' }
            }
          }
        }
      }
    };
  }
  async handler(req: APIRequest, res: APIResponse, next: NextFunction) {
    try {
      await this.api.translate(req.body, { req, res });
    } catch (e) {
      next(e);
    }
  }
}

class LanguageDetect extends ExtensionBaseOperation {
  api: TranslationManagerAPI;

  constructor(resource: Resource) {
    super(resource, '/detect', 'post', 'detect');
  }
  protected getCustomInfo(): OpenAPIV3.OperationObject {
    return {
      description: 'Detect the resource language',
      requestBody: {
        content: {
          'application/json': {
            schema: { $ref: '#/components/schemas/protocol/definitions/translationManagerAPI/definitions/detectRequest' }
          }
        }
      },
      responses: {
        '200': {
          description: 'The detected language',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/protocol/definitions/translationManagerAPI/definitions/detectResponse' }
            }
          }
        }
      }
    };
  }
  async handler(req: APIRequest, res: APIResponse, next: NextFunction) {
    try {
      await this.api.detect(req.body, { req, res });
    } catch (e) {
      next(e);
    }
  }
}