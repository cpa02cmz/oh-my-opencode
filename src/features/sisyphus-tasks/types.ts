import { z } from "zod"

export const TaskStatusSchema = z.enum(["open", "in_progress", "completed"])
export type TaskStatus = z.infer<typeof TaskStatusSchema>

export const TaskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  status: TaskStatusSchema,
  dependsOn: z.array(z.string()),
  owner: z.string().optional(),
  parentID: z.string().optional(),
  repoURL: z.string().optional(),
  threadID: z.string().optional(),
}).strict()

export type Task = z.infer<typeof TaskSchema>

export const TaskToolInputSchema = z.object({
  action: z.enum(["create", "list", "get", "update", "delete"]),
  taskID: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional(),
  status: TaskStatusSchema.optional(),
  dependsOn: z.array(z.string()).optional(),
  parentID: z.string().optional(),
  repoURL: z.string().optional(),
  threadID: z.string().optional(),
  owner: z.string().optional(),
  limit: z.number().optional(),
  ready: z.boolean().optional(),
})

export type TaskToolInput = z.infer<typeof TaskToolInputSchema>
