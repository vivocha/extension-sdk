import { ChannelAPITypes } from '@vivocha/extension-sdk';

export interface DummyChannelSettings {
  serviceToken: string;
  serviceId: string;
}

export interface DummyChannelRecord extends DummyChannelSettings {
  environment: ChannelAPITypes.Environment;
}
