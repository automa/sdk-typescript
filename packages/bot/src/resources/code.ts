import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { x as extract } from 'tar';
import { $ } from 'zx';

import { APIResource } from '../resource';

import { Task } from './shared';

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
   * @returns Path to the downloaded code
   */
  async download(body: CodeDownloadParams) {
    const response = await this._client.post<Readable, CodeDownloadParams>(
      '/code/download',
      body,
      {
        headers: {
          Accept: 'application/gzip',
        },
        responseType: 'stream',
      },
    );

    const folder = this.path(body.task);

    await rm(folder, { recursive: true, force: true });
    await mkdir(folder, { recursive: true });

    await pipeline(response.data, extract({ cwd: folder }));

    // Save the proposal token for later use
    await writeFile(
      `${folder}/.git/automa_proposal_token`,
      response.headers['x-automa-proposal-token'],
    );

    return folder;
  }

  /**
   * Proposes code changes for a task
   * @param body Parameters for the code proposal
   * @param body.task Task to propose code changes for
   * @param body.proposal Proposal details
   * @param body.proposal.message Optional commit message for the proposal
   * @returns Proposal that was created
   */
  async propose(body: CodeProposeParams) {
    const folder = this.path(body.task);
    let token: string | undefined;

    try {
      // Read the proposal token from the downloaded code
      token = await readFile(`${folder}/.git/automa_proposal_token`, 'utf8');
    } catch (e) {}

    if (!token) {
      throw new Error('Failed to read the stored proposal token');
    }

    // TODO: Use programmatic git instead of system git
    const { stdout } = await $({ cwd: folder })`git diff`;

    return this._client.post<
      void,
      CodeDownloadParams & {
        proposal: {
          token: string;
          diff: string;
          message?: string;
        };
      }
    >('/code/propose', {
      ...body,
      proposal: {
        ...body.proposal,
        token,
        diff: stdout,
      },
    });
  }

  private path(task: Pick<Task, 'id'>) {
    return `/tmp/automa/tasks/${task.id}`;
  }
}

export interface CodeCleanupParams {
  task: Pick<Task, 'id'>;
}

export interface CodeDownloadParams {
  task: Pick<Task, 'id' | 'token'>;
}

export interface CodeProposeParams extends CodeDownloadParams {
  proposal?: {
    message?: string;
  };
}
