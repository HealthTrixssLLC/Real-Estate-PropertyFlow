import { integer, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { tourStopsTable } from "./tourStops";
import { buyersTable } from "./buyers";

export const debriefProcessingStatusEnum = pgEnum("debrief_processing_status", [
  "pending",
  "transcribing",
  "scoring",
  "completed",
  "failed",
]);

export const debriefVoiceNotesTable = pgTable("debrief_voice_notes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  tourStopId: varchar("tour_stop_id", { length: 36 }).notNull().references(() => tourStopsTable.id, { onDelete: "cascade" }),
  buyerId: varchar("buyer_id", { length: 36 }).references(() => buyersTable.id, { onDelete: "set null" }),
  fileUrl: text("file_url"),
  durationSeconds: integer("duration_seconds"),
  transcript: text("transcript"),
  aiSummary: text("ai_summary"),
  fitScore: integer("fit_score"),
  fitScorePositives: text("fit_score_positives").array(),
  fitScoreNegatives: text("fit_score_negatives").array(),
  fitScoreVerdict: text("fit_score_verdict"),
  processingStatus: debriefProcessingStatusEnum("processing_status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type DebriefVoiceNote = typeof debriefVoiceNotesTable.$inferSelect;
