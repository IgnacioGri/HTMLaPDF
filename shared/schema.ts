import { pgTable, text, serial, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const conversionJobs = pgTable("conversion_jobs", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  originalHtml: text("original_html").notNull(),
  status: text("status").notNull().default("pending"), // pending, processing, completed, failed
  pdfPath: text("pdf_path"),
  config: text("config").notNull(), // JSON string of configuration
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
  error: text("error"),
});

export const insertConversionJobSchema = createInsertSchema(conversionJobs).pick({
  filename: true,
  originalHtml: true,
  config: true,
});

export type InsertConversionJob = z.infer<typeof insertConversionJobSchema>;
export type ConversionJob = typeof conversionJobs.$inferSelect;

// PDF Configuration Schema
export const pdfConfigSchema = z.object({
  pageSize: z.enum(["A4", "Letter", "Legal"]).default("A4"),
  orientation: z.enum(["portrait", "landscape"]).default("portrait"),
  marginTop: z.number().min(2).max(25).default(5),
  marginSide: z.number().min(2).max(25).default(5),
  repeatHeaders: z.boolean().default(true),
  keepGroupsTogether: z.boolean().default(true),
  alternateRowColors: z.boolean().default(true),
  autoFitText: z.boolean().default(false),
  contentScale: z.number().min(70).max(100).default(85),
});

export type PdfConfig = z.infer<typeof pdfConfigSchema>;

// Analysis Result Schema
export const analysisResultSchema = z.object({
  tableCount: z.number(),
  assetCount: z.number(),
  estimatedPages: z.string(),
  isValidCohenFormat: z.boolean(),
  fileSize: z.string(),
});

export type AnalysisResult = z.infer<typeof analysisResultSchema>;
