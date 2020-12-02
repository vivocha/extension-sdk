import * as chai from 'chai';
import { getVivochaDotNetCDNUrl } from '../../dist/util';
chai.should();

describe('Testing #utils', function() {
  describe('#getVivochaDotNetCDNUrl()', function() {
    it('should build the correct new URL', async function() {
      const oldUrl =
        'https://h1.vivocha.com/a/myline/api/v3/public/contacts/20200204f9070cd8e6a32f5a4eb8ed142c3c3466/attachments/c1990863b73d8c63a975d1f2b48eeda5323fc139bcccd9faf543f756175d0734';
      const correctNewUrl =
        'https://cdn.vivocha.net/a/myline/w/h1/1/api/v3/public/contacts/20200204f9070cd8e6a32f5a4eb8ed142c3c3466/attachments/c1990863b73d8c63a975d1f2b48eeda5323fc139bcccd9faf543f756175d0734';

      const newUrl = getVivochaDotNetCDNUrl(oldUrl);
      newUrl.should.equal(correctNewUrl);
      return;
    });
    it('should build the correct new URL', async function() {
      const oldUrl =
        'https://f2.vivocha.com/a/test_account/api/v3/public/contacts/20200204f9070cd8e6a32f5a4eb8ed142c3c3466/attachments/c1990863b73d8c63a975d1f2b48eeda5323fc139bcccd9faf543f756175d0734';
      const correctNewUrl =
        'https://cdn.vivocha.net/a/test_account/w/f2/1/api/v3/public/contacts/20200204f9070cd8e6a32f5a4eb8ed142c3c3466/attachments/c1990863b73d8c63a975d1f2b48eeda5323fc139bcccd9faf543f756175d0734';

      const newUrl = getVivochaDotNetCDNUrl(oldUrl);
      newUrl.should.equal(correctNewUrl);
      return;
    });
    it('should build the correct new URL', async function() {
      const oldUrl =
        'https://world-x.vivocha.com/a/accountX_Y/api/v3/public/contacts/2020abc/attach/c1990863b73d8c63a975d1f2b48eeda5323fc139bcccd9faf543f756175d0734';
      const correctNewUrl =
        'https://cdn.vivocha.net/a/accountX_Y/w/world-x/1/api/v3/public/contacts/2020abc/attach/c1990863b73d8c63a975d1f2b48eeda5323fc139bcccd9faf543f756175d0734';

      const newUrl = getVivochaDotNetCDNUrl(oldUrl);
      newUrl.should.equal(correctNewUrl);
      return;
    });
    it('should build the correct new URL', async function() {
      const oldUrl =
        'https://world-x_y.vivocha.com/a/pippo-pluto-paperino_2/api/v3/public/contacts/2020abc/attachment/c1990863b73d8c63a975d1f2b48eeda5323fc139bcccd9faf543f756175d0734X';
      const correctNewUrl =
        'https://cdn.vivocha.net/a/pippo-pluto-paperino_2/w/world-x_y/1/api/v3/public/contacts/2020abc/attachment/c1990863b73d8c63a975d1f2b48eeda5323fc139bcccd9faf543f756175d0734X';

      const newUrl = getVivochaDotNetCDNUrl(oldUrl);
      newUrl.should.equal(correctNewUrl);
      return;
    });
  });
});
