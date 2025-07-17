import { apiRequest } from "./queryClient";
import type { AnalysisResult, PdfConfig } from "@shared/schema";

export async function analyzeFile(file: File): Promise<AnalysisResult> {
  const formData = new FormData();
  formData.append('htmlFile', file);
  
  const response = await apiRequest('POST', '/api/analyze', formData);
  return response.json();
}

export async function convertToPdf(file: File, config: PdfConfig): Promise<{ jobId: number; status: string }> {
  const formData = new FormData();
  formData.append('htmlFile', file);
  formData.append('config', JSON.stringify(config));
  
  const response = await apiRequest('POST', '/api/convert', formData);
  return response.json();
}

export async function getJobStatus(jobId: number) {
  const response = await apiRequest('GET', `/api/job/${jobId}`);
  return response.json();
}

export async function getRecentJobs() {
  const response = await apiRequest('GET', '/api/recent');
  return response.json();
}
