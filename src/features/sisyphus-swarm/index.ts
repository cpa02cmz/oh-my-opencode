// Swarm Manager
export { SwarmManager } from "./swarm-manager"
export type { TeammateState } from "./swarm-manager"

// Mailbox Types
export {
  MailboxMessageSchema,
  PermissionRequestSchema,
  PermissionResponseSchema,
  ShutdownRequestSchema,
  ShutdownApprovedSchema,
  ShutdownRejectedSchema,
  TaskAssignmentSchema,
  TaskCompletedSchema,
  IdleNotificationSchema,
  JoinRequestSchema,
  JoinApprovedSchema,
  JoinRejectedSchema,
  PlanApprovalRequestSchema,
  PlanApprovalResponseSchema,
  ModeSetRequestSchema,
  TeamPermissionUpdateSchema,
  ProtocolMessageSchema,
} from "./mailbox/types"
export type {
  MailboxMessage,
  PermissionRequest,
  PermissionResponse,
  ShutdownRequest,
  ShutdownApproved,
  ShutdownRejected,
  TaskAssignment,
  TaskCompleted,
  IdleNotification,
  JoinRequest,
  JoinApproved,
  JoinRejected,
  PlanApprovalRequest,
  PlanApprovalResponse,
  ModeSetRequest,
  TeamPermissionUpdate,
  ProtocolMessage,
} from "./mailbox/types"

// Mailbox Functions
export {
  getInboxPath,
  readMessages,
  getUnreadMessages,
  sendMessage,
  markAsRead,
  clearInbox,
} from "./mailbox/mailbox"

// Permission Poller
export {
  createPermissionRequest,
  registerCallback,
  processResponse,
  clearCallbacks,
  startPolling,
  stopPolling,
} from "./permission-poller"

// Formatters (from parallel task)
export { formatTeammate, formatSendMessage } from "./formatters"
