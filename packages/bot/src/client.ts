import { APIClient, Headers } from './baseClient';
import { readEnv } from './internal/utils/env';
import * as API from './resources';

export interface ClientOptions {
  /**
   * Override the default base URL for the API, e.g., "https://api.example.com/v2/"
   *
   * Defaults to process.env['AUTOMA_BASE_URL'].
   */
  baseURL?: string | null | undefined;

  /**
   * Default headers to include with every request to the API.
   *
   * These can be removed in individual requests by explicitly setting the
   * header to `undefined` or `null` in request options.
   */
  defaultHeaders?: Headers;
}

/**
 * API Client for interfacing with the Automa API.
 */
export class Automa extends APIClient {
  private _options: ClientOptions;

  /**
   * API Client for interfacing with the Automa API.
   *
   * @param {string} [opts.baseURL=process.env['AUTOMA_BASE_URL'] ?? https://api.automa.app] - Override the default base URL for the API.
   * @param {Headers} opts.defaultHeaders - Default headers to include with every request to the API.
   */
  constructor({
    baseURL = readEnv('AUTOMA_BASE_URL'),
    ...opts
  }: ClientOptions = {}) {
    const options: ClientOptions = {
      ...opts,
      baseURL: baseURL || 'https://api.automa.app',
    };

    super({
      baseURL: options.baseURL!,
    });

    this._options = options;
  }

  protected override defaultHeaders(): Headers {
    return {
      ...super.defaultHeaders(),
      ...this._options.defaultHeaders,
    };
  }

  code: API.Code = new API.Code(this);
  task: API.Task = new API.Task(this);
}
