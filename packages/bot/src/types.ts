// TODO: We shouldn't duplicate the enum types but instead import them from the automa

export type TaskItem = {
  id: number;
  type: 'origin' | 'message' | 'repo' | 'bot' | 'proposal' | 'activity';
  data: Record<string, any>;
};

export type Task = {
  id: number;
  token: string;
  title: string;
  items: TaskItem[];
};

export type Repo = {
  id: string;
  name: string;
  is_private: boolean;
};

export type Org = {
  id: string;
  name: string;
  provider_type: 'github' | 'gitlab';
};

export enum WebhookEventType {
  TaskCreated = 'task.created',
}

export type WebhookPayload = {
  id: string;
  timestamp: string;
} & (
  | {
      type: WebhookEventType.TaskCreated;
      data: {
        task: Task;
        repo: Repo;
        org: Org;
      };
    }
  | {
      type: never;
      data: never;
    }
);
