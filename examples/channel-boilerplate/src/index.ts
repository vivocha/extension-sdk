import {
  APIContext,
  APIRequest,
  APIResponse,
  ChannelAPI,
  ChannelAPITypes,
  ExtensionAPI,
  ExtensionAPITypes,
  getLogger,
  Message,
  OpenAPIV3,
  Operation,
  Resource
} from '@vivocha/extension-sdk';
import { NextFunction, Router, RouterOptions } from 'express';
import { readFileSync } from 'fs';
import { DummyChannelRecord, DummyChannelSettings } from './types';

// loads package.json object to get Channel name and version
const meta = JSON.parse(readFileSync(`${process.cwd()}/package.json`).toString('utf8'));

/**
 * Channel Class declaration, extends ChannelAPI with the record type representing the channel settings
 * document to be saved in the collection as specified in the ExtensionAPI.createCollection() method called
 * in the constructor.
 */
class DummyChannel extends ChannelAPI<DummyChannelRecord> {
  constructor() {
    // The super constructor sets some Channel info data
    super(
      {
        title: meta.name,
        version: meta.version,
        contact: {
          name: 'Vivocha',
          email: 'dev@vivocha.com'
        },
        // The following properties are
        // type: for a channel always  must be channel
        // subtype: the name of the channel
        // icons: the icons set representing the channel in Vivocha included in the assets folder
        'x-vivocha': {
          type: 'channel',
          subType: 'dummy_channel',
          icons: {
            extension: 'dummy.svg',
            instance: {
              dark: 'channel_dark.svg',
              light: 'channel_light.svg',
              color: 'channel_color.svg'
            }
          }
        }
      },
      // Create the collection to save the Channel settings (collection_name, index_property)
      // Database is specified on the MONGO_URL parameter at launch. Otherwise by default aws dynamo database is used.
      ExtensionAPI.createCollection<DummyChannelRecord>('dummy_channel', 'serviceId')
    );
    // load the multilanguage strings used in the Vivocha Channel UI in Campaign Builder
    this.loadStrings(`${__dirname}/../data/strings.json`);
    // set assets path (e.g. the icons)
    this.assetsPath = `${__dirname}/../assets`;
    // set logger
    this.logger = getLogger('vivocha.channel.dummy-channel');
  }
  router(options?: RouterOptions): Promise<Router> {
    // create Webhook resource and add the operations to receive data from the third party service which this Channel represents
    const resource: Resource = new Resource({
      name: 'Webhook',
      namePlural: 'Webhook'
    });
    resource.addOperation(new DummyChannelWebhook(resource));
    // If third party service needs to validate the webhook, a validation operations should be added
    // resource.addOperation(new DummyChannelValidationWebhook(resource));

    this.addResource(resource);
    return super.router(options);
  }
  /**
   * Capabilities represents the description of what the channel can do: type of message, direction etc.
   * [See capabilities documentation here]{@link https://github.com/vivocha/bot-sdk/tree/develop#channel-capabilities}
   * Capabilities can be obtained by calling the exposed /channel/capabilities endpoint
   * @param context
   */
  async capabilities(context: APIContext): Promise<ChannelAPITypes.Capabilities> {
    return {
      type: 'a',
      inbound: true,
      outbound: true,
      media: {
        chat: {
          isWriting: 'out',
          acks: 'in',
          attachment: 'both',
          quickReply: 'out',
          genericTemplate: 'out',
          listTemplate: 'out'
        }
      }
    };
  }

  /**
   * Settings
   * It's a JSON Schema, Vivocha needs settings to create the Campaign Builder configuration UI for the Channel.
   * Properties of this JSON Schema are equivalent to the settings defined in types and they will be obtained by calling the exposed /extension/settings endpoint
   */
  settings(): OpenAPIV3.SchemaObject {
    return {
      type: 'object',
      required: ['serviceId', 'serviceToken'],
      properties: {
        serviceId: {
          type: 'string',
          minLength: 1
        },
        serviceToken: {
          type: 'string',
          minLength: 1,
          visibility: 'toggleable'
        }
        // webhook: {
        //   type: 'string',
        //   readOnly: true
        // }
      }
    } as OpenAPIV3.SchemaObject;
  }

  /**
   * Called by Vivocha using /extension/subscribe endpoint to subscribe to the third party service. It adds the channel and saves the record on the db with the correct configuration.
   * If it is necessary to call API to register/add this channel webhook on the third party service this is the place to do that
   *
   * @param request
   * @param context
   *
   */
  async subscribe(request: ExtensionAPITypes.Subscribe.Request, context: APIContext): Promise<ExtensionAPITypes.Subscribe.Response> {
    try {
      this.logger.debug('subscribe');
      const settings = request.settings as DummyChannelSettings;
      // Here eventually call the third party service API to register this Channel webhook
      // Save the settings record
      await this.replaceRecord({
        serviceId: settings.serviceId,
        serviceToken: settings.serviceToken,
        environment: request.environment as ChannelAPITypes.Environment
      } as DummyChannelRecord);
      return {};
    } catch (err) {
      this.logger.error('subscribe failed, db error', request, err);
      throw err;
    }
  }

