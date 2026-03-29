import { doublePrecision, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const propertiesTable = pgTable("properties", {
  id: varchar("id", { length: 36 }).primaryKey(),
  formattedAddress: text("formatted_address").notNull(),
  placeId: varchar("place_id", { length: 512 }),
  lat: doublePrecision("lat"),
  lng: doublePrecision("lng"),
  city: varchar("city", { length: 255 }),
  state: varchar("state", { length: 100 }),
  zip: varchar("zip", { length: 20 }),
  mlsId: varchar("mls_id", { length: 100 }),
  listPrice: integer("list_price"),
  beds: integer("beds"),
  baths: doublePrecision("baths"),
  squareFeet: integer("square_feet"),
  nickname: varchar("nickname", { length: 255 }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertPropertySchema = createInsertSchema(propertiesTable).omit({ createdAt: true, updatedAt: true });
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof propertiesTable.$inferSelect;
