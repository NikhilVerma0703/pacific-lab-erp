/** Forum labels — shared by the client UI and the server actions. */

export const POST_KIND_LABEL = {
  ANNOUNCEMENT: "Announcement",
  TASK: "Today's Task",
  INSTRUCTION: "Sample Instruction",
  QUERY: "Query",
  PRODUCTION: "Production Instruction",
  OTHER: "Other",
} as const;

export type PostKind = keyof typeof POST_KIND_LABEL;
export const POST_KIND_VALUES = Object.keys(POST_KIND_LABEL) as PostKind[];

export const POST_STATUS_LABEL = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  COMPLETED: "Completed",
} as const;

export type PostStatus = keyof typeof POST_STATUS_LABEL;
export const POST_STATUS_VALUES = Object.keys(POST_STATUS_LABEL) as PostStatus[];

/**
 * Priority is stored as `important` today (Normal / Important — Important is
 * pinned to the top). To add more levels later, swap the boolean for an enum
 * and extend this map; the UI reads the options from here.
 */
export const POST_PRIORITY_LABEL = {
  NORMAL: "Normal",
  IMPORTANT: "Important",
} as const;

export type PostPriority = keyof typeof POST_PRIORITY_LABEL;
