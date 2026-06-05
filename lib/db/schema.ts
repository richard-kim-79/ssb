import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name"),
  isAdmin: integer("is_admin").notNull().default(0), // 0 = regular, 1 = admin
  isGuest: integer("is_guest").notNull().default(0), // 0 = regular, 1 = guest
  guestUsageCount: integer("guest_usage_count").notNull().default(0),
  lastSessionId: text("last_session_id"), // concurrent-login prevention
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at"),
});

// ---------------------------------------------------------------------------
// Subscription plans
// ---------------------------------------------------------------------------
export const subscriptionPlansTable = pgTable("subscription_plans", {
  id: varchar("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  price: integer("price").notNull(), // KRW
  currency: text("currency").notNull().default("KRW"),
  billingPeriod: text("billing_period", { enum: ["monthly", "yearly"] }).notNull().default("monthly"),
  maxEssaysPerMonth: integer("max_essays_per_month").notNull(),
  maxUsers: integer("max_users").default(1),
  features: jsonb("features").notNull(), // string[]
  isActive: integer("is_active").notNull().default(1),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Subscriptions
// ---------------------------------------------------------------------------
export const subscriptionsTable = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  planId: varchar("plan_id").references(() => subscriptionPlansTable.id).notNull(),
  nextPlanId: varchar("next_plan_id").references(() => subscriptionPlansTable.id),
  planChangeScheduledAt: timestamp("plan_change_scheduled_at"),
  status: text("status", { enum: ["active", "canceled", "expired", "trial"] }).notNull().default("trial"),
  paymentMethod: text("payment_method", { enum: ["toss_billing", "toss_onetime"] }),
  autoRenew: integer("auto_renew").notNull().default(0),
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date").notNull(),
  renewsAt: timestamp("renews_at"),
  canceledAt: timestamp("canceled_at"),
  trialEndsAt: timestamp("trial_ends_at"),
  tossBillingKey: text("toss_billing_key"),
  tossCustomerKey: text("toss_customer_key"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Usage tracking
// ---------------------------------------------------------------------------
export const usageTrackingTable = pgTable("usage_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  subscriptionId: varchar("subscription_id").references(() => subscriptionsTable.id).notNull(),
  essayCount: integer("essay_count").notNull().default(0),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  lastResetAt: timestamp("last_reset_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Payment transactions
// ---------------------------------------------------------------------------
export const paymentTransactionsTable = pgTable("payment_transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  subscriptionId: varchar("subscription_id").references(() => subscriptionsTable.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  planId: varchar("plan_id").references(() => subscriptionPlansTable.id).notNull(),
  orderId: text("order_id").notNull().unique(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull().default("KRW"),
  status: text("status", { enum: ["success", "failed", "pending"] }).notNull().default("pending"),
  paymentKey: text("payment_key"),
  failureCode: text("failure_code"),
  failureReason: text("failure_reason"),
  retryCount: integer("retry_count").notNull().default(0),
  lastRetryAt: timestamp("last_retry_at"),
  nextRetryAt: timestamp("next_retry_at"),
  capturedAt: timestamp("captured_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Payment intents (persisted, 30-min expiry)
// ---------------------------------------------------------------------------
export const paymentIntentsTable = pgTable("payment_intents", {
  intentId: varchar("intent_id").primaryKey(),
  userId: varchar("user_id").notNull(),
  planId: varchar("plan_id").notNull(),
  amount: integer("amount").notNull(),
  used: integer("used").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at").notNull(),
});

// ---------------------------------------------------------------------------
// Analysis sessions (exam prompt + grading rubric)
// ---------------------------------------------------------------------------
export const analysisSessionsTable = pgTable("analysis_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  promptContent: text("prompt_content").notNull(),
  criteriaContent: text("criteria_content").notNull(),
  promptFilenames: text("prompt_filenames").array().notNull(),
  criteriaFilenames: text("criteria_filenames").array().notNull(),
  promptFilePaths: text("prompt_file_paths").array(),
  criteriaFilePaths: text("criteria_file_paths").array(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Essay submissions
// ---------------------------------------------------------------------------
export const essaySubmissionsTable = pgTable("essay_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").references(() => analysisSessionsTable.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  studentName: text("student_name"),
  studentId: text("student_id"),
  essayContent: text("essay_content").notNull(),
  essayFilePath: text("essay_file_path"),
  essayFilename: text("essay_filename"),
  status: text("status", { enum: ["pending", "analyzing", "completed", "error"] }).notNull().default("pending"),
  progress: integer("progress").notNull().default(0),
  progressMessage: text("progress_message").default("대기 중입니다"),
  submittedAt: timestamp("submitted_at").defaultNow().notNull(),
  analysisStartedAt: timestamp("analysis_started_at"),
  analysisCompletedAt: timestamp("analysis_completed_at"),
});

// ---------------------------------------------------------------------------
// Analysis results (+ model/tier for hybrid auditing)
// ---------------------------------------------------------------------------
export const analysisResultsTable = pgTable("analysis_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").references(() => essaySubmissionsTable.id).notNull(),
  revisionId: varchar("revision_id"), // null = original; set when this result grades a revision
  overallScore: integer("overall_score").notNull(),
  maxScore: integer("max_score").notNull().default(100),
  categoryScores: jsonb("category_scores").notNull(), // {name, score, maxScore, feedback}[]
  strengths: jsonb("strengths").notNull(), // string[]
  improvementAreas: jsonb("improvement_areas").notNull(), // string[]
  detailedFeedback: text("detailed_feedback").notNull(),
  suggestions: jsonb("suggestions").notNull(), // string[]
  model: text("model"), // e.g. "gemini-2.5-flash"
  tier: text("tier"), // "flash" | "pro" | "pro_fallback"
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// NEW: Essay revisions (versioning + re-grade tracking)
// ---------------------------------------------------------------------------
export const essayRevisionsTable = pgTable("essay_revisions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").references(() => essaySubmissionsTable.id, { onDelete: "cascade" }).notNull(),
  versionNumber: integer("version_number").notNull(), // 1 = original snapshot
  parentRevisionId: varchar("parent_revision_id"),
  content: text("content").notNull(), // normalized snapshot of this version's essay
  diffFromParent: jsonb("diff_from_parent"), // op list parent->this
  resultId: varchar("result_id").references(() => analysisResultsTable.id),
  overallScore: integer("overall_score"), // denormalized for fast delta
  maxScore: integer("max_score"),
  scoreDelta: integer("score_delta"), // this - parent
  improvedCategories: jsonb("improved_categories"), // {name, before, after, delta}[]
  status: text("status", { enum: ["pending", "analyzing", "completed", "error"] }).notNull().default("pending"),
  progress: integer("progress").notNull().default(0),
  progressMessage: text("progress_message").default("대기 중입니다"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// ---------------------------------------------------------------------------
// NEW: Essay annotations (inline 첨삭, anchored to text spans)
// ---------------------------------------------------------------------------
export const essayAnnotationsTable = pgTable("essay_annotations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  submissionId: varchar("submission_id").references(() => essaySubmissionsTable.id, { onDelete: "cascade" }).notNull(),
  revisionId: varchar("revision_id").references(() => essayRevisionsTable.id, { onDelete: "cascade" }), // null = original text
  type: text("type", { enum: ["correction", "highlight", "comment"] }).notNull(),
  startOffset: integer("start_offset").notNull(), // char offset into normalized text
  endOffset: integer("end_offset").notNull(),
  quotedText: text("quoted_text").notNull(), // exact span at creation time (anchor fallback)
  prefix: text("prefix"), // ~24 chars before span (context anchor)
  suffix: text("suffix"), // ~24 chars after span (context anchor)
  suggestedText: text("suggested_text"), // red-pen replacement (corrections)
  comment: text("comment"), // per-span note
  color: text("color"), // highlight color
  severity: text("severity", { enum: ["minor", "major", "suggestion"] }),
  source: text("source", { enum: ["ai", "user"] }).notNull().default("ai"),
  orphaned: integer("orphaned").notNull().default(0), // 1 = couldn't re-anchor after revision
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Device tracking / abuse prevention
// ---------------------------------------------------------------------------
export const devicesTable = pgTable("devices", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceToken: text("device_token").notNull().unique(),
  fingerprint: text("fingerprint").notNull(),
  ipAddress: text("ip_address").notNull(),
  country: text("country"),
  city: text("city"),
  region: text("region"),
  userAgent: text("user_agent"),
  language: text("language"),
  timezone: text("timezone"),
  platform: text("platform"),
  requestCount: integer("request_count").notNull().default(0),
  riskScore: integer("risk_score").notNull().default(0),
  lastSeenAt: timestamp("last_seen_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const rateLimitsTable = pgTable("rate_limits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  identifier: text("identifier").notNull(),
  type: text("type", { enum: ["ip", "device"] }).notNull(),
  action: text("action").notNull(),
  count: integer("count").notNull().default(1),
  windowStart: timestamp("window_start").defaultNow().notNull(),
  resetAt: timestamp("reset_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const abuseTrackingTable = pgTable("abuse_tracking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").references(() => devicesTable.id),
  ipAddress: text("ip_address").notNull(),
  eventType: text("event_type").notNull(),
  description: text("description"),
  metadata: jsonb("metadata"),
  riskScore: integer("risk_score").notNull().default(0),
  actionTaken: text("action_taken"),
  detectedAt: timestamp("detected_at").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const emailVerificationsTable = pgTable("email_verifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  deviceId: varchar("device_id").references(() => devicesTable.id).notNull(),
  email: text("email").notNull(),
  verificationCode: text("verification_code").notNull(),
  isVerified: integer("is_verified").notNull().default(0),
  expiresAt: timestamp("expires_at").notNull(),
  verifiedAt: timestamp("verified_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// Blog
// ---------------------------------------------------------------------------
export const blogPostsTable = pgTable("blog_posts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  authorId: varchar("author_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  slug: text("slug").notNull().unique(),
  excerpt: text("excerpt").notNull(),
  content: text("content").notNull(),
  category: text("category", {
    enum: ["essay-tips", "admission-info", "platform-guide", "education-news"],
  }).notNull(),
  tags: text("tags").array().default(sql`ARRAY[]::text[]`),
  featuredImage: text("featured_image"),
  metaTitle: text("meta_title"),
  metaDescription: text("meta_description"),
  isPublished: integer("is_published").notNull().default(0),
  publishedAt: timestamp("published_at"),
  viewCount: integer("view_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const blogAttachmentsTable = pgTable("blog_attachments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  blogPostId: varchar("blog_post_id").references(() => blogPostsTable.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  filepath: text("filepath").notNull(),
  fileType: text("file_type", { enum: ["image", "document"] }).notNull(),
  mimeType: text("mime_type").notNull(),
  fileSize: integer("file_size").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  uploadedAt: timestamp("uploaded_at").defaultNow().notNull(),
});

// ---------------------------------------------------------------------------
// API keys (GPT Actions) — store only a SHA-256 hash of the key
// ---------------------------------------------------------------------------
export const apiKeysTable = pgTable("api_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id).notNull(),
  keyHash: text("key_hash").notNull().unique(), // sha256(key); plaintext shown once at creation
  keyPrefix: text("key_prefix").notNull().default(""), // e.g. "sk_abc1" for display
  name: text("name").notNull(),
  usageCount: integer("usage_count").notNull().default(0),
  lastUsedAt: timestamp("last_used_at"),
  isActive: integer("is_active").notNull().default(1),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// ===========================================================================
// Zod insert schemas
// ===========================================================================
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  password: true,
  displayName: true,
});

export const insertGuestUserSchema = createInsertSchema(users).pick({
  username: true,
  isGuest: true,
});

export const userLoginSchema = z.object({
  username: z.string().min(1, "사용자명을 입력해주세요"),
  password: z.string().min(1, "비밀번호를 입력해주세요"),
});

export const insertSubscriptionPlanSchema = createInsertSchema(subscriptionPlansTable).omit({ createdAt: true });
export const insertSubscriptionSchema = createInsertSchema(subscriptionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUsageTrackingSchema = createInsertSchema(usageTrackingTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentTransactionSchema = createInsertSchema(paymentTransactionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertAnalysisSessionSchema = createInsertSchema(analysisSessionsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertEssaySubmissionSchema = createInsertSchema(essaySubmissionsTable).omit({
  id: true,
  submittedAt: true,
  analysisStartedAt: true,
  analysisCompletedAt: true,
}).extend({
  status: z.enum(["pending", "analyzing", "completed", "error"]).default("pending"),
});
export const insertAnalysisResultSchema = createInsertSchema(analysisResultsTable).omit({ id: true, createdAt: true });
export const insertEssayRevisionSchema = createInsertSchema(essayRevisionsTable).omit({ id: true, createdAt: true, completedAt: true });
export const insertEssayAnnotationSchema = createInsertSchema(essayAnnotationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDeviceSchema = createInsertSchema(devicesTable).omit({ id: true, createdAt: true });
export const insertRateLimitSchema = createInsertSchema(rateLimitsTable).omit({ id: true, createdAt: true });
export const insertAbuseTrackingSchema = createInsertSchema(abuseTrackingTable).omit({ id: true, createdAt: true });
export const insertEmailVerificationSchema = createInsertSchema(emailVerificationsTable).omit({ id: true, createdAt: true });
export const insertBlogPostSchema = createInsertSchema(blogPostsTable).omit({ id: true, viewCount: true, createdAt: true, updatedAt: true });
export const updateBlogPostSchema = createInsertSchema(blogPostsTable).omit({ id: true, authorId: true, viewCount: true, createdAt: true, updatedAt: true }).partial();
export const insertBlogAttachmentSchema = createInsertSchema(blogAttachmentsTable).omit({ id: true, uploadedAt: true });
export const insertApiKeySchema = createInsertSchema(apiKeysTable).omit({ id: true, usageCount: true, lastUsedAt: true, createdAt: true });

// ===========================================================================
// Inferred types
// ===========================================================================
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UserLogin = z.infer<typeof userLoginSchema>;

export type SubscriptionPlan = typeof subscriptionPlansTable.$inferSelect;
export type InsertSubscriptionPlan = z.infer<typeof insertSubscriptionPlanSchema>;
export type Subscription = typeof subscriptionsTable.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type UsageTracking = typeof usageTrackingTable.$inferSelect;
export type InsertUsageTracking = z.infer<typeof insertUsageTrackingSchema>;
export type PaymentTransaction = typeof paymentTransactionsTable.$inferSelect;
export type InsertPaymentTransaction = z.infer<typeof insertPaymentTransactionSchema>;
export type PaymentIntentRow = typeof paymentIntentsTable.$inferSelect;

export type AnalysisSession = typeof analysisSessionsTable.$inferSelect;
export type InsertAnalysisSession = z.infer<typeof insertAnalysisSessionSchema>;
export type EssaySubmission = typeof essaySubmissionsTable.$inferSelect;
export type InsertEssaySubmission = z.infer<typeof insertEssaySubmissionSchema>;
export type AnalysisResult = typeof analysisResultsTable.$inferSelect;
export type InsertAnalysisResult = z.infer<typeof insertAnalysisResultSchema>;
export type EssayRevision = typeof essayRevisionsTable.$inferSelect;
export type InsertEssayRevision = z.infer<typeof insertEssayRevisionSchema>;
export type EssayAnnotation = typeof essayAnnotationsTable.$inferSelect;
export type InsertEssayAnnotation = z.infer<typeof insertEssayAnnotationSchema>;

export type Device = typeof devicesTable.$inferSelect;
export type InsertDevice = z.infer<typeof insertDeviceSchema>;
export type RateLimit = typeof rateLimitsTable.$inferSelect;
export type InsertRateLimit = z.infer<typeof insertRateLimitSchema>;
export type AbuseTracking = typeof abuseTrackingTable.$inferSelect;
export type InsertAbuseTracking = z.infer<typeof insertAbuseTrackingSchema>;
export type EmailVerification = typeof emailVerificationsTable.$inferSelect;
export type InsertEmailVerification = z.infer<typeof insertEmailVerificationSchema>;

export type BlogPost = typeof blogPostsTable.$inferSelect;
export type InsertBlogPost = z.infer<typeof insertBlogPostSchema>;
export type UpdateBlogPost = z.infer<typeof updateBlogPostSchema>;
export type BlogAttachment = typeof blogAttachmentsTable.$inferSelect;
export type InsertBlogAttachment = z.infer<typeof insertBlogAttachmentSchema>;

export type ApiKey = typeof apiKeysTable.$inferSelect;
export type InsertApiKey = z.infer<typeof insertApiKeySchema>;

// ===========================================================================
// Frontend-friendly shared types
// ===========================================================================
export interface CategoryScore {
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface UserWithSubscription extends User {
  subscription?: Subscription & {
    plan: SubscriptionPlan;
    usage?: UsageTracking;
  };
}

export interface SubscriptionStatus {
  isActive: boolean;
  plan: SubscriptionPlan;
  usage: { current: number; limit: number; resetDate: string };
  daysRemaining?: number;
  subscription?: {
    paymentMethod?: string;
    autoRenew?: boolean;
    tossBillingKey?: string;
    nextPlanId?: string;
    planChangeScheduledAt?: Date;
  };
}

export interface BlogPostPreview {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  category: string;
  tags?: string[];
  featuredImage?: string;
  authorName: string;
  publishedAt: string;
  viewCount: number;
}

export interface BlogPostDetail extends BlogPostPreview {
  content: string;
  metaTitle?: string;
  metaDescription?: string;
}

// ===========================================================================
// Plan helper functions
// ===========================================================================
export function canUseBatchProcessing(planId: string): boolean {
  return (
    planId === "individual" ||
    planId === "individual_yearly" ||
    planId === "educator" ||
    planId === "educator_yearly" ||
    planId === "business"
  );
}

export function getBatchLimitForPlan(planId: string): number {
  switch (planId) {
    case "individual":
    case "individual_yearly":
      return 3;
    case "educator":
    case "educator_yearly":
    case "business":
      return 50;
    default:
      return 1;
  }
}

export function getPlanDisplayName(planId: string): string {
  switch (planId) {
    case "trial":
      return "무료 체험";
    case "individual":
      return "개인 플랜";
    case "individual_yearly":
      return "개인 플랜 (연간)";
    case "educator":
      return "교사 플랜";
    case "educator_yearly":
      return "교사 플랜 (연간)";
    case "business":
      return "비즈니스 플랜";
    default:
      return "알 수 없는 플랜";
  }
}
