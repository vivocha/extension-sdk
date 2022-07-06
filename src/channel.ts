import { ChannelAPITypes, ExtensionAPITypes } from '@vivocha/public-entities';
import { APIRequest, APIResponse, Resource } from 'arrest';
import { createHash } from 'crypto';
import { NextFunction, Router, RouterOptions } from 'express';
import { statSync } from 'fs';
import needle from 'needle';
import { OpenAPIV3 } from 'openapi-police';
import { APIContext, ExtensionAPI, ExtensionBaseOperation, ExtensionBaseOperationProxy, IExtensionAsynchronous, IExtensionSettings } from './extension.js';

export interface IChannelAPI {
  capabilities(context: APIContext): Promise<ChannelAPITypes.Capabilities>;
  message?(request: ChannelAPITypes.Message.Request, context: APIContext): Promise<ChannelAPITypes.Message.Response>;
  notify?(request: ChannelAPITypes.Notify.Request, context: APIContext): Promise<ChannelAPITypes.Notify.Response>;
  allocateNumber?(request: ChannelAPITypes.AllocateNumber.Request, context: APIContext): Promise<ChannelAPITypes.AllocateNumber.Response>;
}

export abstract class ChannelAPI<Record extends object = any, TempRecord extends object = any>
  extends ExtensionAPI<Record, TempRecord>
  implements IExtensionSettings, IExtensionAsynchronous, IChannelAPI
{
  abstract settings(context: APIContext): OpenAPIV3.SchemaObject;
  abstract subscribe(request: ExtensionAPITypes.Subscribe.Request, context: APIContext): Promise<ExtensionAPITypes.Subscribe.Response>;
  abstract unsubscribe(request: ExtensionAPITypes.Messages.Request, context: APIContext): Promise<any>;
  abstract capabilities(context: APIContext): Promise<ChannelAPITypes.Capabilities>;

  router(options?: RouterOptions): Promise<Router> {
    const resource: Resource = new Resource({
      name: 'Channel',
      namePlural: 'Channel'
    });

    resource.addOperation(new ChannelOperationCapabilities(resource));

    if ('message' in this) {
      resource.addOperation(
        new ExtensionBaseOperationProxy({
          resource,
          api: 'channelAPI',
          operation: 'message',
          requestDescription: 'Send a message to the remote party',
          responseDescription: 'Message sent',
          jsonBodyLimit: '5mb'
        })
      );
    }

    if ('notify' in this) {
      resource.addOperation(
        new ExtensionBaseOperationProxy({
          resource,
          api: 'channelAPI',
          operation: 'notify',
          requestDescription: 'Send a protocol event to the remote party',
          responseDescription: 'Event sent'
        })
      );
    }

    if ('allocateNumber' in this) {
      resource.addOperation(
        new ExtensionBaseOperationProxy({
          resource,
          api: 'channelAPI',
          operation: 'allocateNumber',
          requestDescription: 'Allocate a dedicated phone number for an inbound call',
          responseDescription: 'Number allocated'
        })
      );
    }

    this.addResource(resource);
    return super.router(options);
  }
  async uploadMedia(environment: ChannelAPITypes.Environment, path: string, mimetype: string, originalname?: string): Promise<string> {
    const id = `attachments/${createHash('sha256')
      .update(environment.acct_id + path + mimetype + (originalname || ''))
      .digest('hex')}`;

    const url = id ? `${environment.apiUrl}/assets?id=${id}` : `${environment.apiUrl}/assets`;

    // read the file and create a stream with needle
    const stream = needle.get(path); // needle.<method> returns a stream

    const formData = {
      file: {
        value: stream,
        options: {
          contentType: mimetype,
          knownLength: statSync(path).size
        }
      }
    };

    if (originalname) {
      (formData.file.options as any).filename = originalname;
    }

    const result = await needle('post', url, formData, {
      multipart: true,
      headers: {
        authorization: `Bearer ${environment.token}`,
        'Content-Length': statSync(path).size,
        'Content-Type': mimetype
      }
    });

    return result.body.url;
  }
}

class ChannelOperationCapabilities extends ExtensionBaseOperation {
  api: ChannelAPI;

  constructor(resource: Resource) {
    super(resource, '/capabilities', 'get', 'capabilities');
  }
  protected getCustomInfo(): OpenAPIV3.OperationObject {
    return {
      description: 'Retrieve the channel capabilities',
      responses: {
        '200': {
          description: 'Settings schema',
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/protocol/definitions/channelAPI/definitions/capabilities' }
            }
          }
        }
      }
    };
  }
  async handler(req: APIRequest, res: APIResponse, next: NextFunction) {
    try {
      res.json(await this.api.capabilities({ req, res }));
    } catch (e) {
      next(e);
    }
  }
}
