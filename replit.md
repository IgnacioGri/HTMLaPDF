# Cohen PDF Generator

## Overview
This is a full-stack web application designed to convert Cohen financial reports from HTML format to professionally formatted PDFs. The application provides an intuitive interface for uploading HTML files, configuring PDF output settings, and monitoring conversion progress.

## Current Status (January 18, 2025)
✅ **File Analysis Working**: HTML upload and analysis fully functional - detects 20 tables, 68 assets, Cohen format validation
✅ **Frontend Simplified**: Removed complex configuration panel, now uses optimized settings for Cohen reports  
✅ **Chrome Installed**: Puppeteer Chrome browser downloaded and configured with all system dependencies
✅ **PDF Generation Working**: Full PDF generation pipeline functional - Puppeteer generates PDFs successfully
✅ **Runtime Error Fixed**: Resolved "Cannot access uninitialized variable" error caused by circular dependency in useQuery
✅ **PDF Formatting Complete**: Enhanced CSS for proper column display, margin optimization, and professional pagination
✅ **Blank Pages COMPLETELY ELIMINATED**: Successfully eliminated ALL blank pages using nuclear CSS approach and strategic pagination control
✅ **Table Headers Fixed**: All table headers now repeat correctly when tables span multiple pages across entire document
✅ **Deployment Ready**: Chrome/Chromium installed at system level with multiple executable paths for maximum compatibility

## Recent Changes (January 18, 2025)
- **CRITICAL FIX: PDF Corruption Resolved**: Fixed fallback system generating HTML files instead of valid PDFs when Puppeteer fails
- **Enhanced Chrome Detection**: Comprehensive Chrome executable path detection across system locations and Nix store
- **Robust PDF Validation**: Added PDF signature validation and buffer checks to ensure valid PDF generation
- **4-Level Fallback System**: Puppeteer → html-pdf-node → System Tools → Text Report with comprehensive error recovery
- **Production Deployment Ready**: Enhanced Chrome detection for multiple deployment environments
- **Dynamic Resource Management**: Intelligent timeout scaling and HTML optimization for large files
- **System Tool Integration**: Added wkhtmltopdf and Chrome CLI fallback options for maximum compatibility
- **Error Logging Enhanced**: Comprehensive logging with emojis and detailed error tracking
- **PDF Buffer Validation**: Checks for PDF signature (%PDF) and file size validation
- **Memory Optimization**: Large file processing with automatic content optimization and cleanup

## User Preferences
Preferred communication style: Simple, everyday language.
PDF styling preference: Maintain exact visual appearance of original HTML with improved pagination and column visibility.
UI Design preference: Replicate Cohen's real app design - clean white cards on light gray background, burgundy accents, professional typography, minimal shadows.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite for fast development and optimized builds
- **Styling**: Tailwind CSS with shadcn/ui component library
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack React Query for server state management
- **UI Components**: Radix UI primitives with custom Cohen-branded styling

### Backend Architecture
- **Runtime**: Node.js with Express.js framework
- **Language**: TypeScript with ES modules
- **File Processing**: Multer for multipart file uploads
- **HTML Parsing**: Cheerio for server-side HTML analysis
- **PDF Generation**: Puppeteer for headless browser-based PDF rendering

### Data Storage Solutions
- **Database**: PostgreSQL with Drizzle ORM
- **Connection**: Neon Database serverless PostgreSQL
- **In-Memory Storage**: Fallback memory storage for development
- **File Storage**: Local filesystem for generated PDFs

## Key Components

### File Upload System
- Drag-and-drop interface using react-dropzone
- HTML file validation and size limits (10MB)
- Real-time file analysis with progress feedback
- Cohen format detection and validation warnings

### PDF Configuration
- Page size options (A4, Letter, Legal)
- Orientation settings (portrait/landscape)
- Margin controls with visual feedback
- Table formatting options (headers, grouping, colors)
- Content scaling and auto-fit text options

### Conversion Pipeline
- Asynchronous job processing with status tracking
- HTML style injection for Cohen branding
- Puppeteer-based PDF generation with custom styling
- Progress monitoring with estimated completion times

### Database Schema
- `conversion_jobs` table with job tracking
- Status management (pending, processing, completed, failed)
- Configuration storage as JSON
- Audit trail with timestamps

## Data Flow

1. **File Upload**: User uploads HTML file via drag-and-drop interface
2. **Analysis**: Server analyzes HTML structure, counts tables/assets, estimates pages
3. **Configuration**: User adjusts PDF settings through interactive controls
4. **Job Creation**: System creates conversion job record in database
5. **Processing**: Background service processes HTML with Puppeteer
6. **Style Injection**: Cohen-specific styles applied for professional formatting
7. **PDF Generation**: Puppeteer renders styled HTML to PDF with specified settings
8. **Completion**: Generated PDF stored and job status updated
9. **Download**: User can download completed PDF or view recent jobs

## External Dependencies

### Core Libraries
- **@neondatabase/serverless**: PostgreSQL database connectivity
- **drizzle-orm**: Type-safe database queries and migrations
- **puppeteer**: Headless Chrome for PDF generation
- **cheerio**: Server-side HTML parsing and manipulation
- **multer**: File upload handling

### UI Framework
- **@radix-ui/***: Accessible component primitives
- **@tanstack/react-query**: Server state management
- **react-dropzone**: File upload interface
- **tailwindcss**: Utility-first CSS framework

### Development Tools
- **vite**: Frontend build tool and dev server
- **tsx**: TypeScript execution for development
- **esbuild**: Production bundling for server code

## Deployment Strategy

### Development Environment
- Vite dev server with HMR for frontend
- tsx for TypeScript execution during development
- Environment variable configuration for database
- Replit-specific optimizations and error handling

### Production Build
- Frontend: Vite builds optimized static assets
- Backend: esbuild bundles server code with external dependencies
- Database: Drizzle migrations for schema management
- File Storage: Local filesystem with configurable output directory

### Environment Configuration
- `DATABASE_URL` for PostgreSQL connection
- `NODE_ENV` for environment-specific behavior
- File upload limits and storage paths configurable
- PDF generation timeout and quality settings

The application is designed for the Replit environment with specific plugins for development experience, but can be deployed to any Node.js hosting platform with PostgreSQL support.