import { integer, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tourStopsTable } from "./tourStops";

export const transcriptionStatusEnum = pgEnum("transcription_status", [
  "pending",
  "in_progress",
  "completed",
  "failed",
]);

export const voiceNotesTable = pgTable("voice_notes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  tourStopId: varchar("tour_stop_id", { length: 36 }).notNull().references(() => tourStopsTable.id, { onDelete: "cascade" }),
  fileUrl: text("file_url").notNull(),
  durationSeconds: integer("duration_seconds"),
  transcriptionStatus: transcriptionStatusEnum("transcription_status").notNull().default("pending"),
  typedNote: text("typed_note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertVoiceNoteSchema = createInsertSchema(voiceNotesTable).omit({ createdAt: true, updatedAt: true });
export type InsertVoiceNote = z.infer<typeof insertVoiceNoteSchema>;
export type VoiceNote = typeof voiceNotesTable.$inferSelect;
