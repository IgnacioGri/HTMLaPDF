import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useState } from "react";
import { convertToPdf } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface ConfigSimpleProps {
  disabled: boolean;
  file: File | null;
  onConversionStarted: (jobId: number) => void;
}

export default function ConfigSimple({ 
  disabled, 
  file, 
  onConversionStarted 
}: ConfigSimpleProps) {
  const [isConverting, setIsConverting] = useState(false);
  const { toast } = useToast();

  async function handleConvert() {
    if (!file) return;

    setIsConverting(true);
    try {
      const config = {
        pageSize: "A4" as const,
        orientation: "portrait" as const,
        marginTop: 3,
        marginSide: 3,
        repeatHeaders: true,
        keepGroupsTogether: true,
        alternateRowColors: true,
        autoFitText: true,
        contentScale: 85,
      };

      const result = await convertToPdf(file, config);
      onConversionStarted(result.jobId);
      toast({
        title: "Conversión iniciada",
        description: "Tu PDF se está generando con configuración optimizada para reportes Cohen.",
      });
    } catch (error: any) {
      toast({
        title: "Error en la conversión",
        description: error.message || "No se pudo iniciar la conversión. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  }

  return (
    <Card>
      <div className="cohen-burgundy px-6 py-4">
        <h2 className="text-white text-lg font-semibold">
          Generar PDF
        </h2>
      </div>
      
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="mb-2">Configuración optimizada para reportes Cohen:</p>
            <ul className="space-y-1 text-xs">
              <li>• Página A4 vertical con márgenes optimizados</li>
              <li>• Encabezados de tabla repetidos en cada página</li>
              <li>• Grupos de inversión mantenidos juntos</li>
              <li>• Escala 85% para incluir todas las columnas</li>
            </ul>
          </div>
          
          <Button 
            onClick={handleConvert}
            disabled={disabled || isConverting}
            className="w-full cohen-burgundy hover:bg-burgundy-dark"
            size="lg"
          >
            {isConverting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Generando PDF...
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" />
                Generar PDF Optimizado
              </>
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}