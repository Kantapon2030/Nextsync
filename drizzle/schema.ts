// drizzle/schema.ts
import { 
  pgTable, 
  uuid, 
  text, 
  boolean, 
  timestamp, 
  integer, 
  doublePrecision, 
  date, 
  customType,
  pgEnum,
  index
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

// Custom vector type for pgvector
// We use vector(512) because ArcFace generates 512-dimensional embeddings.
export const vector = customType<{ data: number[] }>({
  dataType() {
    return "vector(512)";
  },
  toDriver(value: number[]): string {
    if (!Array.isArray(value)) return "[]";
    return `[${value.join(",")}]`;
  },
  fromDriver(value: unknown): number[] {
    if (typeof value === "string") {
      // Postgres returns vector as "[0.1,0.2,-0.3,...]"
      return value.slice(1, -1).split(",").map(Number);
    }
    return value as number[];
  },
});

// Roles enum equivalent
export const roleEnum = ["student", "photographer", "admin"] as const;
export const photoStatusEnum = ["approved", "rejected", "pending"] as const;
export const rejectReasonEnum = ["blur", "dark", "bright", "eyes", "no_face", "processing_error"] as const;

// ─────────────────────────────────────────
// USERS (students / athletes / staff)
// ─────────────────────────────────────────
export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  studentId: text("student_id").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name"),
  role: text("role", { enum: roleEnum }).notNull().default("student"),
  faceEnrolled: boolean("face_enrolled").default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  lastLogin: timestamp("last_login", { withTimezone: true }),
});

// ─────────────────────────────────────────
// USER FACE EMBEDDINGS (enrolled at registration)
// ArcFace 512-dim — upgraded from 128-dim face-api.js
// ─────────────────────────────────────────
export const userFaceEmbeddings = pgTable("user_face_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  embedding: vector("embedding").notNull(),   // 512-dim ArcFace
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).defaultNow(),
  facesUsed: integer("faces_used").default(1),  // Number of angles captured (1-3)
  model: text("model").default("buffalo_l"),
  modelVersion: text("model_version").default("buffalo_l-v1"),
  templateType: text("template_type").default("template"),
  angle: text("angle"),
  qualityScore: doublePrecision("quality_score"),
});

