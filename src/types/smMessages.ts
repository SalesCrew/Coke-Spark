export type SmMessageDirectoryRecipient = {
  id: string;
  name: string;
  email: string;
};

export type SmAdminMessageRecipient = {
  recipientId: string;
  name: string;
  email: string;
  deliveredAt: string;
  readAt: string | null;
};

export type SmAdminMessage = {
  id: string;
  subject: string;
  body: string;
  sender: string;
  sentAt: string;
  /** NULL exists only for historical messages created before retention rules. */
  visibleAfterReadDays: number | null;
  recipients: SmAdminMessageRecipient[];
};

export type SmAdminMessagesPayload = {
  messages: SmAdminMessage[];
  recipients: SmMessageDirectoryRecipient[];
};

export type SmInboxMessage = {
  id: string;
  subject: string;
  body: string;
  sender: string;
  sentAt: string;
  deliveredAt: string;
  readAt: string | null;
  visibleAfterReadDays: number | null;
  visibleUntil: string | null;
};
