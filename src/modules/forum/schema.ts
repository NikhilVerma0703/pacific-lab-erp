import { z } from "zod";
import { POST_KIND_VALUES, POST_STATUS_VALUES, type PostKind, type PostStatus } from "./kinds";

/**
 * While sign-in is off everyone works as one built-in user, so the person
 * posting or replying types their name (remembered on that computer). When
 * sign-in returns, drop `authorName` and take the signed-in user's name.
 */
const authorName = z.string().trim().min(1, "Enter your name.").max(80, "Keep the name under 80 characters.");

export const postSchema = z.object({
  kind: z.enum(POST_KIND_VALUES as [PostKind, ...PostKind[]]),
  title: z.string().trim().min(1, "Enter a title.").max(150, "Keep the title under 150 characters."),
  message: z.string().trim().min(1, "Enter the message.").max(4000, "Keep the message under 4000 characters."),
  important: z.boolean(),
  status: z.enum(POST_STATUS_VALUES as [PostStatus, ...PostStatus[]]),
  authorName,
});

export const replySchema = z.object({
  message: z.string().trim().min(1, "Write a reply.").max(2000, "Keep the reply under 2000 characters."),
  authorName,
});

export const statusSchema = z.enum(POST_STATUS_VALUES as [PostStatus, ...PostStatus[]]);

export type PostInput = z.input<typeof postSchema>;
export type ReplyInput = z.input<typeof replySchema>;

export const emptyPost = (authorName = ""): PostInput => ({
  kind: "ANNOUNCEMENT",
  title: "",
  message: "",
  important: false,
  status: "OPEN",
  authorName,
});
