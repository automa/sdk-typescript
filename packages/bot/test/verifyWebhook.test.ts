import { assert } from 'chai';

import { verifyWebhook } from '../src/verify';

suite('verifyWebhook', () => {
  test('returns false if secret is not a string', () => {
    const result = verifyWebhook(1 as unknown as string, 'signature', {});

    assert.isFalse(result);
  });

  test('returns false if secret is empty', () => {
    const result = verifyWebhook('', 'signature', {});

    assert.isFalse(result);
  });

  test('returns false if signature is not a string', () => {
    const result = verifyWebhook('secret', 1 as unknown as string, {});

    assert.isFalse(result);
  });

  test('returns false if signature is empty', () => {
    const result = verifyWebhook('secret', '', {});

    assert.isFalse(result);
  });

  test('returns false if signature is wrong', () => {
    const result = verifyWebhook('secret', 'signature', {});

    assert.isFalse(result);
  });

  test('returns true if signature is correct', () => {
    const result = verifyWebhook(
      'secret',
      '77325902caca812dc259733aacd046b73817372c777b8d95b402647474516e13',
      {},
    );

    assert.isTrue(result);
  });
});
