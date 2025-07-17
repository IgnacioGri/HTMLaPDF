import { conversionJobs, type ConversionJob, type InsertConversionJob } from "@shared/schema";

export interface IStorage {
  createConversionJob(job: InsertConversionJob): Promise<ConversionJob>;
  getConversionJob(id: number): Promise<ConversionJob | undefined>;
  updateConversionJobStatus(id: number, status: string, pdfPath?: string, error?: string): Promise<ConversionJob | undefined>;
  getRecentJobs(limit?: number): Promise<ConversionJob[]>;
}

export class MemStorage implements IStorage {
  private jobs: Map<number, ConversionJob>;
  private currentId: number;

  constructor() {
    this.jobs = new Map();
    this.currentId = 1;
  }

  async createConversionJob(insertJob: InsertConversionJob): Promise<ConversionJob> {
    const id = this.currentId++;
    const job: ConversionJob = {
      ...insertJob,
      id,
      status: "pending",
      pdfPath: null,
      createdAt: new Date(),
      completedAt: null,
      error: null,
    };
    this.jobs.set(id, job);
    return job;
  }

  async getConversionJob(id: number): Promise<ConversionJob | undefined> {
    return this.jobs.get(id);
  }

  async updateConversionJobStatus(
    id: number, 
    status: string, 
    pdfPath?: string, 
    error?: string
  ): Promise<ConversionJob | undefined> {
    const job = this.jobs.get(id);
    if (!job) return undefined;

    const updatedJob = {
      ...job,
      status,
      pdfPath: pdfPath || job.pdfPath,
      error: error || job.error,
      completedAt: status === "completed" || status === "failed" ? new Date() : job.completedAt,
    };

    this.jobs.set(id, updatedJob);
    return updatedJob;
  }

  async getRecentJobs(limit: number = 10): Promise<ConversionJob[]> {
    return Array.from(this.jobs.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}

export const storage = new MemStorage();
