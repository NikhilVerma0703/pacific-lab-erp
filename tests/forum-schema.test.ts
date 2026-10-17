import { describe, expect, it } from "vitest";
import { emptyPost, postHeading, postSchema, replySchema, statusSchema } from "@/modules/forum/schema";

describe("forum post schema", () => {
  it("starts with Posted by = Admin and needs only a message (title optional)", () => {
    expect(emptyPost().authorName).toBe("Admin");
    const r = postSchema.safeParse(emptyPost());
    expect(r.success).toBe(false);
    const paths = r.success ? [] : r.error.issues.map((i) => i.path[0]);
    expect(paths).toEqual(["message"]);
    const ok = postSchema.parse({ ...emptyPost(), message: "Kiln 2 maintenance on Friday" });
    expect(ok).toMatchObject({ title: "", authorName: "Admin" });
    expect(postHeading(ok)).toBe("Kiln 2 maintenance on Friday");
    expect(postSchema.safeParse({ ...emptyPost(""), message: "m" }).success).toBe(false); // the name can be changed, not emptied
  });

  it("accepts a complete post and trims it", () => {
    const r = postSchema.parse({ ...emptyPost("  Lab Head "), kind: "QUERY", title: " Update? ", message: "What is the update?" });
    expect(r.authorName).toBe("Lab Head");
    expect(r.title).toBe("Update?");
    expect(r.status).toBe("OPEN");
  });

  it("rejects an unknown type or status", () => {
    expect(postSchema.safeParse({ ...emptyPost("A"), title: "t", message: "m", kind: "NOPE" }).success).toBe(false);
    expect(statusSchema.safeParse("DONE").success).toBe(false);
    expect(statusSchema.parse("IN_PROGRESS")).toBe("IN_PROGRESS");
  });
});

describe("forum reply schema", () => {
  it("needs a message and the replier's name", () => {
    expect(replySchema.safeParse({ message: "  ", authorName: "Ravi" }).success).toBe(false);
    expect(replySchema.safeParse({ message: "On it", authorName: " " }).success).toBe(false);
    expect(replySchema.parse({ message: " On it ", authorName: "Ravi" })).toEqual({ message: "On it", authorName: "Ravi" });
  });
});
