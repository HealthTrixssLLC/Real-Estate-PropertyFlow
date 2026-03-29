import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tourStopsTable } from "./tourStops";

export const propertySummariesTable = pgTable("property_summaries", {
  id: varchar("id", { length: 36 }).primaryKey(),
  tourStopId: varchar("tour_stop_id", { length: 36 }).notNull().references(() => tourStopsTable.id, { onDelete: "cascade" }),
  summaryText: text("summary_text").notNull(),
  positives: text("positives").array(),
  negatives: text("negatives").array(),
  questions: text("questions").array(),
  provider: varchar("provider", { length: 100 }),
  generatedAt: timestamp("generated_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertPropertySummarySchema = createInsertSchema(propertySummariesTable).omit({ createdAt: true, generatedAt: true });
export type InsertPropertySummary = z.infer<typeof insertPropertySummarySchema>;
export type PropertySummary = typeof propertySummariesTable.$inferSelect;
