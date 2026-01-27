# SISYPHUS TASKS KNOWLEDGE BASE

## OVERVIEW

Task management system ported from Claude Code. File-based storage with Zod validation. Supports task dependencies, execution claiming, and status tracking.

## STRUCTURE

```
sisyphus-tasks/
├── types.ts         # Task/TaskUpdate Zod schemas
├── storage.ts       # File ops (ensureDir, readJsonSafe, writeJsonAtomic)
├── task-execute.ts  # Atomic task claiming with lock check
├── task-get.ts      # Single task retrieval
├── task-resume.ts   # Resume with busy-check
├── task-wait.ts     # Poll until completion
├── index.ts         # Barrel exports
└── e2e.test.ts      # Full lifecycle tests
```

## TASK SCHEMA

```typescript
{
  id: string,
  subject: string,
  description: string,
  activeForm?: string,
  owner?: string,
  status: "pending" | "in_progress" | "completed",
  blocks: string[],
  blockedBy: string[],
  metadata?: Record<string, unknown>
}
```

## TOOLS (in src/tools/sisyphus-tasks/)

| Tool | Purpose |
|------|---------|
| TaskList | List all tasks with status/blocking info |
| TaskCreate | Create new task with auto ID |
| TaskGet | Retrieve single task |
| TaskUpdate | Update fields, manage dependencies |
| TaskAbort | Delete task, clean up deps |
| TaskRemove | Alias for TaskAbort |
| TaskSuspend | Release claim, set pending |
| TaskExecute | Atomic claim with blocking check |
| TaskResume | Claim if agent not busy |
| TaskWait | Poll until completed |

## CONFIG

```json
{
  "sisyphus": {
    "tasks": {
      "enabled": true,
      "storage_path": ".sisyphus/tasks",
      "claude_code_compat": false
    }
  }
}
```

## KEY BEHAVIORS

- **Atomic claiming**: TaskExecute checks owner + blockers atomically
- **Bidirectional deps**: addBlockedBy updates both tasks
- **Auto cleanup**: TaskAbort removes from other tasks' deps
- **Agent busy check**: TaskResume fails if agent has active task

## ANTI-PATTERNS

- Direct file manipulation (use storage.ts helpers)
- Skipping blocking checks (always check blockedBy)
- Ignoring return values (check success/reason)
