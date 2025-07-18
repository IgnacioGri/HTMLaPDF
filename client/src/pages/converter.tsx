import { useState } from "react";
import Header from "@/components/header";
import FileUpload from "@/components/file-upload";
import SimpleConfigPanel from "@/components/simple-config-panel";
import PdfPreview from "@/components/pdf-preview";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { getRecentJobs } from "@/lib/api";
import { FileText, Download, Clock } from "lucide-react";
import type { AnalysisResult } from "@shared/schema";

export default function ConverterPage() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [jobId, setJobId] = useState<number | null>(null);

  const { data: recentJobs = [] } = useQuery({
    queryKey: ["/api/recent"],
    refetchInterval: 5000,
  });

  const handleFileUploaded = (file: File, analysisResult: AnalysisResult) => {
    setUploadedFile(file);
    setAnalysis(analysisResult);
  };

  const handleConversionStarted = (newJobId: number) => {
    setJobId(newJobId);
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date();
    const then = new Date(date);
    const diffHours = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 1) return "Hace unos minutos";
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours === 1 ? '' : 's'}`;
    const diffDays = Math.floor(diffHours / 24);
    return `Hace ${diffDays} día${diffDays === 1 ? '' : 's'}`;
  };

  return (
    <div className="min-h-screen bg-cohen-gray">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Upload and Configuration Section */}
          <div className="lg:col-span-2 space-y-6">
            <FileUpload 
              onFileUploaded={handleFileUploaded}
              analysis={analysis}
            />
            
            <SimpleConfigPanel 
              disabled={!uploadedFile}
              file={uploadedFile}
              onConversionStarted={handleConversionStarted}
            />
          </div>

          {/* Preview and Actions */}
          <div className="space-y-6">
            <PdfPreview 
              jobId={jobId}
              file={uploadedFile}
              analysis={analysis}
            />

            {/* Quick Stats */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-medium text-cohen-text mb-4 flex items-center">
                  <Clock className="text-cohen-burgundy mr-2 h-4 w-4" />
                  Estadísticas
                </h3>
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Reportes procesados hoy</span>
                    <span className="font-semibold text-cohen-text">
                      {recentJobs.filter(job => {
                        const today = new Date().toDateString();
                        return new Date(job.createdAt).toDateString() === today;
                      }).length}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Tiempo promedio</span>
                    <span className="font-semibold text-cohen-text">8.3s</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Éxito de conversión</span>
                    <span className="font-semibold text-green-600">99.2%</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Recent Files */}
            <Card>
              <CardContent className="p-6">
                <h3 className="font-medium text-cohen-text mb-4 flex items-center">
                  <Clock className="text-cohen-burgundy mr-2 h-4 w-4" />
                  Archivos recientes
                </h3>
                <div className="space-y-3">
                  {recentJobs.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No hay archivos recientes
                    </p>
                  ) : (
                    recentJobs.slice(0, 3).map((job) => (
                      <div key={job.id} className="flex items-center space-x-3 p-2 hover:bg-muted rounded-lg cursor-pointer group">
                        <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                          <FileText className="text-primary h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-cohen-text truncate">
                            {job.filename.replace('.html', '.pdf')}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatTimeAgo(job.createdAt)}
                          </p>
                        </div>
                        {job.status === 'completed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => window.open(`/api/download/${job.id}`, '_blank')}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Help Section */}
        <Card className="mt-12">
          <div className="cohen-burgundy px-6 py-4">
            <h2 className="text-white text-lg font-semibold flex items-center">
              <FileText className="mr-3 h-5 w-5" />
              Guía de Uso
            </h2>
          </div>
          
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="text-primary h-6 w-6" />
                </div>
                <h3 className="font-medium text-cohen-text mb-2">1. Cargar HTML</h3>
                <p className="text-sm text-muted-foreground">
                  Arrastra tu reporte HTML generado por la plataforma Cohen
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="text-primary h-6 w-6" />
                </div>
                <h3 className="font-medium text-cohen-text mb-2">2. Configurar</h3>
                <p className="text-sm text-muted-foreground">
                  Ajusta los márgenes, orientación y opciones de tabla según tus necesidades
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Download className="text-primary h-6 w-6" />
                </div>
                <h3 className="font-medium text-cohen-text mb-2">3. Descargar PDF</h3>
                <p className="text-sm text-muted-foreground">
                  Genera y descarga tu PDF optimizado para impresión profesional
                </p>
              </div>
            </div>
            
            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <FileText className="text-blue-600 mt-0.5 h-5 w-5" />
                <div>
                  <h4 className="font-medium text-blue-800 mb-1">Optimización automática</h4>
                  <p className="text-sm text-blue-700">
                    El sistema detecta automáticamente la estructura de reportes Cohen y optimiza la paginación 
                    para mantener la integridad de datos y headers en páginas múltiples.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
