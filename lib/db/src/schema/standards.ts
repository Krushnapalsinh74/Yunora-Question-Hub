import { pgTable, serial, integer, varchar, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { boardsTable } from "./boards";

export const standardsTable = pgTable("standards", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  level: integer("level").notNull(),
  boardId: integer("board_id").notNull().references(() => boardsTable.id, { onDelete: "cascade" }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStandardSchema = createInsertSchema(standardsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertStandard = z.infer<typeof insertStandardSchema>;
export type Standard = typeof standardsTable.$inferSelect;
