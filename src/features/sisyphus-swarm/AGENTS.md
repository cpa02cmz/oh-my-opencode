# SISYPHUS SWARM KNOWLEDGE BASE

## OVERVIEW

Multi-agent coordination system ported from Claude Code. Supports teammate spawning, file-based IPC via mailbox, permission polling, and tmux pane management.

## STRUCTURE

```
sisyphus-swarm/
├── mailbox/
│   ├── types.ts          # MailboxMessage, ProtocolMessage schemas
│   ├── types.test.ts     # Schema validation tests
│   ├── mailbox.ts        # read/send/markAsRead/clearInbox
│   └── mailbox.test.ts   # Mailbox operation tests
├── permission-poller/
│   ├── index.ts          # Real polling + request/response callbacks
│   └── index.test.ts     # Polling + callback tests
├── tmux-backend/
│   ├── index.ts          # Pane creation/styling/cleanup
│   └── index.test.ts     # Tmux backend tests
├── swarm-manager.ts      # Lifecycle orchestrator (spawn → track → shutdown → cleanup)
├── swarm-manager.test.ts # Manager lifecycle tests
├── e2e.test.ts           # Integration tests
├── index.ts              # Barrel exports (SwarmManager, TeammateState)
└── AGENTS.md             # This file
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
| SendMessageTool | Send messages to agents via mailbox |

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
- **Permission flow**: Request → Real polling via `getUnreadMessages` → Response callback
- **tmux integration**: Pane split for visual monitoring when `ui_mode` is "tmux" or "both"
- **SwarmManager lifecycle**: 
  - `spawn()`: Create teammate agent, register in BackgroundManager
  - `track()`: Monitor agent state via permission poller
  - `shutdown()`: Request graceful shutdown via mailbox
  - `cleanup()`: Remove tmux pane (if applicable), clear inbox
- **Integration**: SwarmManager coordinates with BackgroundManager for agent lifecycle
- **Real polling**: Permission poller uses `getUnreadMessages` + `PermissionResponseSchema.safeParse` for validation

## ANTI-PATTERNS

- Direct file access (use mailbox.ts functions)
- Blocking polls (use async with interval)
- Orphan messages (always markAsRead or clearInbox)
