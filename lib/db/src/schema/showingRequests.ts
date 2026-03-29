import { pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tourStopsTable } from "./tourStops";

export const showingStatusEnum = pgEnum("showing_status", [
  "not_requested",
  "requested",
  "pending",
  "approved",
  "declined",
  "needs_follow_up",
  "restricted",
  "cancelled",
]);

export const showingRequestsTable = pgTable("showing_requests", {
  id: varchar("id", { length: 36 }).primaryKey(),
  tourStopId: varchar("tour_stop_id", { length: 36 }).notNull().references(() => tourStopsTable.id, { onDelete: "cascade" }),
  listingAgentName: varchar("listing_agent_name", { length: 255 }),
  brokerageName: varchar("brokerage_name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  requestMethod: varchar("request_method", { length: 100 }),
  requestedAt: timestamp("requested_at", { withTimezone: true }),
  requestedWindowStart: varchar("requested_window_start", { length: 20 }),
  requestedWindowEnd: varchar("requested_window_end", { length: 20 }),
  status: showingStatusEnum("status").notNull().default("not_requested"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertShowingRequestSchema = createInsertSchema(showingRequestsTable).omit({ createdAt: true, updatedAt: true });
export type InsertShowingRequest = z.infer<typeof insertShowingRequestSchema>;
export type ShowingRequest = typeof showingRequestsTable.$inferSelect;
