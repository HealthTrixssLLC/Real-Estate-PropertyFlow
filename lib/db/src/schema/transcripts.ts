import { pgTable, real, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { voiceNotesTable } from "./voiceNotes";

export const transcriptsTable = pgTable("transcripts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  voiceNoteId: varchar("voice_note_id", { length: 36 }).notNull().references(() => voiceNotesTable.id, { onDelete: "cascade" }),
  text: text("text").notNull(),
  provider: varchar("provider", { length: 100 }),
  confidence: real("confidence"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTranscriptSchema = createInsertSchema(transcriptsTable).omit({ createdAt: true });
export type InsertTranscript = z.infer<typeof insertTranscriptSchema>;
export type Transcript = typeof transcriptsTable.$inferSelect;
