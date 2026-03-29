import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const appSettingsTable = pgTable("app_settings", {
  key: varchar("key", { length: 255 }).primaryKey(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AppSetting = typeof appSettingsTable.$inferSelect;
