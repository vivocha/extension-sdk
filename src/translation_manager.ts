import { TranslationManagerAPITypes } from "@vivocha/public-types"
import { API, APIRequest, APIResponse, Resource } from 'arrest';
import { NextFunction, Router, RouterOptions } from 'express';
import { OpenAPIV3 } from 'openapi-police';
import { APIContext, ExtensionAPI, ExtensionBaseOperation, IExtensionSettings } from './extension';

export interface ITranslationManagerAPI {
  translation(
    request: TranslationManagerAPITypes.Translate.Request,
    context: APIContext
  ): Promise<TranslationManagerAPITypes.Source[]>;
  detect(request: TranslationManagerAPITypes.Detect.Request, context: APIContext): Promise<TranslationManagerAPITypes.Language[]>;
  languages(context: APIContext):Promise<TranslationManagerAPITypes.LanguagesByDirection>;
}

export abstract class TranslationManagerAPI extends ExtensionAPI implements IExtensionSettings, ITranslationManagerAPI {
  abstract settings(context: APIContext): OpenAPIV3.SchemaObject;
  abstract translation(
    request: TranslationManagerAPITypes.Translate.Request,
    context: APIContext
  ): Promise<TranslationManagerAPITypes.Translate.Response>;
  abstract detect(request: TranslationManagerAPITypes.Detect.Request, context: APIContext): Promise<TranslationManagerAPITypes.Language[]>;
  // abstract languages(request: TranslationManagerAPITypes.Detect.Request, context: APIContext): Promise<TranslationManagerAPITypes.Detect.Response>;
  abstract languages(context: APIContext):Promise<TranslationManagerAPITypes.LanguagesByDirection>;

  router(options?: RouterOptions): Promise<Router> {
    const resource: Resource = new Resource({
      name: "translate",
      namePlural: "translate"
    });
    resource.addOperation(new LanguageTranslate(resource));
    resource.addOperation(new LanguageDetect(resource));
    resource.addOperation(new LanguageList(resource));

    this.addResource(resource);
    return super.router(options);
  }
}

class LanguageTranslate extends ExtensionBaseOperation {
  api: TranslationManagerAPI;

  constructor(resource: Resource) {
    super(resource, '/translation', 'post', 'translation');
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
            schema: { $ref: '#/components/schemas/protocol/definitions/translationManagerAPI/definitions/translationRequest' }
          }
        }
      },
      responses: {
        '200': {
          description: 'The detected language',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/protocol/definitions/translationManagerAPI/definitions/translationResponse' }
            }
          }
        }
      }
    };
  }
  async handler(req: APIRequest, res: APIResponse, next: NextFunction) {
    try {
      await this.api.translation(req.body, { req, res });
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
class LanguageList extends ExtensionBaseOperation {
  api: TranslationManagerAPI;

  constructor(resource: Resource) {
    super(resource, '/languages', 'get', 'languages');
  }
  protected getCustomInfo(): OpenAPIV3.OperationObject {
    return {
      description: 'Retrieve available languages',
      parameters: [{
        name: "target",
        in: "query",
        schema: { type: "string" },
        required: false
      }],
      responses: {
        '200': {
          description: 'A list of available languages',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/protocol/definitions/translationManagerAPI/definitions/languagesResponse' }
            }
          }
        }
      }
    };
  }

  async handler(req: APIRequest, res: APIResponse, next: NextFunction) {
    try {
      await this.api.languages({ req, res });
    } catch (e) {
      next(e);
    }
  }
}