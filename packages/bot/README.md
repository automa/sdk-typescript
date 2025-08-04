# @automa/bot

Bot SDK for Automa.

Please read more about Automa [Bots](https://docs.automa.app/bots) and their [development](https://docs.automa.app/bot-development) in our documentation.

1. [Installation](#installation)
2. [Usage](#usage)
3. [Webhook signatures](#webhook-signatures)
4. [Testing](#testing)
5. [Reference](#reference)

## Installation

```sh
# Using npm
npm install @automa/bot

# Using pnpm
pnpm add @automa/bot

# Using bun
bun add @automa/bot
```

## Usage

```ts
import Automa from '@automa/bot';

const client = new Automa();

async function main() {
  // Download code for a task
  const folder = await client.code.download({
    task: {
      id: 10,
      token: '3ee12f8ca60132c087c6303efb46c3b5',
    },
  });

  // Change code in the folder ...

  // Propose the changed code
  await client.code.propose({
    task: { id: 10 },
  });

  // Remove the downloaded code folder
  await client.code.cleanup({
    task: { id: 10 },
  });
}

main();
```

## Webhook signatures

To verify webhook signatures, you can use the `verifyWebhook` helper provided by the SDK.

```ts
import { verifyWebhook } from '@automa/bot';

const payload = request.body; // The body of the webhook request
const signature = request.headers['webhook-signature'] as string; // The signature header from the request

const isValid = verifyWebhook(
  process.env.AUTOMA_WEBHOOK_SECRET,
  signature,
  payload,
);
```

## Testing

When writing tests for your bot, you can mock the client methods to simulate the behavior of the SDK without making actual network requests.

```ts
import sinon from 'sinon';
import { Automa, CodeFolder } from '@automa/bot';

const client = new Automa();

const downloadStub = sinon
  .stub(client.code, 'download')
  .resolves(new CodeFolder('./fixtures/code'));

const proposeStub = sinon.stub(client.code, 'propose').resolves();

const cleanupStub = sinon.stub(client.code, 'cleanup').resolves();
```

### Webhook signatures in tests

When testing webhook handling, you may want to simulate valid webhook requests. The SDK provides `generateWebhookSignature` helper to generate valid signatures for your test payloads.

```ts
import { generateWebhookSignature } from '@automa/bot';

const payload = {
  /* your test payload */
};

const signature = generateWebhookSignature(
  process.env.AUTOMA_WEBHOOK_SECRET,
  payload,
);

// Use this signature in your tests to simulate a valid webhook request
```

## Reference

Please find below the reference for both the client and its methods in the SDK.

### `Automa`

Object parameters:

- `baseUrl` (optional): Base URL for the Automa API. Defaults to `https://api.automa.app`.

  If you are using the bot with a self-hosted instance of Automa, you can specify the base URL like this:

  ```ts
  const client = new Automa({
    baseUrl: 'https://api.your-automa-instance.com',
  });
  ```

Properties:

- `code`: `Code` resource providing code related methods.

### `code.download`

Downloads the code for the specified task and returns a [`CodeFolder`](#codefolder) pointing to the cloned or extracted code directory.

Parameters:

- `body` (`CodeDownloadParams`)
  - `task` (object)
    - `id` (number): The identifier of the task.
    - `token` (string): The authorization token for the task sent in webhook request.

### `code.propose`

Submits a code change proposal for the specified task, using the diff between the current working directory and the base commit saved on download.

Parameters:

- `body` (`CodeProposeParams`)
  - `task` (object)
    - `id` (number): The identifier of the task.
  - `proposal` (object, optional)
    - `title` (string): Title of the pull request for the proposal.
    - `body` (string): Description of the pull request for the proposal.
  - `metadata` (object, optional)
    - `cost_in_cents` (number): Cost (in USD cents) incurred for implementing the task.

### `code.cleanup`

Removes any downloaded code folder and its archive for the specified task.

Parameters:

- `body` (`CodeCleanupParams`)
  - `task` (object)
    - `id` (int): The identifier of the task.

### `CodeFolder`

Represents a folder containing the downloaded code for a task. It provides some helper methods to build the code proposal.

Methods:

- `add(paths: string | string[])`: Add the specified new file(s) to the code proposal.
- `addAll()`: Add all new files to the code proposal.
