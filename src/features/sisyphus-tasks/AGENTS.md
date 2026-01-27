# SISYPHUS TASKS KNOWLEDGE BASE

## OVERVIEW

Task management system ported from Claude Code. File-based storage with Zod validation. Supports task dependencies, execution claiming, and status tracking.

## STRUCTURE

```
sisyphus-tasks/
├── types.ts         # Task/TaskUpdate Zod schemas
├── storage.ts       # File ops (ensureDir, readJsonSafe, writeJsonAtomic, acquireLock)
├── formatters.ts    # Tool output formatters
├── index.ts         # Barrel exports
└── ...
```

## TASK SCHEMA

```typescript
{
  id: string,
  title: string,
  description: string,
  status: "open" | "in_progress" | "completed",
  dependsOn: string[],
  owner?: string,
  parentID?: string,
  repoURL?: string,
  threadID?: string
}
```

## TOOLS (in src/tools/sisyphus-tasks/)

| Tool | Purpose |
|------|---------|
| task_tool | Unified task management with 5 actions: create, list, get, update, delete |

**Actions**:
- `create`: Create task with title (required), supports parentID/repoURL/dependsOn
- `list`: List tasks with optional filters (status, repoURL, ready, limit)
- `get`: Retrieve single task by ID
- `update`: Update any task field, returns nextTask when status → completed
- `delete`: Delete task, blocks if children exist, cleans up dependsOn references

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

- **File-based locking**: Uses `.lock` files to ensure atomic writes across multiple agents
- **Ready filter**: `list` action can filter for tasks whose dependencies are all `completed`
- **Next task suggestion**: `update` action returns the next `ready` task when a task is marked `completed`
- **Child protection**: `delete` action blocks if the task has subtasks (parentID reference)
- **Dependency cleanup**: `delete` action automatically removes the task ID from other tasks' `dependsOn` lists

## ANTI-PATTERNS

- Direct file manipulation (use storage.ts helpers)
- Skipping blocking checks (always check blockedBy)
- Ignoring return values (check success/reason)
