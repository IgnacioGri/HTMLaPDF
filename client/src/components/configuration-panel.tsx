import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Sliders, FileText, Table, Download } from "lucide-react";
import { useState } from "react";
import { convertToPdf } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { PdfConfig } from "@shared/schema";

interface ConfigurationPanelProps {
  config: PdfConfig;
  onChange: (config: PdfConfig) => void;
  disabled: boolean;
  file: File | null;
  onConversionStarted: (jobId: number) => void;
}

export default function ConfigurationPanel({ 
  config, 
  onChange, 
  disabled, 
  file, 
  onConversionStarted 
}: ConfigurationPanelProps) {
  const [isConverting, setIsConverting] = useState(false);
  const { toast } = useToast();

  const updateConfig = (updates: Partial<PdfConfig>) => {
    onChange({ ...config, ...updates });
  };

  const handleConvert = async () => {
    if (!file) return;

    setIsConverting(true);
    try {
      const result = await convertToPdf(file, config);
      onConversionStarted(result.jobId);
      toast({
        title: "Conversión iniciada",
        description: "Tu PDF se está generando. Puedes ver el progreso en la vista previa.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo iniciar la conversión. Intenta nuevamente.",
        variant: "destructive",
      });
    } finally {
      setIsConverting(false);
    }
  };

  return (
    <Card>
      <div className="cohen-burgundy px-6 py-4">
        <h2 className="text-white text-lg font-semibold flex items-center">
          <Sliders className="mr-3 h-5 w-5" />
          Configuración de PDF
        </h2>
      </div>
      
      <CardContent className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Page Settings */}
          <div className="space-y-4">
            <h3 className="font-medium text-foreground flex items-center">
              <FileText className="text-primary mr-2 h-4 w-4" />
              Configuración de Página
            </h3>
            
            <div className="space-y-3">
              <div>
                <Label htmlFor="pageSize">Tamaño de página</Label>
                <Select
                  value={config.pageSize}
                  onValueChange={(value: "A4" | "Letter" | "Legal") => updateConfig({ pageSize: value })}
                  disabled={disabled}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4 (210 × 297 mm)</SelectItem>
                    <SelectItem value="Letter">Letter (8.5 × 11 in)</SelectItem>
                    <SelectItem value="Legal">Legal (8.5 × 14 in)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div>
                <Label>Orientación</Label>
                <div className="flex space-x-4 mt-2">
                  <label className="flex items-center">
                    <input 
                      type="radio" 
                      name="orientation" 
                      value="portrait" 
                      checked={config.orientation === "portrait"}
                      onChange={(e) => updateConfig({ orientation: e.target.value as "portrait" | "landscape" })}
                      disabled={disabled}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="ml-2 text-sm">Vertical</span>
                  </label>
                  <label className="flex items-center">
                    <input 
                      type="radio" 
                      name="orientation" 
                      value="landscape"
                      checked={config.orientation === "landscape"}
                      onChange={(e) => updateConfig({ orientation: e.target.value as "portrait" | "landscape" })}
                      disabled={disabled}
                      className="text-primary focus:ring-primary"
                    />
                    <span className="ml-2 text-sm">Horizontal</span>
                  </label>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="marginTop">Márgen superior (mm)</Label>
                  <Input
                    id="marginTop"
                    type="number"
                    value={config.marginTop}
                    onChange={(e) => updateConfig({ marginTop: parseInt(e.target.value) || 5 })}
                    min="2"
                    max="25"
                    disabled={disabled}
                  />
                </div>
                <div>
                  <Label htmlFor="marginSide">Márgen lateral (mm)</Label>
                  <Input
                    id="marginSide"
                    type="number"
                    value={config.marginSide}
                    onChange={(e) => updateConfig({ marginSide: parseInt(e.target.value) || 5 })}
                    min="2"
                    max="25"
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>
          </div>
          
          {/* Table Settings */}
          <div className="space-y-4">
            <h3 className="font-medium text-foreground flex items-center">
              <Table className="text-primary mr-2 h-4 w-4" />
              Configuración de Tablas
            </h3>
            
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="repeatHeaders"
                  checked={config.repeatHeaders}
                  onCheckedChange={(checked) => updateConfig({ repeatHeaders: !!checked })}
                  disabled={disabled}
                />
                <Label htmlFor="repeatHeaders" className="text-sm">
                  Repetir headers en páginas nuevas
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="keepGroupsTogether"
                  checked={config.keepGroupsTogether}
                  onCheckedChange={(checked) => updateConfig({ keepGroupsTogether: !!checked })}
                  disabled={disabled}
                />
                <Label htmlFor="keepGroupsTogether" className="text-sm">
                  Mantener grupos de activos unidos
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="alternateRowColors"
                  checked={config.alternateRowColors}
                  onCheckedChange={(checked) => updateConfig({ alternateRowColors: !!checked })}
                  disabled={disabled}
                />
                <Label htmlFor="alternateRowColors" className="text-sm">
                  Alternar colores de filas
                </Label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="autoFitText"
                  checked={config.autoFitText}
                  onCheckedChange={(checked) => updateConfig({ autoFitText: !!checked })}
                  disabled={disabled}
                />
                <Label htmlFor="autoFitText" className="text-sm">
                  Ajustar texto automáticamente
                </Label>
              </div>
              
              <div>
                <Label htmlFor="contentScale">Escala de contenido</Label>
                <div className="flex items-center space-x-3 mt-2">
                  <span className="text-sm text-muted-foreground">Pequeño</span>
                  <Slider
                    value={[config.contentScale]}
                    onValueChange={([value]) => updateConfig({ contentScale: value })}
                    min={70}
                    max={100}
                    step={5}
                    className="flex-1"
                    disabled={disabled}
                  />
                  <span className="text-sm text-muted-foreground">Grande</span>
                  <span className="text-sm font-medium bg-muted px-2 py-1 rounded min-w-[45px] text-center">
                    {config.contentScale}%
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Generate Button */}
        <div className="mt-8 pt-6 border-t border-border">
          <Button 
            onClick={handleConvert}
            disabled={disabled || isConverting}
            className="w-full h-12 text-base font-semibold"
            size="lg"
          >
            <Download className="mr-3 h-5 w-5" />
            {isConverting ? 'Generando PDF...' : 'Generar PDF'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
