import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';

import { assert } from 'chai';
import sinon, { SinonStub } from 'sinon';
import axios, { AxiosError, AxiosResponse } from 'axios';
import { c as createTar } from 'tar';
import { $ } from 'zx';

import { Automa } from '../../src';
import { CodeFolder } from '../../src/resources/code';

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
    let folder: CodeFolder;

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
            url: '/bot/code/download',
            data: { task: { id: 28, token: 'invalid' } },
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            responseType: 'stream',
          },
        ]);
      });

      test('does not download code', () => {
        assert.isFalse(existsSync(task));
      });
    });

    suite('with download response missing content-type', () => {
      let err: Error;

      setup(async () => {
        axiosStub.resolves({
          data: Readable.from([Buffer.from('{}')]),
          headers: {},
        });

        try {
          await automa.code.download({
            task: { id: 28, token: 'abcdef' },
          });
        } catch (error: any) {
          err = error;
        }
      });

      test('throws error', () => {
        assert.equal(
          err.message,
          'Unexpected content type: undefined while downloading code.',
        );
      });

      test('should hit the api', () => {
        assert.equal(axiosStub.callCount, 1);
        assert.deepEqual(axiosStub.firstCall.args, [
          {
            baseURL: 'http://localhost:8080',
            method: 'POST',
            url: '/bot/code/download',
            data: { task: { id: 28, token: 'abcdef' } },
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            responseType: 'stream',
          },
        ]);
      });

      test('does not download code', () => {
        assert.isFalse(existsSync(task));
      });
    });

    suite('valid token for proxy download', () => {
      let fixture: string;

      suiteSetup(() => {
        fixture = join(__dirname, '..', 'fixtures', 'download');

        renameSync(join(fixture, '_git'), join(fixture, '.git'));
      });

      suiteTeardown(() => {
        renameSync(join(fixture, '.git'), join(fixture, '_git'));
      });

      setup(async () => {
        axiosStub.resolves({
          data: createTar({ cwd: fixture }, ['.']),
          headers: {
            'content-type': 'application/gzip',
            'x-automa-proposal-token': 'ghijkl',
          },
        });

        folder = await automa.code.download({
          task: { id: 28, token: 'abcdef' },
        });
      });

      test('returns path to downloaded code', () => {
        assert.equal(folder.path, task);
      });

      test('should hit the api', () => {
        assert.equal(axiosStub.callCount, 1);
        assert.deepEqual(axiosStub.firstCall.args, [
          {
            baseURL: 'http://localhost:8080',
            method: 'POST',
            url: '/bot/code/download',
            data: { task: { id: 28, token: 'abcdef' } },
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            responseType: 'stream',
          },
        ]);
      });

      test('downloads code', () => {
        assert.isTrue(existsSync(task));

        assert.deepEqual(readdirSync(task), ['.git', 'LICENSE', 'README.md']);
      });

      test('saves proposal token', () => {
        assert.equal(
          readFileSync(`${task}/.git/automa_proposal_token`, 'utf8'),
          'ghijkl',
        );
      });

      test('saves base commit', () => {
        assert.isFalse(existsSync(`${task}/.git/automa_proposal_base_commit`));
        assert.equal(
          readFileSync(`${task}/.git/automa_diff_base_commit`, 'utf8'),
          '5575f40bc4ead411b690b6f2f09636e3468ef12e',
        );
      });

      suite('propose', () => {
        setup(async () => {
          axiosStub.resolves({ data: { id: 1 } });
        });

        suite('with no proposal token stored', () => {
          let err: Error;

          setup(async () => {
            unlinkSync(`${task}/.git/automa_proposal_token`);

            try {
              await automa.code.propose({
                task: { id: 28, token: 'abcdef' },
              });
            } catch (error: any) {
              err = error;
            }
          });

          test('throws error', async () => {
            assert.equal(
              err.message,
              'Failed to read the stored proposal token',
            );
          });

          test('should not hit the api', () => {
            assert.equal(axiosStub.callCount, 1);
          });
        });

        suite('invalid proposal token', () => {
          let err: Error;

          setup(async () => {
            axiosStub.rejects(
              new AxiosError('Wrong proposal token provided', '403'),
            );

            try {
              writeFileSync(`${task}/README.md`, 'Content\n');

              await automa.code.propose({
                task: { id: 28, token: 'abcdef' },
              });
            } catch (error: any) {
              err = error;
            }
          });

          test('throws error', async () => {
            assert.equal(err.message, 'Wrong proposal token provided');
          });

          test('should hit the api', () => {
            assert.equal(axiosStub.callCount, 2);
            assert.deepEqual(axiosStub.secondCall.args, [
              {
                baseURL: 'http://localhost:8080',
                method: 'POST',
                url: '/bot/code/propose',
                data: {
                  proposal: {
                    diff: 'diff --git a/README.md b/README.md\nindex e69de29..39c9f36 100644\n--- a/README.md\n+++ b/README.md\n@@ -0,0 +1 @@\n+Content\n',
                    token: 'ghijkl',
                  },
                  task: { id: 28, token: 'abcdef' },
                },
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                },
              },
            ]);
          });
        });

        suite('valid', () => {
          let response: AxiosResponse;

          setup(async () => {
            writeFileSync(`${task}/README.md`, 'Content\n');

            response = await automa.code.propose({
              task: { id: 28, token: 'abcdef' },
            });
          });

          test('return the response', async () => {
            assert.deepEqual(response.data, { id: 1 });
          });

          test('should hit the api', () => {
            assert.equal(axiosStub.callCount, 2);
            assert.deepEqual(axiosStub.secondCall.args, [
              {
                baseURL: 'http://localhost:8080',
                method: 'POST',
                url: '/bot/code/propose',
                data: {
                  proposal: {
                    diff: 'diff --git a/README.md b/README.md\nindex e69de29..39c9f36 100644\n--- a/README.md\n+++ b/README.md\n@@ -0,0 +1 @@\n+Content\n',
                    token: 'ghijkl',
                  },
                  task: { id: 28, token: 'abcdef' },
                },
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                },
              },
            ]);
          });
        });

        suite('with added files', () => {
          let response: AxiosResponse;

          setup(async () => {
            writeFileSync(`${task}/NEW.md`, 'Content\n');

            await folder.add('NEW.md');

            response = await automa.code.propose({
              task: { id: 28, token: 'abcdef' },
            });
          });

          test('return the response', async () => {
            assert.deepEqual(response.data, { id: 1 });
          });

          test('should hit the api', () => {
            assert.equal(axiosStub.callCount, 2);
            assert.deepEqual(axiosStub.secondCall.args, [
              {
                baseURL: 'http://localhost:8080',
                method: 'POST',
                url: '/bot/code/propose',
                data: {
                  proposal: {
                    diff: 'diff --git a/NEW.md b/NEW.md\nnew file mode 100644\nindex 0000000..39c9f36\n--- /dev/null\n+++ b/NEW.md\n@@ -0,0 +1 @@\n+Content\n',
                    token: 'ghijkl',
                  },
                  task: { id: 28, token: 'abcdef' },
                },
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                },
              },
            ]);
          });
        });

        suite('with added files using addAll', () => {
          let response: AxiosResponse;

          setup(async () => {
            writeFileSync(`${task}/NEW.md`, 'Content\n');

            await folder.addAll();

            response = await automa.code.propose({
              task: { id: 28, token: 'abcdef' },
            });
          });

          test('return the response', async () => {
            assert.deepEqual(response.data, { id: 1 });
          });

          test('should hit the api', () => {
            assert.equal(axiosStub.callCount, 2);
            assert.deepEqual(axiosStub.secondCall.args, [
              {
                baseURL: 'http://localhost:8080',
                method: 'POST',
                url: '/bot/code/propose',
                data: {
                  proposal: {
                    diff: 'diff --git a/NEW.md b/NEW.md\nnew file mode 100644\nindex 0000000..39c9f36\n--- /dev/null\n+++ b/NEW.md\n@@ -0,0 +1 @@\n+Content\n',
                    token: 'ghijkl',
                  },
                  task: { id: 28, token: 'abcdef' },
                },
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                },
              },
            ]);
          });
        });

        suite('with intermediate commits', () => {
          let response: AxiosResponse;

          setup(async () => {
            writeFileSync(`${task}/LICENSE`, 'MIT\n');

            await $({ cwd: task })`git add LICENSE`;
            await $({
              cwd: task,
            })`git -c user.name="Tmp" -c user.email="tmp@tmp.com" commit -m "Intermediate commit"`;

            writeFileSync(`${task}/README.md`, 'Content\n');

            response = await automa.code.propose({
              task: { id: 28, token: 'abcdef' },
            });
          });

          test('return the response', async () => {
            assert.deepEqual(response.data, { id: 1 });
          });

          test('should hit the api', () => {
            assert.equal(axiosStub.callCount, 2);
            assert.deepEqual(axiosStub.secondCall.args, [
              {
                baseURL: 'http://localhost:8080',
                method: 'POST',
                url: '/bot/code/propose',
                data: {
                  proposal: {
                    diff: 'diff --git a/LICENSE b/LICENSE\nindex e69de29..a22a2da 100644\n--- a/LICENSE\n+++ b/LICENSE\n@@ -0,0 +1 @@\n+MIT\ndiff --git a/README.md b/README.md\nindex e69de29..39c9f36 100644\n--- a/README.md\n+++ b/README.md\n@@ -0,0 +1 @@\n+Content\n',
                    token: 'ghijkl',
                  },
                  task: { id: 28, token: 'abcdef' },
                },
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                },
              },
            ]);
          });
        });

        suite('with proposal properties', () => {
          let response: AxiosResponse;

          setup(async () => {
            writeFileSync(`${task}/README.md`, 'Content\n');

            response = await automa.code.propose({
              task: { id: 28, token: 'abcdef' },
              proposal: {
                title: 'PR Title',
                body: 'PR Body',
              },
            });
          });

          test('return the response', async () => {
            assert.deepEqual(response.data, { id: 1 });
          });

          test('should hit the api', () => {
            assert.equal(axiosStub.callCount, 2);
            assert.deepEqual(axiosStub.secondCall.args, [
              {
                baseURL: 'http://localhost:8080',
                method: 'POST',
                url: '/bot/code/propose',
                data: {
                  proposal: {
                    title: 'PR Title',
                    body: 'PR Body',
                    diff: 'diff --git a/README.md b/README.md\nindex e69de29..39c9f36 100644\n--- a/README.md\n+++ b/README.md\n@@ -0,0 +1 @@\n+Content\n',
                    token: 'ghijkl',
                  },
                  task: { id: 28, token: 'abcdef' },
                },
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                },
              },
            ]);
          });
        });

        suite('with metadata', () => {
          let response: AxiosResponse;

          setup(async () => {
            writeFileSync(`${task}/README.md`, 'Content\n');

            response = await automa.code.propose({
              task: { id: 28, token: 'abcdef' },
              metadata: {
                cost_in_cents: 10,
                random: 'yes',
              },
            });
          });

          test('return the response', async () => {
            assert.deepEqual(response.data, { id: 1 });
          });

          test('should hit the api', () => {
            assert.equal(axiosStub.callCount, 2);
            assert.deepEqual(axiosStub.secondCall.args, [
              {
                baseURL: 'http://localhost:8080',
                method: 'POST',
                url: '/bot/code/propose',
                data: {
                  proposal: {
                    diff: 'diff --git a/README.md b/README.md\nindex e69de29..39c9f36 100644\n--- a/README.md\n+++ b/README.md\n@@ -0,0 +1 @@\n+Content\n',
                    token: 'ghijkl',
                  },
                  task: { id: 28, token: 'abcdef' },
                  metadata: {
                    cost_in_cents: 10,
                    random: 'yes',
                  },
                },
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                },
              },
            ]);
          });
        });
      });
    });

    suite('valid token for direct download', () => {
      setup(async () => {
        const gitRepo = join(__dirname, '..', 'fixtures', 'download', '_git');

        axiosStub.resolves({
          data: Readable.from([
            Buffer.from(
              JSON.stringify({
                type: 'direct',
                url: `file://${gitRepo}`,
              }),
            ),
          ]),
          headers: {
            'content-type': 'application/json',
            'x-automa-proposal-token': 'ghijkl',
          },
        });

        folder = await automa.code.download({
          task: { id: 28, token: 'abcdef' },
        });
      });

      test('returns path to downloaded code', () => {
        assert.equal(folder.path, task);
      });

      test('should hit the api', () => {
        assert.equal(axiosStub.callCount, 1);
        assert.deepEqual(axiosStub.firstCall.args, [
          {
            baseURL: 'http://localhost:8080',
            method: 'POST',
            url: '/bot/code/download',
            data: { task: { id: 28, token: 'abcdef' } },
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            responseType: 'stream',
          },
        ]);
      });

      test('clones the repo', () => {
        assert.isTrue(existsSync(task));

        assert.deepEqual(readdirSync(task), ['.git', 'LICENSE', 'README.md']);
      });

      test('saves proposal token', () => {
        assert.equal(
          readFileSync(`${task}/.git/automa_proposal_token`, 'utf8'),
          'ghijkl',
        );
      });

      test('saves base commit', () => {
        assert.equal(
          readFileSync(`${task}/.git/automa_proposal_base_commit`, 'utf8'),
          '5575f40bc4ead411b690b6f2f09636e3468ef12e',
        );
        assert.isFalse(existsSync(`${task}/.git/automa_diff_base_commit`));
      });

      suite('propose', () => {
        setup(async () => {
          axiosStub.resolves({ data: { id: 1 } });
        });

        suite('valid', () => {
          let response: AxiosResponse;

          setup(async () => {
            writeFileSync(`${task}/README.md`, 'Content\n');

            response = await automa.code.propose({
              task: { id: 28, token: 'abcdef' },
            });
          });

          test('return the response', async () => {
            assert.deepEqual(response.data, { id: 1 });
          });

          test('should hit the api', () => {
            assert.equal(axiosStub.callCount, 2);
            assert.deepEqual(axiosStub.secondCall.args, [
              {
                baseURL: 'http://localhost:8080',
                method: 'POST',
                url: '/bot/code/propose',
                data: {
                  proposal: {
                    diff: 'diff --git a/README.md b/README.md\nindex e69de29..39c9f36 100644\n--- a/README.md\n+++ b/README.md\n@@ -0,0 +1 @@\n+Content\n',
                    token: 'ghijkl',
                    base_commit: '5575f40bc4ead411b690b6f2f09636e3468ef12e',
                  },
                  task: { id: 28, token: 'abcdef' },
                },
                headers: {
                  Accept: 'application/json',
                  'Content-Type': 'application/json',
                },
              },
            ]);
          });
        });
      });
    });
  });
});
