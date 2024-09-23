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

  const hmac = generateWebhookSignature(secret, payload);

  const digest = Buffer.from(hmac, 'utf8');
  const checksum = Buffer.from(signature, 'utf8');

  return checksum.length === digest.length && timingSafeEqual(digest, checksum);
};

export const generateWebhookSignature = <P>(secret: string, payload: P) =>
  createHmac('sha256', secret).update(JSON.stringify(payload)).digest('hex');
