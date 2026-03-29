import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { toursTable } from "./tours";

export const tourSummariesTable = pgTable("tour_summaries", {
  id: varchar("id", { length: 36 }).primaryKey(),
  tourId: varchar("tour_id", { length: 36 }).notNull().references(() => toursTable.id, { onDelete: "cascade" }),
  summaryText: text("summary_text").notNull(),
  topHomes: text("top_homes").array(),
  homesToEliminate: text("homes_to_eliminate").array(),
  buyerPreferences: text("buyer_preferences").array(),
  nextActions: text("next_actions").array(),
  provider: varchar("provider", { length: 100 }),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTourSummarySchema = createInsertSchema(tourSummariesTable).omit({ createdAt: true, generatedAt: true });
export type InsertTourSummary = z.infer<typeof insertTourSummarySchema>;
export type TourSummary = typeof tourSummariesTable.$inferSelect;
