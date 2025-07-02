// TODO: We shouldn't duplicate the enum types but instead import them from the automa

export type ProposalTaskItem = {
  id: number;
  type: 'proposal';
  data: {
    prId: number;
    prNumber: number;
    prTitle: string;
    prHead: string;
    prBase: string;
    prState: 'open' | 'closed';
    prMerged: boolean;
  };
  bot_id: number;
  repo_id: number;
};

export type TaskItem =
  | ProposalTaskItem
  | {
      id: number;
      type: 'origin' | 'message' | 'repo' | 'bot' | 'activity';
      data: Record<string, any>;
      bot_id: number | null;
      repo_id: number | null;
    };

export type Task = {
  id: number;
  title: string;
};

export type TaskForCode = Task & {
  token: string;
  items: TaskItem[];
};

export type Repo = {
  id: number;
  name: string;
  is_private: boolean;
};

export type Org = {
  id: number;
  name: string;
  provider_type: 'github' | 'gitlab';
};

export enum WebhookEventType {
  TaskCreated = 'task.created',
  ProposalAccepted = 'proposal.accepted',
  ProposalRejected = 'proposal.rejected',
}

export type WebhookPayload = {
  id: string;
  timestamp: string;
} & (
  | {
      type: WebhookEventType.TaskCreated;
      data: {
        task: TaskForCode;
        repo: Repo;
        org: Org;
      };
    }
  | {
      type:
        | WebhookEventType.ProposalAccepted
        | WebhookEventType.ProposalRejected;
      data: {
        proposal: ProposalTaskItem;
        task: Task;
        org: Org;
      };
    }
  | {
      type: never;
      data: never;
    }
);

// Helper to get webhook data type for event
export type WebhookEventData<T extends WebhookEventType> = Extract<
  WebhookPayload,
  { type: T }
>['data'];
