import * as Core from './core';
import * as API from './resources';

export { Code } from './resources';
export type { CodeCleanupParams, CodeDownloadParams } from './resources';

export * from './webhook';

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
  defaultHeaders?: Core.Headers;
}

/**
 * API Client for interfacing with the Automa API.
 */
export class Automa extends Core.APIClient {
  private _options: ClientOptions;

  /**
   * API Client for interfacing with the Automa API.
   *
   * @param {string} [opts.baseURL=process.env['AUTOMA_BASE_URL'] ?? https://api.automa.app] - Override the default base URL for the API.
   * @param {Core.Headers} opts.defaultHeaders - Default headers to include with every request to the API.
   */
  constructor({
    baseURL = Core.readEnv('AUTOMA_BASE_URL'),
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

  code: API.Code = new API.Code(this);

  protected override defaultHeaders(): Core.Headers {
    return {
      ...super.defaultHeaders(),
      ...this._options.defaultHeaders,
    };
  }

  static Automa = this;
}

export default Automa;
