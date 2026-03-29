import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tourStopsTable } from "./tourStops";

export const listingAgentContactsTable = pgTable("listing_agent_contacts", {
  id: varchar("id", { length: 36 }).primaryKey(),
  tourStopId: varchar("tour_stop_id", { length: 36 }).notNull().references(() => tourStopsTable.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  brokerageName: varchar("brokerage_name", { length: 255 }),
  preferredContactMethod: varchar("preferred_contact_method", { length: 100 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertListingAgentContactSchema = createInsertSchema(listingAgentContactsTable).omit({ createdAt: true, updatedAt: true });
export type InsertListingAgentContact = z.infer<typeof insertListingAgentContactSchema>;
export type ListingAgentContact = typeof listingAgentContactsTable.$inferSelect;