// ─────────────────────────────────────────
// SEASONS
// ─────────────────────────────────────────
export const seasons = pgTable("seasons", {
  id: text("id").primaryKey(), // 'sports_2567'
  name: text("name").notNull(), // 'กีฬาสี ปีการศึกษา 2567'
  year: integer("year").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────
// EVENTS (sub-events ภายใน season)
// ─────────────────────────────────────────
export const eventTypeEnum = pgEnum("event_type", ["indoor", "outdoor"]);

export const events = pgTable("events", {
  id: text("id").primaryKey(), // 'day1_indoor', 'main_outdoor'
  seasonId: text("season_id").notNull().references(() => seasons.id),
  name: text("name").notNull(), // 'วันที่ 1 - พิธีเปิด'
  type: eventTypeEnum("type").notNull(),
  date: date("date"),
  sortOrder: integer("sort_order").default(0), // ลำดับแสดงใน UI
  description: text("description"),
  coverUrl: text("cover_url"),
  isActive: boolean("is_active").default(true),
  photoCount: integer("photo_count").default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),

  // Google Drive integration columns
  driveFolderId: text("drive_folder_id"),
  driveFolderUrl: text("drive_folder_url"),
  uploadUrl: text("upload_url"),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  syncStatus: text("sync_status").default("idle"),
  uploadOpen: boolean("upload_open").default(true),
}, (table) => ({
  eventsIsActiveIdx: index("events_is_active_idx").on(table.isActive),
}));

// ─────────────────────────────────────────
// PHOTOS
// ─────────────────────────────────────────
export const photos = pgTable("photos", {
  id: uuid("id").primaryKey().defaultRandom(),
  eventId: text("event_id").notNull().references(() => events.id),
  seasonId: text("season_id").references(() => seasons.id),
  timeslot: text("timeslot"), // 'morning' | 'afternoon' | null
  photographerId: uuid("photographer_id").references(() => users.id),
  
  // Google Drive info
  driveFileId: text("drive_file_id").notNull().unique(),
  driveUrl: text("drive_url").notNull(),
  downloadUrl: text("download_url"),
  
  // Cloudflare R2 URLs
  thumbnailUrl: text("thumbnail_url"), // 800px
  thumbnailSm: text("thumbnail_sm"),   // 400px

  // File info
  filename: text("filename").notNull(),
  fileSize: integer("file_size"),
  sourceModifiedAt: timestamp("source_modified_at", { withTimezone: true }),
  sourceChecksum: text("source_checksum"),
  sourceSyncStatus: text("source_sync_status").default("active"),
  width: integer("width"),
  height: integer("height"),

  // Quality scores (0.0–1.0 or laplacian var)
  blurScore: doublePrecision("blur_score"),
  brightness: doublePrecision("brightness"),
  faceCount: integer("face_count").default(0),
  eyesOpen: boolean("eyes_open"),

  // Processing status
  status: text("status", { enum: photoStatusEnum }).default("pending"),
  processingState: text("processing_state").default("queued"),
  processingVersion: text("processing_version"),
  rejectReason: text("reject_reason", { enum: rejectReasonEnum }),
  manuallyApproved: boolean("manually_approved").default(false),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
}, (table) => ({
  photosStatusIdx: index("photos_status_idx").on(table.status),
  photosEventIdIdx: index("photos_event_id_idx").on(table.eventId),
  photosSeasonIdIdx: index("photos_season_id_idx").on(table.seasonId),
  photosProcessingStateIdx: index("photos_processing_state_idx").on(table.processingState),
  photosEventStatusCreatedIdx: index("photos_event_status_created_idx").on(table.eventId, table.status, table.createdAt),
}));

// ─────────────────────────────────────────
// PHOTO FACE EMBEDDINGS (faces found in photos)
// ArcFace 512-dim — upgraded from 128-dim face-api.js
// ─────────────────────────────────────────
export const photoFaceEmbeddings = pgTable("photo_face_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  photoId: uuid("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  embedding: vector("embedding").notNull(),   // 512-dim ArcFace
  faceIndex: integer("face_index").default(0),
  bboxX: doublePrecision("bbox_x"),
  bboxY: doublePrecision("bbox_y"),
  bboxW: doublePrecision("bbox_w"),
  bboxH: doublePrecision("bbox_h"),
  confidence: doublePrecision("confidence"),
  qualityScore: doublePrecision("quality_score"),
  model: text("model").default("buffalo_l"),
  modelVersion: text("model_version").default("buffalo_l-v1"),
}, (table) => ({
  photoFaceHnswIdx: index("photo_face_hnsw_idx")
    .on(table.embedding)
    .using(sql`hnsw (${table.embedding} vector_cosine_ops) WITH (m = 16, ef_construction = 64)`),
}));

// ─────────────────────────────────────────
// FILTER THRESHOLDS (global)
// ─────────────────────────────────────────
export const filterConfig = pgTable("filter_config", {
  id: integer("id").primaryKey().default(1),
  blurMin: doublePrecision("blur_min").default(35.0),
  brightnessMin: doublePrecision("brightness_min").default(0.05),
  brightnessMax: doublePrecision("brightness_max").default(0.96),
  eyeAspectRatioMin: doublePrecision("eye_aspect_ratio_min").default(0.17),
  minFaceConfidence: doublePrecision("min_face_confidence").default(0.65),
  faceSimilarityDist: doublePrecision("face_similarity_dist").default(0.60),
  efSearch: integer("ef_search").default(64),
  maxResults: integer("max_results").default(50),
  pipelineBatchSize: integer("pipeline_batch_size").default(5),
  thumbnailSizeLg: integer("thumbnail_size_lg").default(800),
  thumbnailSizeSm: integer("thumbnail_size_sm").default(400),
  watermarkEnabled: boolean("watermark_enabled").default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
  updatedBy: uuid("updated_by").references(() => users.id),
});

