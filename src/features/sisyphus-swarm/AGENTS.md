# SISYPHUS SWARM KNOWLEDGE BASE

## OVERVIEW

Multi-agent coordination system ported from Claude Code. Supports teammate spawning, file-based IPC via mailbox, permission polling, and tmux pane management.

## STRUCTURE

```
sisyphus-swarm/
├── mailbox/
│   ├── types.ts     # MailboxMessage, ProtocolMessage schemas
│   └── mailbox.ts   # read/send/markAsRead/clearInbox
├── permission-poller/
│   └── index.ts     # Request/response with callbacks
├── tmux-backend/
│   └── index.ts     # Pane creation/styling/cleanup
└── index.ts         # Future barrel exports
```

## MAILBOX PROTOCOL

```typescript
MailboxMessage {
  from: string,
  text: string,       // JSON-serialized ProtocolMessage
  timestamp: string,  // ISO 8601
  color?: string,
  read: boolean
}

ProtocolMessage types:
- permission_request / permission_response
- shutdown_request / shutdown_approved / shutdown_rejected
- task_assignment / task_completed
- idle_notification
- join_request / join_approved / join_rejected
- plan_approval_request / plan_approval_response
- mode_set_request
- team_permission_update
```

## TOOLS (in src/tools/sisyphus-swarm/)

| Tool | Purpose |
|------|---------|
| TeammateTool | Spawn new teammate agent |

## CONFIG

```json
{
  "sisyphus": {
    "swarm": {
      "enabled": true,
      "storage_path": ".sisyphus/teams",
      "ui_mode": "toast"  // "toast" | "tmux" | "both"
    }
  }
}
```

## KEY BEHAVIORS

- **File-based IPC**: Messages stored as JSON arrays
- **Inbox per agent**: `{teamDir}/inboxes/{agentName}.json`
- **Permission flow**: Request → Poll → Response callback
- **tmux integration**: Pane split for visual monitoring

## ANTI-PATTERNS

- Direct file access (use mailbox.ts functions)
- Blocking polls (use async with interval)
- Orphan messages (always markAsRead or clearInbox)
