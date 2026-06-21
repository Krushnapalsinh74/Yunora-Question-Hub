import { pgTable, serial, varchar, integer, text, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { aiProvidersTable } from "./aiProviders";

export const generationJobsTable = pgTable("generation_jobs", {
  id: serial("id").primaryKey(),
  jobId: varchar("job_id", { length: 255 }).notNull().unique(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  totalRequested: integer("total_requested").notNull(),
  totalGenerated: integer("total_generated"),
  boardId: integer("board_id"),
  standardId: integer("standard_id"),
  subjectId: integer("subject_id"),
  chapterId: integer("chapter_id"),
  topicId: integer("topic_id"),
  topicName: varchar("topic_name", { length: 255 }),
  subjectName: varchar("subject_name", { length: 255 }),
  chapterName: varchar("chapter_name", { length: 255 }),
  questionType: varchar("question_type", { length: 100 }).notNull(),
  difficulty: varchar("difficulty", { length: 20 }).notNull(),
  providerId: integer("provider_id").references(() => aiProvidersTable.id, { onDelete: "set null" }),
  model: varchar("model", { length: 255 }).notNull(),
  agentLogs: text("agent_logs"),
  errorMessage: text("error_message"),
  requestParams: jsonb("request_params"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertGenerationJobSchema = createInsertSchema(generationJobsTable).omit({ id: true, createdAt: true });
export type InsertGenerationJob = z.infer<typeof insertGenerationJobSchema>;
export type GenerationJob = typeof generationJobsTable.$inferSelect;
