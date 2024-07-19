import { createHmac, timingSafeEqual } from 'node:crypto';

export const verifyWebhook = <P>(
  secret: string,
  signature: string,
  payload: P,
) => {
  if (
    !secret ||
    typeof secret !== 'string' ||
    !signature ||
    typeof signature !== 'string'
  ) {
    return false;
  }

  let hmac = createHmac('sha256', secret);
  hmac = hmac.update(JSON.stringify(payload));

  const digest = Buffer.from(hmac.digest('hex'), 'utf8');
  const checksum = Buffer.from(signature, 'utf8');

  return checksum.length === digest.length && timingSafeEqual(digest, checksum);
};
