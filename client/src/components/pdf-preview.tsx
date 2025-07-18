import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Eye, Download, FileText, Clock, AlertCircle, CheckCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { getJobStatus } from "@/lib/api";
import type { PdfConfig, AnalysisResult } from "@shared/schema";

interface PdfPreviewProps {
  jobId: number | null;
  file: File | null;
  analysis: AnalysisResult | null;
}

export default function PdfPreview({ jobId, file, analysis }: PdfPreviewProps) {
  const [progress, setProgress] = useState(0);

  const { data: job } = useQuery({
    queryKey: ["/api/job", jobId],
    enabled: !!jobId,
    refetchInterval: jobId ? 1000 : false,
  });

  useEffect(() => {
    if (job?.status === "processing") {
      // Simulate progress based on time elapsed
      const startTime = new Date(job.createdAt).getTime();
      const now = Date.now();
      const elapsed = now - startTime;
      const estimatedDuration = 10000; // 10 seconds
      const calculatedProgress = Math.min((elapsed / estimatedDuration) * 100, 95);
      setProgress(calculatedProgress);
    } else if (job?.status === "completed") {
      setProgress(100);
    } else if (job?.status === "failed") {
      setProgress(0);
    }
  }, [job]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed": return "text-green-600";
      case "processing": return "text-blue-600";
      case "failed": return "text-red-600";
      default: return "text-gray-600";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed": return <CheckCircle className="h-4 w-4" />;
      case "processing": return <Clock className="h-4 w-4 animate-spin" />;
      case "failed": return <AlertCircle className="h-4 w-4" />;
      default: return <FileText className="h-4 w-4" />;
    }
  };

  const getProgressMessage = (progress: number) => {
    if (progress < 20) return "Validando formato HTML...";
    if (progress < 40) return "Analizando estructura de tablas...";
    if (progress < 60) return "Aplicando configuración de página...";
    if (progress < 80) return "Optimizando paginación...";
    if (progress < 95) return "Generando PDF final...";
    return "Finalizando proceso...";
  };

  return (
    <Card>
      <div className="cohen-burgundy px-6 py-4">
        <h2 className="text-white text-lg font-semibold flex items-center">
          <Eye className="mr-3 h-5 w-5" />
          Vista Previa
        </h2>
      </div>
      
      <CardContent className="p-6">
        {!file ? (
          <div className="bg-muted rounded-lg p-6 text-center min-h-[300px] flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="text-primary h-8 w-8" />
              </div>
              <h3 className="font-medium text-foreground mb-2">Vista previa no disponible</h3>
              <p className="text-muted-foreground text-sm">Carga un archivo HTML para ver la vista previa</p>
            </div>
          </div>
        ) : job?.status === "processing" ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto mb-4 upload-animation">
              <Clock className="text-white h-8 w-8 processing-spin" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Procesando reporte</h3>
            <p className="text-muted-foreground mb-6">Optimizando tablas y aplicando configuración...</p>
            
            <div className="w-full bg-muted rounded-full h-2 mb-4">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            
            <div className="text-sm text-muted-foreground">
              {getProgressMessage(progress)}
            </div>
          </div>
        ) : job?.status === "completed" ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="text-green-600 h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">PDF Generado</h3>
            <p className="text-muted-foreground mb-6">Tu reporte está listo para descargar</p>
            
            <div className="space-y-3">
              <Button 
                onClick={() => window.open(`/api/download/${jobId}`, '_blank')}
                className="w-full"
              >
                <Download className="mr-2 h-4 w-4" />
                Descargar PDF
              </Button>
              
              <Button 
                onClick={() => window.location.reload()}
                variant="outline"
                className="w-full"
              >
                <FileText className="mr-2 h-4 w-4" />
                Cargar Nuevo Archivo
              </Button>
            </div>
          </div>
        ) : job?.status === "failed" ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="text-red-600 h-8 w-8" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Error en la conversión</h3>
            <p className="text-muted-foreground mb-6">{job.error || "Ha ocurrido un error inesperado"}</p>
            
            <Button variant="outline" onClick={() => window.location.reload()}>
              Intentar nuevamente
            </Button>
          </div>
        ) : analysis ? (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="font-medium text-blue-800 mb-2">Configuración optimizada para Cohen:</h3>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-blue-700">Página:</span>
                  <span className="font-medium text-blue-800">A4 vertical</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Márgenes:</span>
                  <span className="font-medium text-blue-800">3mm mínimos</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Escala:</span>
                  <span className="font-medium text-blue-800">85% optimizado</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-blue-700">Headers:</span>
                  <span className="font-medium text-blue-800">Repetir en cada página</span>
                </div>
              </div>
            </div>
            
            <Button variant="outline" className="w-full">
              <Eye className="mr-2 h-4 w-4" />
              Vista previa completa
            </Button>
          </div>
        ) : (
          <div className="bg-muted rounded-lg p-6 text-center min-h-[300px] flex items-center justify-center">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="text-primary h-8 w-8" />
              </div>
              <h3 className="font-medium text-foreground mb-2">Archivo listo</h3>
              <p className="text-muted-foreground text-sm">Configura las opciones y genera tu PDF</p>
            </div>
          </div>
        )}
        
        {job && (
          <div className="mt-4 p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Estado:</span>
              <span className={`flex items-center space-x-1 ${getStatusColor(job.status)}`}>
                {getStatusIcon(job.status)}
                <span className="capitalize">{job.status}</span>
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
