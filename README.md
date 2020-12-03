# Vivocha Extension SDK

_JavaScript / TypeScript SDK to create **Extensions** and **Channels** for the [Vivocha](https://www.vivocha.com) platform_.

|              ![Logo](https://raw.githubusercontent.com/vivocha/extension-sdk/master/docs/img/extension-sdk.svg?sanitize=true)              |
| :----------------------------------------------------------------------------------------------------------------------------------------: |
| [![NPM version](https://img.shields.io/npm/v/@vivocha/extension-sdk.svg?style=flat)](https://www.npmjs.com/package/@vivocha/extension-sdk) |

---

> **IMPORTANT**: The Extension SDK is intended to be used to develop Extensions and Channels for the Vivocha Platform **version > 7.x**

## Node Version

> **Tested with Node.js version 12.x**.

To start with the Extension SDK, it is recommended to install it from NPM:

```sh
npm i @vivocha/extension-sdk
```

---

The Vivocha Extension SDK allows to write Extensions and new communication Channels to be integrated in the Vivocha Platform.

Examples of extensions include Asset Managers, external services; channels are special extensions targeted to act as a "proxy" to a communication channel to exchange messages using an external service. Examples of channels can be those which communicates with Twitter, Facebook Messenger, Slack and so on...
Extensions and Channels developed using this SDK automatically expose a well-defined REST API called by Vivocha for the whole life-cycle of the extension (subscribing, deleting, etc...); and, to send/receive messages to/from external platforms.

---

## Table of Contents

- [Vivocha Extension SDK](#vivocha-extension-sdk)
  - [Node Version](#node-version)
  - [Table of Contents](#table-of-contents)
  - [Overview](#overview)
  - [What is an Extension](#what-is-an-extension)
    - [Persistence](#persistence)
      - [Configuring Persistence](#configuring-persistence)
      - [Using Persistence](#using-persistence)
    - [Extension API](#extension-api)
    - [Sending Messages to Vivocha](#sending-messages-to-vivocha)
    - [Sending Media Attachments to Vivocha](#sending-media-attachments-to-vivocha)
    - [Running an Extension or a Channel](#running-an-extension-or-a-channel)
  - [What is a Channel](#what-is-a-channel)
    - [Channel Lifecycle](#channel-lifecycle)
    - [Channel API](#channel-api)
      - [Capabilities](#capabilities)
      - [Multilanguage Strings](#multilanguage-strings)
      - [Assets](#assets)
      - [Settings](#settings)
      - [Settings Client](#settings-client)
      - [Subscribe Method](#subscribe-method)
      - [Unsubscribe Method](#unsubscribe-method)
      - [Message Method](#message-method)
      - [Webhook](#webhook)
    - [How to Write a Channel: Quick Start](#how-to-write-a-channel-quick-start)
      - [Steps to Write a Channel](#steps-to-write-a-channel)
    - [[TODO: running the example and write conclusions]](#todo-running-the-example-and-write-conclusions)

---

## [Overview](#overview)

The Vivocha Extension SDK allows to write custom **Extensions** and communication **Channels** to integrate with the Vivocha Platform. Extensions are external services integrations to be added to a particular Vivocha account, and Channels are communication channels by which end-users can chat with agents through Vivocha.

An Extension, and a Channel, developed using the SDK "automagically" exposes a well-defined REST API completely described by the [OpenAPI specification](https://github.com/OAI/OpenAPI-Specification/blob/master/versions/3.0.2.md).

When the developed Extension or Channel is deployed and available at a specific URL, the OpenAPI description is always available at `http(s)://<URL>/openapi.json`.

It is important to know that a communication Channel is an Extension subclass, therefore it inherits all its basic functionalities.

## [What is an Extension](#what-is-an-extension)

An Extension can be seen as a standalone external service proxy which adds and manage a set of functionalities to be added to the Vivocha Platform.

The developed Extension is responsable to communicate with the External Service Platform which represents. Examples of particular extensions can be: an asset manager to upload and retrieve media assets to/from a cloud-based storage service, or a chat channel, like WhatsApp, or FB Messenger.

This Extension SDK provides a base class named `ExtensionAPI`, which defines the interface and basic functions common to all the extensions (and consequently, all the channels) that subclasses must implement and expose to become a compliant Vivocha Extension.

Basically, an Extension receives API calls from Vivocha, it communicates with the External Service Platform it proxies, and calls Vivocha API endpoints to forward events coming from that External Service.

The next picture shows where an Extension collocates in the Vivocha flow, and the main exposed API endpoints.

| ![Extension API](https://raw.githubusercontent.com/vivocha/extension-sdk/master/docs/img/extension.svg?sanitize=true) |
| :-------------------------------------------------------------------------------------------------------------------: |
|                               **FIGURE 1 - Extension and Extension API main endpoints**                               |

### [Persistence](#persistence)

Extensions need to persist data, at least the settings to configure a particular extension instance (or channel instance), when it is configured and saved using the Vivocha Campaign Builder.

For example, it is necessary to store information like an appId, or an API token, or other credentials used to call the External Service Platform.

Moreover, it may be necessary to persist also temporary, volatile, data; for example, message ids to correlate "delivered" or "read" messages coming from extensions or channels in a second time.

The `ExtensionAPI` class provides all the needed methods to persist data to a database: by default the Extension SDK will try to persist data to specified collections in a **AWS DynamoDB** reachable instance; but, if the `MONGO_URL` environment variable is set to a runnning MongoDB instance URL, then **MongoDB** engine is used, instead.

#### [Configuring Persistence](#configuring-persistence)

Collections can be passed to the `ExtensionAPI` class constructor.
Collections can be created using the following class methods:

```typescript
static createCollection<T extends object>(defaultName: string, key: string, ttlKey?: string, ttl?: number): PersistentCollection<T>;
```

where:

`T` is the type of the record to persist. Usually contains the extension/channel required settings (entered in Vivocha Campaign Builder at configuration-time) and the `environment` object, sent by Vivocha in each request to Extension/Channel API;

`defaultName` is the collection name;

`key` is the object property name to use as DB index;

`ttlKey` (optional, usually used for temporary persistence) is the record Time-To-Live index (set to `null` if not needed);

`ttl` (optional, usually used for temporary persistence) is the record Time-To-Live millis after that the temp record is automatically deleted;

**Example**: setting persistence and temporary persistence for an hypothetic Twitter channel:

```typescript
ExtensionAPI.createCollection<TwitterRecord>('twitter', 'appId');

ExtensionAPI.createCollection<TwitterTempRecord>('twitter_temp', 'screenName', null, 12 * 60 * 60 * 1000);
```

#### [Using Persistence](#using-persistence)

The `ExtensionAPI` class provides the following methods to manage persistence:

```typescript
getRecord(key: string): Promise<Record>

deleteRecord(key: string): Promise<any>

replaceRecord(record: Record): Promise<Record>
```

where `record` is the persisted data object and `key` is the record property name chosen as index;

And, to manage temporary data persistence it provides the following methods:

```typescript
getTempRecord(key: string): Promise<Record>

deleteTempRecord(key: string): Promise<any>

replaceTempRecord(record: Record): Promise<Record>
```

where `record` is the persisted temp data object and `key` is the record property name chosen as index.

---

### [Extension API](#extension-api)

The `ExtensionAPI` class defines the interface and the core methods common to all the Extensions and Channels, API endpoints included.

Some methods of this class are optional. Therefore, only the implemented methods (in subclasses) are also exposed as API endpoints.

Along with the methods related to [Persistence (see above)](#persistence), the `ExtensionAPI` class also provides facility methods to send messages and media attachments to Vivocha.

As written above, the `ExtensionAPI` class defines the interface and basic functions common to all the Extensions, Channels included.
Thus, please refer to [Channel API](#channel-api) section to discover the details about each method and the related API endpoints.

### [Sending Messages to Vivocha](#sending-messages-to-vivocha)

When an Extension/Channel receives a message from the connected External Service Platform (supposedly through the exposed Webhook endpoint), the Extension/Channel should perform two tasks:

1. **convert** the received, platform-specific message content to the corresponding Vivocha Message format;
2. **send** the converted message to Vivocha.

Step 2 can be fulfilled calling the `ExtensionAPI` `postToWebHook()` method. See `/src/extension.ts` code for details and signature.

### [Sending Media Attachments to Vivocha](#sending-media-attachments-to-vivocha)

When an Extension/Channel receives a message/event containing a media attachment (images, videos, documents, ...) from the connected External Service Platform (supposedly through the Extension/Channel exposed Webhook endpoint), the Extension/Channel must perform two tasks:

1. **convert** the received, platform-specific attachment content to the corresponding Vivocha Message format;
2. **send** the converted media attachment message to Vivocha.

Step 2 can be fulfilled calling the `ExtensionAPI` `postMediaToWebHook()` method. See `/src/extension.ts` code for details and signature.

### [Running an Extension or a Channel](#running-extension-or-a-channel)

To run an Extension or a Channel you need to specify which database engine to use and the port to which listen.

By default the running code will try to connect to a AWS DynamoDB instance, unless MongoDB is specified.
To use MongoDB just use the `MONGO_URL` environment property.

For example:

```sh
MONGO_URL=mongodb://<server>:37017 PORT=8889 node dist/index
```

Sometimes, for example at development time, you run your Extension or Channel locally, under an NGROK tunnel. Then, you need to run it specifying the base URL from which your channel is available (it will be used also to generate the public webhook URL to set in the External Service Platform).

To set the base URL, just use the corresponding environment variable, like in:

```sh
BASE_URL=https://<public-url> MONGO_URL=mongodb://<server>:37017 PORT=8889 node dist/index
```

For example:

```sh
BASE_URL=https://abcd123.ngrok.io MONGO_URL=mongodb://<server>:37017 PORT=8889 node dist/index
```

## [What is a Channel](#what-is-channel)

Channels are a particular type of Extension created subclassing the `ChannelAPI` class.

A Channel acts like a proxy between Vivocha and an External messaging (chat) Service, e.g., Twitter or Facebook Messenger, and so on... . A Channel has the responsibility to receive and adapt messages and events coming from the External Service and to send them to Vivocha; and, to receive and adapt messages coming from Vivocha and to forward them to the External messaging Service using the right format. A Channel instance automatically exposes an API, fully described by the OpenAPI specification, as already written, which provides endpoints to fully manage the Channel entire lifecycle.

For an higher-level overview about Channels in the Vivocha Platform, please read the [Channel documentation](https://docs.vivocha.com/vcb-channels).

### [Channel Lifecycle](#channel-lifecycle)

The following sequence diagram shows a typical Channel lifecycle in Vivocha, from adding it as an Extension, to the end, when the channel is deleted.

| ![Channel Lifecycle](https://raw.githubusercontent.com/vivocha/extension-sdk/master/docs/img/channel-flow.svg?sanitize=true) |
| :--------------------------------------------------------------------------------------------------------------------------: |
|                                          **FIGURE 2 - A typical Channel lifecycle**                                          |

After you developed and run a new Channel extending the right classes of this Extension SDK (remember: a Channel is a particular type of Extension, thus **a Channel IS an Extension**), as result the running Channel is available at a given URL and it automatically self-describes its API using the OpenAPI JSON format.

As reported in the previous figure, the flow for a typical Vivocha Channel lifecycle has the following steps:

1. through the Vivocha Campaign Builder, it is possible to add the Channel entering its URL + `/openapi.json` path;
2. Vivocha automatically calls the `/openapi.json` endpoint, parses the OpenAPI description and it downloads the required assets (e.g. icons);
3. through the Vivocha Campaign Builder, a new Channel entrypoint instance is created for the Channel;
4. Vivocha calls the Channel `/extension/settings` endpoint (or, optionally the `/extension/settings-client`, in case of a custom settings client, read more in the sections below in this document) to on-the-fly build and show a configuration UI in teh Campaign Builder to add the Channel entrypoint instance;
5. on entrypoint save, Vivocha calls the `/extension/subscribe` endpoint with entered settings and all the required properties to make the subscription and save the Channel instance;
6. the Channel code saves the configured instance settings to the database (AWS DynamoDb or MongoDB);
7. (optionally) the Channel eventually calls the specific External Service APIs to register the channel instance in that platform, like registering the Channel webhook that will be called as end-users send messages using the External Service;
8. steps from 8 to 11 are asynchronous and repeated as messages flow between the Vivocha Platform and the External Service Platform that the Channel represents. In other words, sequential steps 10 and 11 can happen before sequential steps 8 and 9, and viceversa. Step 8: Vivocha calls the `/channel/message` endpoint to send a message to the Channel;
9. the Channel calls a specific External Service API endpoint to send the Vivocha message to the end-user; the Channel code has the responsibility to convert the received Vivocha message to the required message format, which is platform-specific for the referenced External Service;
10. at any time, when the end-user sends a message, the External Platform calls the Channel Webhook to forward the message to it;
11. the Channel converts the specific message body to the Vivocha Message format and sends it to the Vivocha platform, calling the methods provided by this Extension SDK (`postToWebHook()` or `postMediaToWebhook()`);
12. using the Vivocha Campaign Builder, it is possible to delete the Channel entrypoint instance;
13. then, Vivocha calls the Channel `/extension/unsubscribe` endpoint;
14. the Channel deletes the corresponding record from the database;
15. (optionally) the Channel eventually calls a specific External Platform API endpoint to unsubscribe and clean that channel configuration from that Service;

### [Channel API](#channel-api)

A Channel is an Extension subclass that inherits all its methods (and API endpoints), adding also other functionalities, like a `message` operation, used to send message to the External communication Service.
The following figure shows how a Channel positions in the Vivocha flow and which are the main exposed API endpoints.

| ![Channel API](https://raw.githubusercontent.com/vivocha/extension-sdk/master/docs/img/channel.svg?sanitize=true) |
| :---------------------------------------------------------------------------------------------------------------: |
|                               **FIGURE 3 - Channel and Channel API main endpoints**                               |

Next table lists the main Channel instance methods, and the API endpoints corresponding to each method.

| Class Methods                  | API Endpoints            | DESCRIPTION                                                                                                                                                                 |
| ------------------------------ | ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `capabilities()`               | `/channel/capabilities`  | Returns Channel capabilities that represent the description of what the channel can do in terms communication type, in term of messages and messages flow direction         |
| `settings()`                   | `/extension/settings`    | Returns the configuration settings description (JSON Schema) about the Channel; Vivocha uses that JSON Schema to build a Channel Configuration UI  in the Campaign Builder. |
| `message()`                    | `/channel/message`       | Send a message from Vivocha to External Service                                                                                                                             |
| `subscribe()`                  | `/extension/subscribe`   | Called by Vivocha to subscribe to the External Service                                                                                                                      |
| `unsubscribe()`                | `/extension/unsubscribe` | Called by Vivocha to unsubscribe from the External Service                                                                                                                  |
| configurable Webhook operation | `/webhook/<Custom_PATH>` | Called by External Service to send messages and events to Vivocha, the Channel imple entation defines how the Webhook URL is composed                                       |

#### [Capabilities](#capabilities)

Capabilities describe what a Channel is capable to do in terms of messages and message flow "directions".

For example, capabilities can describe whether a Channel supports textual chat messaging or voice communication. Inbound or outbound communication type, etc... Capabilities are represented by a JSON object and can be obtained (anche called by Vivocha) by the exposed `/channel/capabilities` API endpoint.

For a Channel it is important to describe which capabilities it is able to provide.

For a complete specification about capabilities, please see this [Channel Capabilities documentation](https://github.com/vivocha/bot-sdk/tree/develop#channel-capabilities).

#### [Multilanguage Strings](#multilanguage-strings)

In order to provide translations and multilanguage configuration User Interface in Vivocha, a Channel should provide the translations for every used UI label, for example, for every settings property/field. Multilanguage strings are specified through a JSON object which contains the labels used in Vivocha to configure the Channel. The JSON object has a set of properties representing the strings and related translation for supported languages. Strings properties are identified by an id that represents the label used in the Vivocha Campaign Builder, Channel configuration UI, to help the administrator user to configure the channel settings using her/his language.

Strings must be saved to `/data/strings.json` file.

An example of a multilanguage strings JSON content is like:

```json
[
  {
    "id": "NAME",
    "values": {
      "it": {
        "value": "Dummy Channel",
        "state": "final"
      },
      "en": {
        "value": "Dummy Channel",
        "state": "final"
      },
      "es": {
        "value": "Dummy Channel",
        "state": "final"
      }
    }
  },
  {
    "id": "DESCRIPTION",
    "values": {
      "it": {
        "value": "Canale Dummy",
        "state": "final"
      },
      "en": {
        "value": "Dummy Channel",
        "state": "final"
      },
      "es": {
        "value": "Canal de Dummy",
        "state": "final"
      }
    }
  },  
  {
    "id": "apiToken.LABEL",
    "values": {
      "it": {
        "value": "API Token per il Dummy Channel",
        "state": "final"
      },
      "en": {
        "value": "Dummy Channel API Token",
        "state": "final"
      },
      "es": {
        "value": "Token API Dummy Channel",
        "state": "final"
      }
    }
  }
]
```

#### [Assets](#assets)

Assets are a set of media files used by the Channel configuration UI. Basically, is the set of the icons used in the Campaign Builder Channel UI to be shown to the administrator user configuring che channel. Icons are asset files located in the `/assets` folder and they are automatically served by the `ExtensionAPI` class at `/extension/assets/{asset_name}` endpoint.

Used assets are specified in the `ChannelAPI` subclass constructor, passing the Extension Info `x-vivocha` property, for example like in:

```javascript
'x-vivocha': {
          type: 'channel',
          subType: 'twitter',
          icons: {
            extension: 'twitter.svg',
            instance: {
              dark: 'channel_dark.svg',
              light: 'channel_light.svg',
              color: 'channel_color.svg'
            }
          }
        }
```

As written before, referenced icons files must be saved in the Channel `/assets` folder.

#### [Settings](#settings)

To create the Channel within the Campaign Builder configuration UI, it is necessary to specify its settings using the JSON Schema object format. Properties of this JSON Schema match the settings defined andreequired to configure teh Channel instance and they will be obtained by Vivocha calling the exposed `/extension/settings` endpoint.

In the JSON Schema it is possible to set mandatory properties as entries in the array under the `required` property.

Each property in the JSON Schema can have a `visibility` property, used to specify if the field may contain sensitive data to not show to users, such as tokens or passwords that should be protected in the UI form. The `visibility` property can take the following values: `hidden` or `toggleable` or `masked`. If visibility is not set for a particular field it will be always visible by default.

Possible values are:

- `hidden`: this field will not be shown in the UI

- `toggleable`: the field can be shown clicking the "toggle button"

- `masked`: masked by *, like for "password type fields"

An example of a `settings()` method implementation returning a JSON Schema is the following:

```typescript
  settings(): OpenAPIV3.SchemaObject {
    return {
      type: 'object',
      required: ['pageId', 'pageToken'],
      properties: {
        pageId: {
          type: 'string',
          minLength: 1
        },
        pageToken: {
          type: 'string',
          minLength: 1,
          visibility: 'toggleable'
        }
      }
    }
  }
```

#### [Settings Client](#settings-client)

Some External Services require additional configuration for a Channel. This configuration can therefore be more complex to be described using a JSON Schema as the default settings procedure described above.

To fulfill the need to have a more complex or complete configuration UI in the Vivocha Campaign Builder it can be developed and set a **Settings Client**, which is a complete web client application, then served by the Channel itself, and must be contained in the `/settings/index.html` file.

As already said, the Settings Client is a web application client written in HTML, JavaScript and CSS. This application will be presented to the cnfiguring administrator user in the Configuration Builder through an iFrame letting to complete the settings configuration of the particular Channel.

The Settings Client can also insert some additional settings, it could generate Webhook URLs, unique ids, etc...
It is also possible to use a Mustache-based template engine, that can be used to resolve references to Channel served values like base URL or specific Channel environment properties.

In other words, if the Channel Settings Client needs to obtain the Channel base URL it can declare something like:

```javascript
const baseURL = '{{BASE_URL}}';
```

Every environment variable set at Channel launch-time will be available in the template system.

For example, if a Channel has been run with the command:

```sh
APP_ID=123 APP_TOKEN=456-abc-890 NAME=DummyChannel node /dist/index
```

Then, the Settings Client can resolve also those variables using templates, like in:

```javascript
const appId = '{{APP_ID}}';
const appToken = '{{APP_TOKEN}}';
const name = '{{NAME}}';
```

Therefore, the settings client app can use that resolved values as required by its own business logic.

#### [Subscribe Method](#subscribe-method)

Called by Vivocha through the endpoint `/extension/subscribe` to add a channel, save the record with the channel settings in the database and to eventually call the external service API to "register" the channel webhook or to activate a subscription in order to receive messages from the external communication service.
Requests are sent by Vivocha. A subscribe request contains a JSON with the following properties (in bold the required ones):

| PROPERTY          | VALUE                               | DESCRIPTION |
| ----------------- | ----------------------------------- | ----------- |
| **`environment`** | object, see Environment table below | TODO        |
| `settings`        | (optional) any                      | TODO        |
| `context`         | (optional) any                      | TODO        |
| `token`           | (optional) any                      | TODO        |

**Environment**:

| PROPERTY          | VALUE             | DESCRIPTION                                                 |
| ----------------- | ----------------- | ----------------------------------------------------------- |
| **`apiUrl`**      | string            | Vivocha complete url api e.g. TODO                          |
| **`acct_id`**     | string            | Vivocha account                                             |
| **`extensionId`** | string            | Vivocha extension id after the registration in the platform |
| **`instanceId`**  | string            | Id of the configured channel instance                       |
| `token`           | (optional) string | An API token used to call Vivocha API                       |

#### [Unsubscribe Method](#unsubscribe-method)

Called by Vivocha through the `/extension/unsubscribe` API endpoint to remove the channel.
An unsubscribe request is called to delete the channel from Vivocha and to eventually do cleaning operations on the external communication service.

#### [Message Method](#message-method)

Called by Vivocha to send a message from Vivocha to the external third party service (therefore, to the end-user). Messages should be converted in the required channel message format.
Supported Vivocha Messages are: **Text Message**, **IsWriting Message**, **Ack Message**, **Action Message**, **Attachment Message**, **Postback Message** and **Location Message**. More details about Vivocha Messages can be found in the [Vivocha Bot SDK documentation, starting from here](https://github.com/vivocha/bot-sdk/tree/develop#text-message).

`APIContext` contains the HTTP request (`APIRequest`) and the HTTP response (`APIResponse`).

Message requests are JSON objects with following properties:

| PROPERTY          | VALUE                         | DESCRIPTION                                                                        |
| ----------------- | ----------------------------- | ---------------------------------------------------------------------------------- |
| **`environment`** | object, see Environment below | TODO:                                                                              |
| `message`         | Vivocha standard message      | See [Vivocha Messages](https://github.com/vivocha/bot-sdk/tree/develop#botmessage) |
| `settings`        | any                           | TODO:                                                                              |
| `context`         | (optional) any                | TODO:                                                                              |

#### [Webhook](#webhook)

A Webhook is the Channel endpoint called by the External Service Platform to send events and messages to the Channel instance.
The `ChannelAPI` subclass could expose one or more webooks and endpoints, which URLs must be correctly configured in the External Service platform.
To create a Webhook the `ChannelAPI` subclass requires to implement the `router()` method.
In this method it is possible to add a new routing path (a resource) with exposed API operations to communicate with the External Service Platform. The Webhook URL is fully configurable and it will be automatically listed among paths in the Channel OpenAPI description, always available at `http(s)://<URL>/openapi.json`.  

The `router()` method should be implemented like in the following example:

```typescript
router(options?: RouterOptions): Promise<Router> {
    const resource: Resource = new Resource({
      name: 'Webhook', // customizable path name
      namePlural: 'Webhook'
    });
    resource.addOperation(new DummyChannelWebhook(resource));
    this.addResource(resource);
    return super.router(options);
  }
```

The operation `DummyChannelWebhook(resource)` shown in the example above, is a class that extends the Arrest Operation class (see [Arrest documentation](https://github.com/vivocha/arrest)for details).
That class is created to receive messages from the External Service

An example of a Webhook operation class could by the following:

```typescript
class DummyChannelWebhook extends Operation {
  api: DummyChannel;
  constructor(resource: Resource) {
    super(resource, '/:campaignId/:serviceId', 'post', 'dummyChannelEvent');
  }
  protected getCustomInfo(opts?: any): OpenAPIV3.OperationObject {
    return {
      description: 'Dummy Channel Webhook endpoint',
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
  async handler(req: APIRequest, res: APIResponse, next: NextFunction) {
    // Call here a method to handle the message received form the External Service Platform
    // and return OK
    res.status(200).end();
  }
}
```

The `handler()` method must contain the code to handle the message received from the External Service, converting it to the Vivocha Messages format.

In the following code snippets, related to a `handler()` method implementation, the third party message is converted / encapsulated in a Vivocha message and then forwarded to Vivocha Platform.

```typescript
const payload: Message = {
  code: 'message',
  ts: new Date(),
  type: 'text',
  agent: false,
  body: msg.text // third party message received and encapsulated, in this case for an hypotetic text message
};

this.postToWebhook(record.environment, 'message', context, payload);
```

The Webhook URL could be registered using the API provided by the External Service (like Twitter, for example), or, manually, by registering it through the External Service Platform.
Thus, if the External Service doesn't have any available webhook registration API (like Facebook Messenger, for example) usually the service gives the possibility to register a Webhook manually, by adding the URL during the External Service configuration process.

### [How to Write a Channel: Quick Start](#how-to-write-channel-quick-start)

In this section will be described the steps necessary to create your own channel connected to the external service. To facilitate the process we created an a basic Channel implementation (see the  at **[channel-boilerplate](https://github.com/vivocha/extension-sdk/tree/master/examples/channel-boilerplate)**) to quickly start developing a new Channel and to better understand the exposed methods and API.

> IMPORTANT: To learn how to create and connect a Channel to the Vivocha Platform, please start from the related [Vivocha Documentation](https://docs.Vivocha.com/vcb-channels).

As described in the sections above this Channel, named `channel-boilerplate` has an `index.ts` file, where the main class extends the `ChannelAPI`.
This class defines capabilities and settings, and implements the `subscribe`,`unsubscribe` and `message` methods and a basic webhook operation.

First of all, it is necessary to understand and define which settings a Channel needs to have, usually by following the indications that the External Service platform requires to configure the integration.
It is necessary to take note of all the operations needed by the external service, its API and the correct message format.
We can consider a Channel as a standalone web application that exposes a well-defined API described on `http(s)://<URL>/openapi.json` that implements Channel API methods and exposes a set of webhooks to receive data from the external service.

#### [Steps to Write a Channel](#steps-to-write-a-channel)

The following steps sum up what you need to do to write a Channel:

1. Import the required libraries, at least the `@vivocha/extension-sdk` package, and eventually the external service SDK libraries, if available;
2. write the Channel implementation extending the `ChannelAPI` class and declaring the record type which represents the channel settings to be saved in the database;

For example:

```typescript
class DummyChannel extends ChannelAPI<DummyChannelRecord> {...}
```

3. Implement the following methods, to add all the functionalities of a Channel:

- Capabilities method, `capabilities()`, that returns the description of what the Channel can do: types of supported messages, direction etc... Vivocha "invokes" it through calling the `/channel/capabilities` API endpoint;
- settings method, `settings()`, that returns a JSON Schema object; Vivocha needs to know these settings to create the Campaign Builder configuration UI for the Channel; Vivocha "invokes" it through calling the `/extension/settings` API endpoint;
- message method, `message()`,  called by Vivocha to send a message from Vivocha to the External Service Platform (thus, to the end-user). Vivocha "invokes" it through calling the `/channel/message` API endpoint;
- subscribe method,  `subscribe()` called by Vivocha calling the `/extension/subscribe` endpoint to persist che Channel configuration and to eventually register it in the External Service Platform;
- unsubscribe method `unsubscribe()`, called by Vivocha calling the `/extension/unsubscribe` endpoint to delete the Channel and eventually unsubscribe it from the External Service Platform.
  
1. **Create a Webhook** resource, and add the operations to receive data from the External Service which this Channel represents. The Webhook is an API endpoint exposed and registered in the External Service Platform.
   As described in sections above the **Webhook** is the entry point of the Channel and it is configured to receive events and messages from the related External Service Platform. The Channel exposes one or more Webhook endpoints, which URLs must be correctly configured in the External Service platform. To create a Webhook the Channel, that extends ChannelAPI, allows us to implement the `router()` method. In this method it will be necessary to add a routing path as a resourse with exposed operations to communicate with External Service Platform. An operation is fully configurable and accessibile  If third party service needs to validate the webhook, a validation operations should be added to the resource.

### [TODO: running the example and write conclusions]
