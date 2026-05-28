import { pgEnum, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { toursTable } from "./tours";

export const reportDeliveryChannelEnum = pgEnum("report_delivery_channel", [
  "email",
  "sms",
]);

export const reportDeliveryStatusEnum = pgEnum("report_delivery_status", [
  "pending",
  "sent",
  "failed",
]);

export const tourReportDeliveriesTable = pgTable("tour_report_deliveries", {
  id: varchar("id", { length: 36 }).primaryKey(),
  tourId: varchar("tour_id", { length: 36 }).notNull().references(() => toursTable.id, { onDelete: "cascade" }),
  channel: reportDeliveryChannelEnum("channel").notNull(),
  recipient: varchar("recipient", { length: 255 }).notNull(),
  status: reportDeliveryStatusEnum("status").notNull().default("pending"),
  provider: varchar("provider", { length: 100 }),
  errorMessage: text("error_message"),
  publicTokenJti: varchar("public_token_jti", { length: 64 }),
  sentAt: timestamp("sent_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertTourReportDeliverySchema = createInsertSchema(tourReportDeliveriesTable).omit({ createdAt: true });
export type InsertTourReportDelivery = z.infer<typeof insertTourReportDeliverySchema>;
export type TourReportDelivery = typeof tourReportDeliveriesTable.$inferSelect;
