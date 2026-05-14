import { pgTable, serial, text, integer, real, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  fps: integer("fps").notNull().default(12),
  canvasWidth: integer("canvas_width").notNull().default(1920),
  canvasHeight: integer("canvas_height").notNull().default(1080),
  frameCount: integer("frame_count").notNull().default(0),
  thumbnailData: text("thumbnail_data"),
  backgroundColor: text("background_color").notNull().default("#ffffff"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const framesTable = pgTable("frames", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  frameIndex: integer("frame_index").notNull().default(0),
  duration: integer("duration").notNull().default(1),
  isHold: boolean("is_hold").notNull().default(false),
  canvasData: text("canvas_data"),
  thumbnailData: text("thumbnail_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const layersTable = pgTable("layers", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  frameId: integer("frame_id"),
  name: text("name").notNull().default("Layer 1"),
  layerIndex: integer("layer_index").notNull().default(0),
  isVisible: boolean("is_visible").notNull().default(true),
  isLocked: boolean("is_locked").notNull().default(false),
  opacity: real("opacity").notNull().default(1.0),
  blendMode: text("blend_mode").notNull().default("normal"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const exportsTable = pgTable("exports", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  format: text("format").notNull(),
  status: text("status").notNull().default("pending"),
  quality: text("quality").notNull().default("high"),
  fps: integer("fps"),
  width: integer("width"),
  height: integer("height"),
  transparentBackground: boolean("transparent_background").notNull().default(false),
  progress: real("progress"),
  fileUrl: text("file_url"),
  fileSize: integer("file_size"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const audioTracksTable = pgTable("audio_tracks", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  audioData: text("audio_data"),
  startFrame: integer("start_frame").notNull().default(0),
  volume: real("volume").notNull().default(1.0),
  isMuted: boolean("is_muted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true, frameCount: true });
export const insertFrameSchema = createInsertSchema(framesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLayerSchema = createInsertSchema(layersTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertExportSchema = createInsertSchema(exportsTable).omit({ id: true, createdAt: true, updatedAt: true, status: true, progress: true, fileUrl: true, fileSize: true, errorMessage: true });
export const insertAudioTrackSchema = createInsertSchema(audioTracksTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Project = typeof projectsTable.$inferSelect;
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Frame = typeof framesTable.$inferSelect;
export type InsertFrame = z.infer<typeof insertFrameSchema>;
export type Layer = typeof layersTable.$inferSelect;
export type InsertLayer = z.infer<typeof insertLayerSchema>;
export type Export = typeof exportsTable.$inferSelect;
export type InsertExport = z.infer<typeof insertExportSchema>;
export type AudioTrack = typeof audioTracksTable.$inferSelect;
export type InsertAudioTrack = z.infer<typeof insertAudioTrackSchema>;
