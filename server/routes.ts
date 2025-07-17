import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { insertConversionJobSchema, pdfConfigSchema } from "@shared/schema";
import { analyzeHtml } from "./services/html-parser";
import { generatePdf } from "./services/pdf-generator";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/html' || file.originalname.endsWith('.html') || file.originalname.endsWith('.htm')) {
      cb(null, true);
    } else {
      cb(new Error('Only HTML files are allowed'));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Analyze HTML file
  app.post("/api/analyze", upload.single('htmlFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No HTML file provided" });
      }

      const htmlContent = req.file.buffer.toString('utf-8');
      const analysis = analyzeHtml(htmlContent);
      
      res.json(analysis);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ message: "Failed to analyze HTML file" });
    }
  });

  // Create conversion job
  app.post("/api/convert", upload.single('htmlFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No HTML file provided" });
      }

      const configData = req.body.config ? JSON.parse(req.body.config) : {};
      const config = pdfConfigSchema.parse(configData);

      const htmlContent = req.file.buffer.toString('utf-8');
      
      const jobData = insertConversionJobSchema.parse({
        filename: req.file.originalname,
        originalHtml: htmlContent,
        config: JSON.stringify(config),
      });

      const job = await storage.createConversionJob(jobData);
      
      // Start PDF generation in background
      generatePdf(job.id, htmlContent, config)
        .then(async (pdfPath) => {
          await storage.updateConversionJobStatus(job.id, "completed", pdfPath);
        })
        .catch(async (error) => {
          console.error("PDF generation error:", error);
          await storage.updateConversionJobStatus(job.id, "failed", undefined, error.message);
        });

      res.json({ jobId: job.id, status: job.status });
    } catch (error) {
      console.error("Conversion error:", error);
      res.status(500).json({ message: "Failed to start conversion" });
    }
  });

  // Get job status
  app.get("/api/job/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getConversionJob(id);
      
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      res.json(job);
    } catch (error) {
      console.error("Job status error:", error);
      res.status(500).json({ message: "Failed to get job status" });
    }
  });

  // Download PDF
  app.get("/api/download/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const job = await storage.getConversionJob(id);
      
      if (!job || !job.pdfPath) {
        return res.status(404).json({ message: "PDF not found" });
      }

      const pdfPath = path.resolve(job.pdfPath);
      
      if (!fs.existsSync(pdfPath)) {
        return res.status(404).json({ message: "PDF file not found" });
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${job.filename.replace('.html', '.pdf')}"`);
      
      const fileStream = fs.createReadStream(pdfPath);
      fileStream.pipe(res);
    } catch (error) {
      console.error("Download error:", error);
      res.status(500).json({ message: "Failed to download PDF" });
    }
  });

  // Get recent jobs
  app.get("/api/recent", async (req, res) => {
    try {
      const jobs = await storage.getRecentJobs(5);
      res.json(jobs);
    } catch (error) {
      console.error("Recent jobs error:", error);
      res.status(500).json({ message: "Failed to get recent jobs" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
