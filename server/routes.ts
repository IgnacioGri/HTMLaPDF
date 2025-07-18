import type { Express } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
import path from "path";
import fs from "fs";
import { storage } from "./storage";
import { insertConversionJobSchema, pdfConfigSchema } from "@shared/schema";
import { analyzeHtml } from "./services/html-parser";
import { generatePdf } from "./services/pdf-generator";
import { generateExcelFromHtml } from "./services/excel-generator";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit for large reports
    fieldSize: 50 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    console.log('File filter check:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      fieldname: file.fieldname
    });
    
    // Accept various HTML file types and mime types
    const isHtmlFile = file.originalname.toLowerCase().endsWith('.html') || 
                      file.originalname.toLowerCase().endsWith('.htm');
    
    const isHtmlMime = file.mimetype === 'text/html' || 
                      file.mimetype === 'application/octet-stream' || 
                      file.mimetype === 'text/plain' ||
                      !file.mimetype; // Sometimes browsers don't set mime type correctly
    
    if (isHtmlFile || isHtmlMime) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Expected HTML file but got: ${file.mimetype}`));
    }
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Analyze HTML file
  app.post("/api/analyze", upload.single('htmlFile'), async (req, res) => {
    try {
      console.log("Analysis request received:");
      console.log("- File present:", !!req.file);
      console.log("- Body keys:", Object.keys(req.body));
      console.log("- Files:", req.files);
      
      if (!req.file) {
        console.log("No file found in request");
        return res.status(400).json({ message: "No HTML file provided" });
      }

      console.log("File details:", {
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
      });

      const htmlContent = req.file.buffer.toString('utf-8');
      console.log("HTML content length:", htmlContent.length);
      
      const analysis = analyzeHtml(htmlContent);
      console.log("Analysis result:", analysis);
      
      res.json(analysis);
    } catch (error) {
      console.error("Analysis error:", error);
      res.status(500).json({ message: "Failed to analyze HTML file", error: error instanceof Error ? error.message : String(error) });
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

  // Export to Excel
  app.post("/api/export-excel", upload.single('htmlFile'), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No HTML file provided" });
      }

      const htmlContent = req.file.buffer.toString('utf-8');
      const originalFilename = req.file.originalname;

      console.log(`Starting Excel export for file: ${originalFilename}`);
      
      const excelResult = await generateExcelFromHtml(htmlContent, originalFilename);
      
      console.log(`Excel export completed: ${excelResult.sheetsCreated} sheets created`);

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${excelResult.filename}"`);
      res.setHeader('Content-Length', excelResult.buffer.length.toString());
      
      res.send(excelResult.buffer);
    } catch (error) {
      console.error("Excel export error:", error);
      res.status(500).json({ message: `Failed to export to Excel: ${error.message}` });
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
