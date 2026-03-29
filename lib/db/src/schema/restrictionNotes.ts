import { boolean, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tourStopsTable } from "./tourStops";

export const restrictionNotesTable = pgTable("restriction_notes", {
  id: varchar("id", { length: 36 }).primaryKey(),
  tourStopId: varchar("tour_stop_id", { length: 36 }).notNull().references(() => tourStopsTable.id, { onDelete: "cascade" }),
  occupied: boolean("occupied").notNull().default(false),
  tenantNoticeRequired: boolean("tenant_notice_required").notNull().default(false),
  gateCode: varchar("gate_code", { length: 100 }),
  alarmInstructions: text("alarm_instructions"),
  petInstructions: text("pet_instructions"),
  doNotUseBathroom: boolean("do_not_use_bathroom").notNull().default(false),
  removeShoes: boolean("remove_shoes").notNull().default(false),
  parkingInstructions: text("parking_instructions"),
  timeRestriction: varchar("time_restriction", { length: 255 }),
  offerDeadlineNote: text("offer_deadline_note"),
  freeTextNotes: text("free_text_notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertRestrictionNoteSchema = createInsertSchema(restrictionNotesTable).omit({ createdAt: true, updatedAt: true });
export type InsertRestrictionNote = z.infer<typeof insertRestrictionNoteSchema>;
export type RestrictionNote = typeof restrictionNotesTable.$inferSelect;
