import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';

import { assert } from 'chai';
import sinon, { SinonStub } from 'sinon';
import axios, { AxiosError } from 'axios';
import { c as createTar } from 'tar';

import { Automa } from '../../src';

suite('code', () => {
  let automa: Automa, axiosStub: SinonStub;

  const task = '/tmp/automa/tasks/28';

  setup(() => {
    automa = new Automa({
      baseURL: 'http://localhost:8080',
    });

    axiosStub = sinon.stub(axios, 'request');

    rmSync(task, { recursive: true, force: true });
  });

  teardown(() => {
    axiosStub.restore();
  });

  test('cleanup', async () => {
    mkdirSync(task, { recursive: true });
    assert.isTrue(existsSync(task));

    await automa.code.cleanup({ task: { id: 28 } });

    assert.isFalse(existsSync(task));
  });

  suite('download', () => {
    let folder: string;

    suite('invalid token', () => {
      let err: Error;

      setup(async () => {
        axiosStub.rejects(
          new AxiosError(
            'Task is older than 7 days and thus cannot be worked upon anymore',
            '403',
          ),
        );

        try {
          await automa.code.download({
            task: { id: 28, token: 'invalid' },
          });
        } catch (error: any) {
          err = error;
        }
      });

      test('throws error', async () => {
        assert.equal(
          err.message,
          'Task is older than 7 days and thus cannot be worked upon anymore',
        );
      });

      test('should hit the api', () => {
        assert.equal(axiosStub.callCount, 1);
        assert.deepEqual(axiosStub.firstCall.args, [
          {
            baseURL: 'http://localhost:8080',
            method: 'POST',
            url: '/code/download',
            data: { task: { id: 28, token: 'invalid' } },
            headers: { Accept: 'application/gzip' },
            responseType: 'stream',
          },
        ]);
      });

      test('does not download code', () => {
        assert.isFalse(existsSync(task));
      });
    });

    suite('valid token', () => {
      let fixture: string;

      setup(async () => {
        // We can't track git folders in git, so we need to create a git folder
        fixture = join(__dirname, '..', 'fixtures', 'download');
        mkdirSync(join(fixture, '.git'));

        axiosStub.resolves({
          data: createTar({ cwd: fixture }, ['.']),
          headers: {
            'x-automa-proposal-token': 'ghijkl',
          },
        });

        folder = await automa.code.download({
          task: { id: 28, token: 'abcdef' },
        });
      });

      teardown(() => {
        // Delete the git folder that was created
        rmSync(join(fixture, '.git'), { recursive: true, force: true });
      });

      test('returns path to downloaded code', () => {
        assert.equal(folder, task);
      });

      test('should hit the api', () => {
        assert.equal(axiosStub.callCount, 1);
        assert.deepEqual(axiosStub.firstCall.args, [
          {
            baseURL: 'http://localhost:8080',
            method: 'POST',
            url: '/code/download',
            data: { task: { id: 28, token: 'abcdef' } },
            headers: { Accept: 'application/gzip' },
            responseType: 'stream',
          },
        ]);
      });

      test('downloads code', () => {
        assert.isTrue(existsSync(task));

        assert.deepEqual(readdirSync(task), ['.git', 'README.md']);
      });

      test('saves proposal token', () => {
        assert.equal(
          readFileSync(`${task}/.git/automa_proposal_token`, 'utf8'),
          'ghijkl',
        );
      });
    });
  });
});
