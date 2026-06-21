import { pgTable, serial, integer, varchar, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const papersTable = pgTable("papers", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  institutionName: varchar("institution_name", { length: 255 }),
  totalQuestions: integer("total_questions").notNull().default(0),
  subjectName: varchar("subject_name", { length: 255 }),
  boardName: varchar("board_name", { length: 255 }),
  standardName: varchar("standard_name", { length: 255 }),
  includeAnswerKey: boolean("include_answer_key").notNull().default(true),
  includeExplanations: boolean("include_explanations").notNull().default(false),
  questionIds: text("question_ids").notNull(),
  pdfUrl: text("pdf_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertPaperSchema = createInsertSchema(papersTable).omit({ id: true, createdAt: true });
export type InsertPaper = z.infer<typeof insertPaperSchema>;
export type Paper = typeof papersTable.$inferSelect;
