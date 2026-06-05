import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db/client";
import {
  blogPostsTable,
  users,
  type BlogPost,
  type InsertBlogPost,
  type UpdateBlogPost,
} from "@/lib/db/schema";

export type BlogCategory = BlogPost["category"];

interface ListFilters {
  category?: string;
  publishedOnly?: boolean;
}

/** Public/admin list of posts. `publishedOnly` restricts to published. */
export async function listPosts(filters: ListFilters = {}): Promise<BlogPost[]> {
  const conditions = [];
  if (filters.publishedOnly) conditions.push(eq(blogPostsTable.isPublished, 1));
  if (filters.category) {
    conditions.push(eq(blogPostsTable.category, filters.category as BlogCategory));
  }
  const where = conditions.length ? and(...conditions) : undefined;

  return db
    .select()
    .from(blogPostsTable)
    .where(where)
    .orderBy(desc(blogPostsTable.publishedAt), desc(blogPostsTable.createdAt));
}

export async function getPostBySlug(slug: string): Promise<BlogPost | null> {
  const [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.slug, slug)).limit(1);
  return post ?? null;
}

export async function getPostById(id: string): Promise<BlogPost | null> {
  const [post] = await db.select().from(blogPostsTable).where(eq(blogPostsTable.id, id)).limit(1);
  return post ?? null;
}

export async function incrementViews(id: string): Promise<void> {
  await db
    .update(blogPostsTable)
    .set({ viewCount: sql`${blogPostsTable.viewCount} + 1` })
    .where(eq(blogPostsTable.id, id));
}

export async function authorName(authorId: string): Promise<string> {
  const [author] = await db
    .select({ displayName: users.displayName, username: users.username })
    .from(users)
    .where(eq(users.id, authorId))
    .limit(1);
  return author?.displayName || author?.username || "관리자";
}

export async function createPost(data: InsertBlogPost): Promise<BlogPost> {
  const [post] = await db.insert(blogPostsTable).values(data).returning();
  return post;
}

export async function updatePost(id: string, data: UpdateBlogPost): Promise<BlogPost | null> {
  const [post] = await db
    .update(blogPostsTable)
    .set({ ...data, updatedAt: new Date() })
    .where(eq(blogPostsTable.id, id))
    .returning();
  return post ?? null;
}

export async function deletePost(id: string): Promise<void> {
  await db.delete(blogPostsTable).where(eq(blogPostsTable.id, id));
}
