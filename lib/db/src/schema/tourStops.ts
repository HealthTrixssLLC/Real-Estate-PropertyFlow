import { boolean, integer, pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { toursTable } from "./tours";
import { propertiesTable } from "./properties";

export const skipReasonEnum = pgEnum("skip_reason", [
  "not_approved",
  "client_changed_mind",
  "running_late",
  "access_issue",
  "traffic",
  "duplicate_choice",
  "other",
]);

export const tourStopsTable = pgTable("tour_stops", {
  id: varchar("id", { length: 36 }).primaryKey(),
  tourId: varchar("tour_id", { length: 36 }).notNull().references(() => toursTable.id, { onDelete: "cascade" }),
  propertyId: varchar("property_id", { length: 36 }).notNull().references(() => propertiesTable.id),
  sequence: integer("sequence").notNull(),
  approvedStatus: varchar("approved_status", { length: 50 }).notNull().default("not_requested"),
  skipped: boolean("skipped").notNull().default(false),
  skipReason: skipReasonEnum("skip_reason"),
  skipNotes: text("skip_notes"),
  visited: boolean("visited").notNull().default(false),
  arrivalTime: timestamp("arrival_time", { withTimezone: true }),
  departureTime: timestamp("departure_time", { withTimezone: true }),
  buyerInterest: integer("buyer_interest"),
  kitchenRating: integer("kitchen_rating"),
  primarySuiteRating: integer("primary_suite_rating"),
  backyardRating: integer("backyard_rating"),
  roadNoiseRating: integer("road_noise_rating"),
  overallFitRating: integer("overall_fit_rating"),
  followUpFlag: boolean("follow_up_flag").notNull().default(false),
  revisitFlag: boolean("revisit_flag").notNull().default(false),
  quickTags: text("quick_tags").array(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTourStopSchema = createInsertSchema(tourStopsTable).omit({ createdAt: true, updatedAt: true });
export type InsertTourStop = z.infer<typeof insertTourStopSchema>;
export type TourStop = typeof tourStopsTable.$inferSelect;
