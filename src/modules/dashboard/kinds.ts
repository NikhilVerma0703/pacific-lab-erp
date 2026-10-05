/** Announcement types — shared by the form (client) and the action (server). */
export const ANNOUNCEMENT_KIND_LABEL = {
  ANNOUNCEMENT: "Announcement",
  TASK: "Today's Task",
  INSTRUCTION: "Sample Instruction",
  QUERY: "Query",
  PRODUCTION: "Production Instruction",
  OTHER: "Other",
} as const;

export type AnnouncementKindValue = keyof typeof ANNOUNCEMENT_KIND_LABEL;
export const ANNOUNCEMENT_KIND_VALUES = Object.keys(ANNOUNCEMENT_KIND_LABEL) as AnnouncementKindValue[];
