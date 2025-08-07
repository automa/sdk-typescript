import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { x as extract } from 'tar';
import { $ } from 'zx';

import { Task, TaskForCode } from '../types';

import { RequestOptions } from '../baseClient';
import { APIResource } from '../core/resource';

// TODO: Use programmatic git instead of git command
const get_diff = async (path: string) => {
  const { stdout } = await $({ cwd: path })`git diff`;

  return stdout;
};

export class CodeFolder {
  path: string;

  constructor(path: string) {
    this.path = path;
  }

  async add(paths: string | string[]) {
    await $({ cwd: this.path })`git add -N ${
      Array.isArray(paths) ? paths : [paths]
    }`;
  }

  async addAll() {
    await $({ cwd: this.path })`git add -N .`;
  }
}

export class Code extends APIResource {
  /**
   * Cleans up the downloaded code for a task
   * @param body Task to cleanup code for
   */
  cleanup(body: CodeCleanupParams) {
    return rm(this.path(body.task), { recursive: true });
  }

  /**
   * Downloads code for a task
   * @param body Task to download code for
   * @param options Request options
   * @returns Path to the downloaded code
   */
  async download(
    body: CodeDownloadParams,
    options?: RequestOptions<CodeDownloadParams>,
  ) {
    const response = await this._client.post<Readable, CodeDownloadParams>(
      '/bot/code/download',
      body,
      {
        ...options,
        headers: {
          ...options?.headers,
        },
        responseType: 'stream',
      },
    );

    const path = this.path(body.task);
    const contentType = response.headers['content-type'];

    await rm(path, { recursive: true, force: true });
    await mkdir(path, { recursive: true });

    if (contentType?.startsWith('application/json')) {
      const chunks: Buffer[] = [];

      for await (const chunk of response.data) {
        chunks.push(chunk);
      }

      const data = JSON.parse(Buffer.concat(chunks).toString());

      await $({ cwd: path })`git clone --depth=1 ${data.url} .`;

      // Note down the base commit
      const { stdout: baseCommit } = await $({ cwd: path })`git rev-parse HEAD`;

      await writeFile(
        `${path}/.git/automa_proposal_base_commit`,
        baseCommit.trim(),
      );
    } else if (contentType?.startsWith('application/gzip')) {
      await pipeline(response.data, extract({ cwd: path }));
    } else {
      await rm(path, { recursive: true, force: true });

      throw new Error(
        `Unexpected content type: ${contentType} while downloading code.`,
      );
    }

    // Save the proposal token for later use
    await writeFile(
      `${path}/.git/automa_proposal_token`,
      response.headers['x-automa-proposal-token'],
    );

    return new CodeFolder(path);
  }

  /**
   * Proposes code changes for a task
   * @param body Parameters for the code proposal
   * @param body.task Task to propose code changes for
   * @param body.proposal Proposal details
   * @param body.proposal.message Optional commit message for the proposal
   * @param options Request options
   * @returns Proposal that was created
   */
  async propose(
    body: CodeProposeParams,
    options?: RequestOptions<CodeProposeRequestParams>,
  ) {
    const path = this.path(body.task);
    let token: string | undefined, baseCommit: string | undefined;

    try {
      // Read the proposal token from the downloaded code
      token = await readFile(`${path}/.git/automa_proposal_token`, 'utf8');
    } catch (e) {}

    try {
      baseCommit = await readFile(
        `${path}/.git/automa_proposal_base_commit`,
        'utf8',
      );
    } catch (e) {}

    if (!token) {
      throw new Error('Failed to read the stored proposal token');
    }

    const diff = await get_diff(path);

    return this._client.post<void, CodeProposeRequestParams>(
      '/bot/code/propose',
      {
        ...body,
        proposal: {
          ...body.proposal,
          token,
          diff,
          ...(baseCommit ? { base_commit: baseCommit } : {}),
        },
      },
      options,
    );
  }

  private path(task: Pick<Task, 'id'>) {
    return `/tmp/automa/tasks/${task.id}`;
  }
}

export interface CodeCleanupParams {
  task: Pick<Task, 'id'>;
}

export interface CodeDownloadParams {
  task: Pick<TaskForCode, 'id' | 'token'>;
}

interface CodeProposeRequestParams extends CodeDownloadParams {
  proposal: {
    token: string;
    diff: string;
    title?: string;
    body?: string;
  };
}

export interface CodeProposeParams extends CodeDownloadParams {
  proposal?: {
    title?: string;
    body?: string;
  };
  metadata?: Record<string, unknown> & {
    cost_in_cents?: number;
  };
}
