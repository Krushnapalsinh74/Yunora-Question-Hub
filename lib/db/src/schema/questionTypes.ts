import { pgTable, serial, varchar, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const questionTypesTable = pgTable("question_types", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).notNull().unique(),
  description: text("description"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertQuestionTypeSchema = createInsertSchema(questionTypesTable).omit({ id: true, createdAt: true });
export type InsertQuestionType = z.infer<typeof insertQuestionTypeSchema>;
export type QuestionType = typeof questionTypesTable.$inferSelect;
