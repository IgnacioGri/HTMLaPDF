import { useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileCode, FolderOpen, X, CheckCircle } from "lucide-react";
import { useDropzone } from "react-dropzone";
import { analyzeFile } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { AnalysisResult } from "@shared/schema";

interface FileUploadProps {
  onFileUploaded: (file: File, analysis: AnalysisResult) => void;
  analysis: AnalysisResult | null;
}

export default function FileUpload({ onFileUploaded, analysis }: FileUploadProps) {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const { toast } = useToast();

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (!file) return;

    setUploadedFile(file);
    setIsAnalyzing(true);

    try {
      const analysisResult = await analyzeFile(file);
      onFileUploaded(file, analysisResult);
      
      if (!analysisResult.isValidCohenFormat) {
        toast({
          title: "Advertencia",
          description: "El archivo no parece seguir el formato estándar de Cohen. La conversión puede no ser óptima.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo analizar el archivo. Verifica que sea un HTML válido.",
        variant: "destructive",
      });
      setUploadedFile(null);
    } finally {
      setIsAnalyzing(false);
    }
  }, [onFileUploaded, toast]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/html': ['.html', '.htm'],
    },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024, // 10MB
  });

  const handleRemoveFile = () => {
    setUploadedFile(null);
    onFileUploaded(null as any, null as any);
  };

  return (
    <Card className="bg-cohen-card-bg border-cohen-border shadow-sm">
      <div className="bg-white px-6 py-4 border-b border-cohen-border">
        <h2 className="text-cohen-text text-lg font-semibold flex items-center">
          <FileCode className="mr-3 h-5 w-5 text-cohen-burgundy" />
          Cargar Reporte HTML
        </h2>
        <p className="text-cohen-secondary-text text-sm mt-1">
          Arrastra tu archivo HTML o haz clic para seleccionar
        </p>
      </div>
      
      <CardContent className="p-8">
        {!uploadedFile ? (
          <div
            {...getRootProps()}
            className={`border-2 border-dashed border-cohen-border rounded-lg p-12 text-center hover:border-cohen-burgundy hover:bg-cohen-gray/50 transition-all duration-300 cursor-pointer group ${
              isDragActive ? 'border-cohen-burgundy bg-cohen-gray/50' : ''
            }`}
          >
            <input {...getInputProps()} />
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-cohen-burgundy rounded-lg flex items-center justify-center group-hover:scale-105 transition-transform">
                <FileCode className="text-white h-8 w-8" />
              </div>
              <div>
                <h3 className="text-lg font-medium text-cohen-text">
                  {isDragActive ? 'Suelta el archivo aquí' : 'Selecciona tu reporte HTML'}
                </h3>
                <p className="text-cohen-secondary-text mt-1">Formatos soportados: .html, .htm</p>
              </div>
              <Button className="btn-cohen-primary inline-flex items-center">
                <FolderOpen className="mr-2 h-4 w-4" />
                Examinar archivos
              </Button>
            </div>
          </div>
        ) : (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                  <FileCode className="text-green-600 h-5 w-5" />
                </div>
                <div>
                  <p className="font-medium text-green-800">{uploadedFile.name}</p>
                  <p className="text-green-600 text-sm">
                    {(uploadedFile.size / (1024 * 1024)).toFixed(1)} MB • 
                    {isAnalyzing ? ' Analizando...' : ' Cargado exitosamente'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleRemoveFile}
                className="text-green-600 hover:text-green-800"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {analysis && !isAnalyzing && (
              <div className="mt-4 pt-4 border-t border-green-200">
                <h4 className="font-medium text-green-800 mb-2">Análisis del reporte:</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-green-700">Tablas detectadas:</span>
                    <span className="font-medium text-green-800">{analysis.tableCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Activos encontrados:</span>
                    <span className="font-medium text-green-800">{analysis.assetCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Páginas estimadas:</span>
                    <span className="font-medium text-green-800">{analysis.estimatedPages}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-green-700">Formato Cohen:</span>
                    <span className={analysis.isValidCohenFormat ? "text-green-600" : "text-yellow-600"}>
                      <CheckCircle className="inline mr-1 h-3 w-3" />
                      {analysis.isValidCohenFormat ? 'Válido' : 'Parcial'}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
