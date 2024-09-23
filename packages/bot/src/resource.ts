import type { Automa } from './index';

export class APIResource {
  protected _client: Automa;

  constructor(client: Automa) {
    this._client = client;
  }
}
