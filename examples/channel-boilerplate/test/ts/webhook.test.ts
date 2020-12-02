import * as chai from 'chai';

chai.should();

class FakeController {

  config;
  webhook;
  $pageId;

  constructor(campId, extUrl,pageId) {
    this.config = {
      extensionUrl: extUrl,
      campaignId: campId
    }
    this.$pageId = {
      value: pageId
    }
  }

  generateWebHook() {
    const url = new URL(this.config.extensionUrl);
    let w = '';
    if (url.host.indexOf('vivocha.com') !== -1) {
      const host = url.host.replace('vivocha.com', 'vivocha.net');
      w = `${url.protocol}//${this.config.campaignId}.${host}/webhook/${this.config.campaignId}/${this.$pageId.value}`;
    } else {
      w = `${this.config.extensionUrl}/webhook/${this.config.campaignId}/${this.$pageId.value}`;
    }
    this.webhook = w;
  }
}

describe('Settings client Webhook generation', function() {
  describe('#generateWebHook()', function() {
    it('should build the correct webhook URL', async function() {

      let u = 'https://fb-messenger.channels.vivocha.com';
      let fakeCtrl = new FakeController('5e26d18370b7a17efc677226', u, '1605831366171679');
      fakeCtrl.generateWebHook();
      let correctU = 'https://5e26d18370b7a17efc677226.fb-messenger.channels.vivocha.net/webhook/5e26d18370b7a17efc677226/1605831366171679';
      fakeCtrl.webhook.should.equal(correctU);
      ​
      return;
    });

    it('should build the correct webhook URL', async function() {

      let u = 'https://fb-messenger.channels.mydomain.com';
      let fakeCtrl = new FakeController('5e26d18370b7a17efc677226', u, '1605831366171679');
      fakeCtrl.generateWebHook();
      let correctU = 'https://fb-messenger.channels.mydomain.com/webhook/5e26d18370b7a17efc677226/1605831366171679';
      fakeCtrl.webhook.should.equal(correctU);
      ​
      return;
    });

    it('should build the correct webhook URL', async function() {

      let u = 'https://mychannel.channels.vivocha.com';
      let fakeCtrl = new FakeController('5e26d18370b7a17efc677226', u, '1605831366171679');
      fakeCtrl.generateWebHook();
      let correctU = 'https://5e26d18370b7a17efc677226.mychannel.channels.vivocha.net/webhook/5e26d18370b7a17efc677226/1605831366171679';
      fakeCtrl.webhook.should.equal(correctU);
      ​
      return;
    });

    it('should build the correct webhook URL', async function() {

      let u = 'https://mychannel.mydomain.com';
      let fakeCtrl = new FakeController('5e26d18370b7a17efc677226', u, '1605831366171679');
      fakeCtrl.generateWebHook();
      let correctU = 'https://mychannel.mydomain.com/webhook/5e26d18370b7a17efc677226/1605831366171679';
      fakeCtrl.webhook.should.equal(correctU);
      ​
      return;
    });

    it('should build the correct webhook URL', async function() {

      let u = 'http://mychannel.vivocha.com';
      let fakeCtrl = new FakeController('5e26d18370b7a17efc677226', u, '1605831366171679');
      fakeCtrl.generateWebHook();
      let correctU = 'http://5e26d18370b7a17efc677226.mychannel.vivocha.net/webhook/5e26d18370b7a17efc677226/1605831366171679';
      fakeCtrl.webhook.should.equal(correctU);
      ​
      return;
    });
  })
});
