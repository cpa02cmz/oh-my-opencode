import { tool, type ToolDefinition } from "@opencode-ai/plugin/tool"
import { readdirSync, unlinkSync, existsSync } from "fs"
import { join } from "path"
import { TaskSchema, type Task, type TaskStatus } from "../../features/sisyphus-tasks/types"
import {
  readJsonSafe,
  writeJsonAtomic,
  acquireLock,
  ensureDir,
} from "../../features/sisyphus-tasks/storage"
import {
  formatTaskList,
  formatTaskCreate,
  formatTaskGet,
  formatTaskUpdate,
  formatTaskDelete,
} from "../../features/sisyphus-tasks/formatters"

export const taskTool: ToolDefinition = tool({
  description: "Manage tasks with create, list, get, update, delete actions",
  args: {
    action: tool.schema.enum(["create", "list", "get", "update", "delete"]),
    taskID: tool.schema.string().optional().describe("Task ID (required for get/update/delete)"),
    title: tool.schema.string().optional().describe("Task title (required for create)"),
    description: tool.schema.string().optional(),
    status: tool.schema.string().optional().describe("open | in_progress | completed"),
    dependsOn: tool.schema.string().optional().describe("JSON array of task IDs"),
    parentID: tool.schema.string().optional(),
    repoURL: tool.schema.string().optional(),
    threadID: tool.schema.string().optional(),
    owner: tool.schema.string().optional(),
    limit: tool.schema.number().optional(),
    ready: tool.schema.boolean().optional(),
    task_dir: tool.schema.string().optional(),
  },
  execute: async (args) => {
    const taskDir = args.task_dir ?? join(process.cwd(), ".sisyphus", "tasks", "default")

    switch (args.action) {
      case "create": {
        if (!args.title) {
          return "Error: title is required for create action"
        }

        const lock = acquireLock(taskDir)
        try {
          ensureDir(taskDir)
          const files = existsSync(taskDir)
            ? readdirSync(taskDir).filter((f: string) => f.endsWith(".json") && !f.startsWith("."))
            : []
          const ids = files.map((f: string) => parseInt(f.replace(".json", ""), 10)).filter((n: number) => !isNaN(n))
          const nextId = ids.length > 0 ? Math.max(...ids) + 1 : 1

          const dependsOnParsed: string[] = args.dependsOn ? JSON.parse(args.dependsOn as string) : []

          const task: Task = {
            id: String(nextId),
            title: args.title,
            description: args.description ?? "",
            status: "open",
            dependsOn: dependsOnParsed,
            parentID: args.parentID,
            repoURL: args.repoURL,
            threadID: args.threadID,
            owner: args.owner,
          }

          writeJsonAtomic(join(taskDir, `${nextId}.json`), task)
          return formatTaskCreate({ id: task.id, title: task.title })
        } finally {
          lock.release()
        }
      }

      case "list": {
        ensureDir(taskDir)
        const files = existsSync(taskDir)
          ? readdirSync(taskDir).filter((f: string) => f.endsWith(".json") && !f.startsWith("."))
          : []

        if (files.length === 0) {
          return "No tasks found."
        }

        let tasks: Task[] = []
        const completedIds = new Set<string>()

        for (const file of files) {
          const task = readJsonSafe(join(taskDir, file), TaskSchema)
          if (task) {
            tasks.push(task)
            if (task.status === "completed") completedIds.add(task.id)
          }
        }

        if (args.status) {
          tasks = tasks.filter(t => t.status === args.status)
        }

        if (args.repoURL) {
          tasks = tasks.filter(t => t.repoURL === args.repoURL)
        }

        if (args.ready) {
          tasks = tasks.filter(t => t.dependsOn.every(depId => completedIds.has(depId)))
        }

        if (args.limit && args.limit > 0) {
          tasks = tasks.slice(0, args.limit)
        }

        if (tasks.length === 0) {
          return "No tasks found."
        }

        return formatTaskList(tasks, completedIds)
      }

      case "get": {
        if (!args.taskID) {
          return "Error: taskID is required for get action"
        }

        ensureDir(taskDir)
        const taskPath = join(taskDir, `${args.taskID}.json`)
        const task = readJsonSafe(taskPath, TaskSchema)

        return formatTaskGet(task)
      }

      case "update": {
        if (!args.taskID) {
          return "Error: taskID is required for update action"
        }

        const lock = acquireLock(taskDir)
        try {
          ensureDir(taskDir)
          const taskPath = join(taskDir, `${args.taskID}.json`)
          const task = readJsonSafe(taskPath, TaskSchema)

          if (!task) {
            return formatTaskUpdate({
              success: false,
              taskId: args.taskID,
              updatedFields: [],
              error: "task_not_found",
            })
          }

          const updatedFields: string[] = []

          if (args.title !== undefined) {
            task.title = args.title
            updatedFields.push("title")
          }
          if (args.description !== undefined) {
            task.description = args.description
            updatedFields.push("description")
          }
          if (args.status !== undefined) {
            task.status = args.status as TaskStatus
            updatedFields.push("status")
          }
          if (args.owner !== undefined) {
            task.owner = args.owner
            updatedFields.push("owner")
          }
          if (args.dependsOn !== undefined) {
            task.dependsOn = JSON.parse(args.dependsOn as string)
            updatedFields.push("dependsOn")
          }
          if (args.parentID !== undefined) {
            task.parentID = args.parentID
            updatedFields.push("parentID")
          }
          if (args.repoURL !== undefined) {
            task.repoURL = args.repoURL
            updatedFields.push("repoURL")
          }
          if (args.threadID !== undefined) {
            task.threadID = args.threadID
            updatedFields.push("threadID")
          }

          writeJsonAtomic(taskPath, task)

          let nextTask: { id: string; title: string } | undefined
          if (args.status === "completed") {
            const files = readdirSync(taskDir).filter((f: string) => f.endsWith(".json") && !f.startsWith("."))
            const allTasks: Task[] = []
            const completedIds = new Set<string>()

            for (const file of files) {
              const t = readJsonSafe(join(taskDir, file), TaskSchema)
              if (t) {
                allTasks.push(t)
                if (t.status === "completed") completedIds.add(t.id)
              }
            }

            const readyTasks = allTasks.filter(
              t => t.status === "open" && t.dependsOn.every(depId => completedIds.has(depId))
            )
            if (readyTasks.length > 0) {
              nextTask = { id: readyTasks[0].id, title: readyTasks[0].title }
            }
          }

          return formatTaskUpdate({
            success: true,
            taskId: args.taskID,
            updatedFields,
            nextTask,
          })
        } finally {
          lock.release()
        }
      }

      case "delete": {
        if (!args.taskID) {
          return "Error: taskID is required for delete action"
        }

        const lock = acquireLock(taskDir)
        try {
          ensureDir(taskDir)
          const taskPath = join(taskDir, `${args.taskID}.json`)

          if (!existsSync(taskPath)) {
            return formatTaskDelete({
              success: false,
              taskId: args.taskID,
              error: "task_not_found",
            })
          }

          const files = readdirSync(taskDir).filter(
            (f: string) => f.endsWith(".json") && !f.startsWith(".") && f !== `${args.taskID}.json`
          )

          const children: string[] = []
          for (const file of files) {
            const otherTask = readJsonSafe(join(taskDir, file), TaskSchema)
            if (otherTask?.parentID === args.taskID) {
              children.push(otherTask.id)
            }
          }

          if (children.length > 0) {
            return formatTaskDelete({
              success: false,
              taskId: args.taskID,
              error: "has_children",
              blockedChildren: children,
            })
          }

          for (const file of files) {
            const otherPath = join(taskDir, file)
            const otherTask = readJsonSafe(otherPath, TaskSchema)
            if (otherTask && otherTask.dependsOn.includes(args.taskID)) {
              otherTask.dependsOn = otherTask.dependsOn.filter((id: string) => id !== args.taskID)
              writeJsonAtomic(otherPath, otherTask)
            }
          }

          unlinkSync(taskPath)
          return formatTaskDelete({
            success: true,
            taskId: args.taskID,
          })
        } finally {
          lock.release()
        }
      }

      default:
        return `Unknown action: ${args.action}`
    }
  },
})
