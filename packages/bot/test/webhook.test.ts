import { assert } from 'chai';

import { generateWebhookSignature, verifyWebhook } from '../src/webhook';

const payload = {
  id: '1',
  timestamp: '2023-10-01T00:00:00Z',
  data: {},
};

suite('verifyWebhook', () => {
  test('returns false if secret is not a string', () => {
    const result = verifyWebhook(1 as unknown as string, 'signature', payload);

    assert.isFalse(result);
  });

  test('returns false if secret is empty', () => {
    const result = verifyWebhook('', 'signature', payload);

    assert.isFalse(result);
  });

  test('returns false if signature is not a string', () => {
    const result = verifyWebhook('secret', 1 as unknown as string, payload);

    assert.isFalse(result);
  });

  test('returns false if signature is empty', () => {
    const result = verifyWebhook('secret', '', payload);

    assert.isFalse(result);
  });

  test('throws if secret does not start with "atma_whsec_"', () => {
    assert.throws(() => {
      verifyWebhook('invalid_secret', 'signature', payload);
    }, /Secret must start with 'atma_whsec_'/);
  });

  test('returns false if signature is wrong', () => {
    const result = verifyWebhook('atma_whsec_secret', 'signature', payload);

    assert.isFalse(result);
  });

  test('returns true if signature is correct', () => {
    console.log(generateWebhookSignature('atma_whsec_secret', payload));

    const result = verifyWebhook(
      'atma_whsec_secret',
      'v1,ybgUDC8L+jRv0kjS5fC8QS6J2pFs9vGzWail0mt3DOg=',
      payload,
    );

    assert.isTrue(result);
  });

  test('returns true if second signature is correct', () => {
    const result = verifyWebhook(
      'atma_whsec_secret',
      'bad_signature v1,ybgUDC8L+jRv0kjS5fC8QS6J2pFs9vGzWail0mt3DOg=',
      payload,
    );

    assert.isTrue(result);
  });

  test('verifies the generated signature', () => {
    // Generate signature
    const signature = generateWebhookSignature('atma_whsec_secret', payload);

    // Verify with the same parameters
    const result = verifyWebhook('atma_whsec_secret', signature, payload);

    assert.isTrue(result);
  });
});
