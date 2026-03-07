import { Readable } from 'node:stream';

import { TaskForCode } from '../types';

import { APIResource } from '../core/resource';

export class Task extends APIResource {
  private eventQueue: QueuedEvent[] = [];
  private isProcessing = false;

  private flushTimer?: NodeJS.Timeout;
  private readonly maxBatchSize = 50;
  private readonly flushInterval = 5000; // 5 seconds

  constructor(...args: ConstructorParameters<typeof APIResource>) {
    super(...args);
    this.installProcessHandlers();
    this.startPeriodicFlush();
  }

  private installProcessHandlers() {
    const cleanupAndReemit = async (signal: NodeJS.Signals) => {
      await this.cleanupAll(signal);

      // Remove our listeners to restore default behavior, then re-emit signal
      process.removeListener('SIGINT', onSigint);
      process.removeListener('SIGTERM', onSigterm);
      process.removeListener('SIGQUIT', onSigquit);

      try {
        process.kill(process.pid, signal);
      } catch {
        // ignore if process already exiting
      }
    };

    const onSigint = () => cleanupAndReemit('SIGINT');
    const onSigterm = () => cleanupAndReemit('SIGTERM');
    const onSigquit = () => cleanupAndReemit('SIGQUIT');

    process.once('SIGINT', onSigint);
    process.once('SIGTERM', onSigterm);
    process.once('SIGQUIT', onSigquit);

    process.once('beforeExit', async () => {
      await this.cleanupAll('beforeExit');
    });

    process.once('unhandledRejection', async (reason) => {
      console.error('Unhandled rejection:', reason);
      await this.cleanupAll('unhandledRejection');
    });

    process.once('uncaughtException', async (err) => {
      console.error('Uncaught exception:', err);
      await this.cleanupAll('uncaughtException');
      throw err;
    });
  }

  private async cleanupAll(reason: string) {
    try {
      await this.destroy();
    } catch (e) {
      console.error(`Failed to flush task events during ${reason}:`, e);
    }
  }

  /**
   * Log an event for a task.
   * @param body Parameters for logging a task event
   * @param body.task Task to log the event for
   * @param body.event Event to log
   */
  log(body: TaskLogParams) {
    this.eventQueue.push({
      ...body,
      event: {
        ...body.event,
        timestamp: Date.now() / 1000,
      },
    });

    // Flush immediately if queue is full
    if (this.eventQueue.length >= this.maxBatchSize) {
      this.flush();
    }

    return {
      queued: true,
      queueSize: this.eventQueue.length,
    };
  }

  /**
   * Manually flush all queued events.
   */
  async flush() {
    if (this.isProcessing || this.eventQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      const batch = this.eventQueue.splice(0, this.maxBatchSize);
      await this.sendBatch(batch);
    } catch (error) {
      console.error('Failed to flush task events:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Send a batch of events to the server.
   */
  private async sendBatch(events: QueuedEvent[]) {
    try {
      const response = await this._client.post<
        Readable,
        { events: TaskLogParams[] }
      >('/bot/task/log', {
        events,
      });

      return response;
    } catch (error) {
      this.eventQueue.unshift(...events);

      throw error;
    }
  }

  /**
   * Start periodic flushing of queued events.
   */
  private startPeriodicFlush() {
    this.flushTimer = setInterval(() => {
      this.flush().catch((error) => {
        console.error('Periodic flush of task events failed:', error);
      });
    }, this.flushInterval);
  }

  /**
   * Stop periodic flushing and flush remaining events.
   */
  async destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }

    // Flush any remaining events
    while (this.eventQueue.length > 0) {
      await this.flush();
    }
  }

  /**
   * Get current queue status.
   */
  getQueueStatus(): { size: number; isProcessing: boolean } {
    return {
      size: this.eventQueue.length,
      isProcessing: this.isProcessing,
    };
  }
}

export interface TaskLogParams {
  task: Pick<TaskForCode, 'id' | 'token'>;
  event: {
    type: string;
    [key: string]: any;
  };
}

type QueuedEvent = TaskLogParams & {
  event: {
    timestamp: number;
  };
};
