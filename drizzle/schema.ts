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
  pgEnum
} from "drizzle-orm/pg-core";
import { sql, relations } from "drizzle-orm";

// Custom vector type for pgvector
// We use vector(128) because face-api.js generates 128-dimensional embeddings.
export const vector = customType<{ data: number[] }>({
  dataType() {
    return "vector(128)";
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
// ─────────────────────────────────────────
export const userFaceEmbeddings = pgTable("user_face_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  embedding: vector("embedding").notNull(),
  enrolledAt: timestamp("enrolled_at", { withTimezone: true }).defaultNow(),
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
});

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
  width: integer("width"),
  height: integer("height"),

  // Quality scores (0.0–1.0 or laplacian var)
  blurScore: doublePrecision("blur_score"),
  brightness: doublePrecision("brightness"),
  faceCount: integer("face_count").default(0),
  eyesOpen: boolean("eyes_open"),

  // Processing status
  status: text("status", { enum: photoStatusEnum }).default("pending"),
  rejectReason: text("reject_reason", { enum: rejectReasonEnum }),
  manuallyApproved: boolean("manually_approved").default(false),

  // Timestamps
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
  processedAt: timestamp("processed_at", { withTimezone: true }),
});

// ─────────────────────────────────────────
// PHOTO FACE EMBEDDINGS (faces found in photos)
// ─────────────────────────────────────────
export const photoFaceEmbeddings = pgTable("photo_face_embeddings", {
  id: uuid("id").primaryKey().defaultRandom(),
  photoId: uuid("photo_id").notNull().references(() => photos.id, { onDelete: "cascade" }),
  embedding: vector("embedding").notNull(),
  faceIndex: integer("face_index").default(0),
  bboxX: doublePrecision("bbox_x"),
  bboxY: doublePrecision("bbox_y"),
  bboxW: doublePrecision("bbox_w"),
  bboxH: doublePrecision("bbox_h"),
  confidence: doublePrecision("confidence"),
});

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
