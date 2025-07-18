// Job timeout manager to prevent hanging jobs
import { storage } from '../storage.js';

const ACTIVE_JOBS = new Map<number, NodeJS.Timeout>();
const MAX_JOB_DURATION = 120000; // 2 minutes maximum

export function startJobTimeout(jobId: number): void {
  // Clear any existing timeout for this job
  clearJobTimeout(jobId);
  
  console.log(`Starting timeout for job ${jobId} (${MAX_JOB_DURATION}ms)`);
  
  const timeout = setTimeout(async () => {
    console.log(`Job ${jobId} timed out after ${MAX_JOB_DURATION}ms`);
    
    try {
      await storage.updateConversionJobStatus(
        jobId, 
        "failed", 
        "Job timed out - processing took too long. Please try with a smaller file or contact support."
      );
      
      // Clean up any resources associated with this job
      await cleanupJobResources(jobId);
      
    } catch (error) {
      console.error(`Error handling timeout for job ${jobId}:`, error);
    } finally {
      ACTIVE_JOBS.delete(jobId);
    }
  }, MAX_JOB_DURATION);
  
  ACTIVE_JOBS.set(jobId, timeout);
}

export function clearJobTimeout(jobId: number): void {
  const timeout = ACTIVE_JOBS.get(jobId);
  if (timeout) {
    clearTimeout(timeout);
    ACTIVE_JOBS.delete(jobId);
    console.log(`Cleared timeout for job ${jobId}`);
  }
}

export function completeJob(jobId: number): void {
  clearJobTimeout(jobId);
  console.log(`Job ${jobId} completed successfully`);
}

async function cleanupJobResources(jobId: number): Promise<void> {
  try {
    // Clean up any temporary files that might be associated with this job
    const fs = await import('fs/promises');
    const path = await import('path');
    
    const tempPattern = `temp-job-${jobId}`;
    const tempDir = './generated-pdfs';
    
    try {
      const files = await fs.readdir(tempDir);
      const tempFiles = files.filter(file => file.includes(tempPattern));
      
      for (const file of tempFiles) {
        const filePath = path.join(tempDir, file);
        await fs.unlink(filePath);
        console.log(`Cleaned up temp file: ${filePath}`);
      }
    } catch (error) {
      console.log('No temp files to clean up for job', jobId);
    }
    
  } catch (error) {
    console.error(`Error cleaning up resources for job ${jobId}:`, error);
  }
}

// Cleanup all hanging jobs on startup
export async function cleanupHangingJobs(): Promise<void> {
  try {
    console.log('Checking for hanging jobs...');
    
    const recentJobs = await storage.getRecentJobs(10);
    const processingJobs = recentJobs.filter(job => job.status === 'processing');
    
    if (processingJobs.length > 0) {
      console.log(`Found ${processingJobs.length} hanging jobs, marking as failed...`);
      
      for (const job of processingJobs) {
        await storage.updateConversionJobStatus(
          job.id,
          "failed",
          "Job was interrupted - please try again"
        );
        await cleanupJobResources(job.id);
      }
    }
    
  } catch (error) {
    console.error('Error cleaning up hanging jobs:', error);
  }
}