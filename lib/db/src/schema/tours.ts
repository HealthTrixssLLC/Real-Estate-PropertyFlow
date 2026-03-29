import { doublePrecision, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { buyersTable } from "./buyers";

export const tourStatusEnum = pgEnum("tour_status", [
  "draft",
  "active",
  "published",
  "completed",
  "cancelled",
]);

export const toursTable = pgTable("tours", {
  id: varchar("id", { length: 36 }).primaryKey(),
  buyerId: varchar("buyer_id", { length: 36 }).references(() => buyersTable.id),
  agentId: varchar("agent_id", { length: 36 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  date: varchar("date", { length: 20 }).notNull(),
  startTime: varchar("start_time", { length: 10 }),
  startAddress: text("start_address"),
  startLat: doublePrecision("start_lat"),
  startLng: doublePrecision("start_lng"),
  endAddress: text("end_address"),
  endLat: doublePrecision("end_lat"),
  endLng: doublePrecision("end_lng"),
  buyerNotes: text("buyer_notes"),
  geographicArea: varchar("geographic_area", { length: 255 }),
  tags: text("tags").array(),
  status: tourStatusEnum("status").notNull().default("draft"),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTourSchema = createInsertSchema(toursTable).omit({ createdAt: true, updatedAt: true });
export type InsertTour = z.infer<typeof insertTourSchema>;
export type Tour = typeof toursTable.$inferSelect;
