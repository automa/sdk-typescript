import { mkdir, rm } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

import { x as extract } from 'tar';

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

    await rm(folder, { recursive: true });
    await mkdir(folder, { recursive: true });

    await pipeline(response.data, extract({ cwd: folder }));

    return folder;
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