// ─────────────────────────────────────────
// PROCESSING JOBS (background queue)
// ─────────────────────────────────────────
export const processingJobs = pgTable("processing_jobs", {
  id: text("id").primaryKey(),
  eventId: text("event_id").notNull(),
  status: text("status").default("queued"), // queued | running | done | error
  processed: integer("processed").default(0),
  total: integer("total").default(0),
  errorMsg: text("error_msg"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  doneAt: timestamp("done_at", { withTimezone: true }),
});

export const photoProcessingTasks = pgTable("photo_processing_tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  photoId: uuid("photo_id").notNull().unique().references(() => photos.id, { onDelete: "cascade" }),
  eventId: text("event_id").notNull().references(() => events.id, { onDelete: "cascade" }),
  state: text("state").notNull().default("queued"),
  stage: text("stage").notNull().default("queued"),
  priority: integer("priority").notNull().default(100),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  leaseOwner: text("lease_owner"),
  leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
  nextRetryAt: timestamp("next_retry_at", { withTimezone: true }).defaultNow(),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  modelVersion: text("model_version").notNull().default("buffalo_l-v1"),
  stageStartedAt: timestamp("stage_started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow(),
}, (table) => ({
  taskClaimIdx: index("photo_processing_tasks_claim_idx").on(table.state, table.nextRetryAt, table.priority),
  taskEventStateIdx: index("photo_processing_tasks_event_state_idx").on(table.eventId, table.state),
}));

export const workerHeartbeats = pgTable("worker_heartbeats", {
  workerId: text("worker_id").primaryKey(),
  status: text("status").notNull().default("online"),
  hostname: text("hostname"),
  version: text("version"),
  modelVersion: text("model_version"),
  device: text("device"),
  gpuName: text("gpu_name"),
  gpuMemoryMb: integer("gpu_memory_mb"),
  batchSize: integer("batch_size"),
  currentTaskId: uuid("current_task_id"),
  processedTotal: integer("processed_total").notNull().default(0),
  failedTotal: integer("failed_total").notNull().default(0),
  lastError: text("last_error"),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }).defaultNow(),
});

// ─────────────────────────────────────────
// RELATIONS DEFINITION
// ─────────────────────────────────────────
export const usersRelations = relations(users, ({ many }) => ({
  faceEmbeddings: many(userFaceEmbeddings),
  photos: many(photos),
}));

export const userFaceEmbeddingsRelations = relations(userFaceEmbeddings, ({ one }) => ({
  user: one(users, {
    fields: [userFaceEmbeddings.userId],
    references: [users.id],
  }),
}));

export const seasonsRelations = relations(seasons, ({ many }) => ({
  events: many(events),
  photos: many(photos),
}));

export const eventsRelations = relations(events, ({ one, many }) => ({
  season: one(seasons, {
    fields: [events.seasonId],
    references: [seasons.id],
  }),
  photos: many(photos),
}));

export const photosRelations = relations(photos, ({ one, many }) => ({
  event: one(events, {
    fields: [photos.eventId],
    references: [events.id],
  }),
  season: one(seasons, {
    fields: [photos.seasonId],
    references: [seasons.id],
  }),
  photographer: one(users, {
    fields: [photos.photographerId],
    references: [users.id],
  }),
  faceEmbeddings: many(photoFaceEmbeddings),
}));

export const photoFaceEmbeddingsRelations = relations(photoFaceEmbeddings, ({ one }) => ({
  photo: one(photos, {
    fields: [photoFaceEmbeddings.photoId],
    references: [photos.id],
  }),
}));
