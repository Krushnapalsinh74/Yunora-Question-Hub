import { pgTable, serial, varchar, text, boolean, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const aiProvidersTable = pgTable("ai_providers", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  providerType: varchar("provider_type", { length: 100 }).notNull(),
  encryptedToken: text("encrypted_token").notNull(),
  defaultModel: varchar("default_model", { length: 255 }).notNull(),
  availableModels: jsonb("available_models").$type<string[]>().notNull().default([]),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAiProviderSchema = createInsertSchema(aiProvidersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertAiProvider = z.infer<typeof insertAiProviderSchema>;
export type AiProvider = typeof aiProvidersTable.$inferSelect;