  /**
   * Called by Vivocha using /extension/unsubscribe endpoint to unsubscribe to the third party service.
   * If it is necessary to call API to remove this channel webhook on the third party service this is the place to do that
   * @param request
   * @param context
   */
  async unsubscribe(request: ExtensionAPITypes.Messages.Request, context: APIContext): Promise<any> {
    const settings = request.settings as DummyChannelSettings;
    try {
      this.logger.debug('unsubscribe');
      // Here eventually call the third party service API to remove this Channel webhook
      // Remove the settings record
      await this.deleteRecord(settings.serviceId);
      return {};
    } catch (err) {
      this.logger.error('unsubscribe failed, db error', request, err);
      throw err;
    }
  }
  /**
   * Called by Vivocha end a message from Vivocha TO third party service (to the final user).
   * Message should be converted Vivocha format to the third party message format
   * @param message
   * @param context
   */
  async message(message: ChannelAPITypes.Message.Request, context: APIContext): Promise<ChannelAPITypes.Message.Response> {
    this.logger.info('Received message from Vivocha: ', message);
    try {
      // TODO Convert the Vivocha message in the third party message format
      // TODO call the third party API to send the message
      return {};
    } catch (error) {
      this.logger.error('Error sending message to third party service', error);
      throw error;
    }
  }

  // Called from the webhook handler when a message from the third party service is received
  async onChannelMessage(req: APIRequest, res: APIResponse, next: NextFunction) {
    this.logger.debug('Received message from Third Party service', req.headers, JSON.stringify(req.body, null, 2));

    // The third party message here will be encapsulated in a Vivocha message and posted to webhook
    try {
      const msg = req.body;

      const payload: Message = {
        code: 'message',
        ts: new Date(),
        type: 'text',
        agent: false,
        body: msg.text // third party message received and encapsulated
      };

      const record: DummyChannelRecord = await this.getRecord(req.params.serviceId);
      // from third party service
      // sender properties are obtained from the third party APIRequest body message (e.g. req.body)
      const context = {
        sender: {
          id: 'sender-001', // get the real sender id from the APIRequest body message
          nickname: 'dummy-user', // get the real sender nickname from the APIRequest body message
          firstname: 'Dummy', // get the real sender firstname from the APIRequest body message
          lastname: 'Dummy' // get the real sender lastname from the APIRequest body message
        },
        recipient: {
          id: 'recipient-002' // get the real sender recipient from the APIRequest body message
        }
      };
      this.logger.debug('sendMessageToVivocha', 'sending', JSON.stringify(payload, null, 2));

      // call the Vivocha API to send the message received by the Channel
      this.postToWebhook(record.environment, 'message', context, payload);
    } catch (error) {
      this.logger.error('Error sending message to vivocha', error);
    }
  }
}

/**
 * Webhook class that extends Operation to receive messages from Third Party service. This webhook should be set in the third party service configuration
 * Refers to DummyChannel resource class constructor above
 */
class DummyChannelWebhook extends Operation {
  api: DummyChannel;
  constructor(resource: Resource) {
    super(resource, '/:campaignId/:serviceId', 'post', 'dummyChannelEvent');
  }

  protected getCustomInfo(opts?: any): OpenAPIV3.OperationObject {
    return {
      description: 'Dummy Channel message webhook endpoint',
      requestBody: {
        content: {
          'application/json': {
            schema: { type: 'object' }
          }
        },
        required: true
      },
      responses: {
        '200': {
          description: 'Message processed'
        }
      }
    };
  }

  // call handler in case of an incoming message from the third party service
  async handler(req: APIRequest, res: APIResponse, next: NextFunction) {
    // Call method to handle the message received form the third party service
    // Refers to Dummy Channel class
    this.api.onChannelMessage(req, res, next);

    res.status(200).end();
  }
}
// /**
//  * Webhook validation Operation
//  * Vivocha sets a webhook url like: https://.../webhook/{campaignId}/{serviceId}
//  * and a validation token as:
//  */
// class DummyChannelValidationWebhook extends Operation {
//   api: DummyChannel;
//   constructor(resource: Resource) {
//     super(resource, '/:campaignId/:serviceId', 'get', 'DummyChannelValidationMessage');
//   }
//   protected getCustomInfo(opts?: any): OpenAPIV3.OperationObject {
//     return {
//       description: 'Dummy Channel Webhook validation',
//       parameters: [
//         {
//           name: 'validation_token',
//           in: 'query',
//           schema: {
//             type: 'string',
//             enum: ['subscribe']
//           },
//           required: true
//         }
//       ],
//       responses: {
//         '200': {
//           description: 'Message processed'
//         }
//       }
//     };
//   }
//
//   async handler(req: APIRequest, res: APIResponse, next: NextFunction) {
//     try {
//       req.logger.debug('registering webhook:', req.url, 'params:', JSON.stringify(req.query));
//       const record: DummyChannelRecord = await this.api.getRecord(req.params.serviceId);
//       // Write here the code to validate the webhook subscription
//       req.logger.info('webhook validated');
//       res.status(200).send('webhook validated');
//     } catch (e) {
//       next(e);
//     }
//   }
// }

const api = new DummyChannel();

// Next rows do the init and starts the Channel application
const app = ExtensionAPI.initApplication(api.router());
app.listen(parseInt(process.env.PORT) || 80);
