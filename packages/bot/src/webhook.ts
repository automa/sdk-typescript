import { createHmac, timingSafeEqual } from 'node:crypto';

import stableStringify from 'json-stable-stringify';

type Payload<P> = {
  id: string;
  timestamp: string;
  data: P;
};

export const verifyWebhook = <P>(
  secret: string,
  signature: string,
  payload: Payload<P>,
) => {
  if (
    !secret ||
    typeof secret !== 'string' ||
    !signature ||
    typeof signature !== 'string'
  ) {
    return false;
  }

  if (!secret.startsWith('atma_whsec_')) {
    throw new Error("Secret must start with 'atma_whsec_'");
  }

  const signatures = signature.split(' ');

  const hmac = generateWebhookSignature(secret, payload);
  const digest = Buffer.from(hmac, 'utf8');

  return signatures.some((sig) => {
    const checksum = Buffer.from(sig, 'utf8');

    return (
      checksum.length === digest.length && timingSafeEqual(digest, checksum)
    );
  });
};

export const generateWebhookSignature = <P>(
  secret: string,
  payload: Payload<P>,
) => {
  const timestamp = Math.floor(new Date(payload.timestamp).getTime() / 1000);

  const sig = createHmac('sha256', secret.slice(11))
    .update(`${payload.id}.${timestamp}.${stableStringify(payload)}`)
    .digest('base64');

  return `v1,${sig}`;
};
