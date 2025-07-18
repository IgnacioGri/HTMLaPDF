import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileSpreadsheet, Download, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ExcelExportButtonProps {
  uploadedFile: File | null;
  disabled?: boolean;
}

export function ExcelExportButton({ uploadedFile, disabled }: ExcelExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExcelExport = async () => {
    if (!uploadedFile) {
      toast({
        title: "Error",
        description: "No hay archivo seleccionado para exportar",
        variant: "destructive",
      });
      return;
    }

    setIsExporting(true);
    
    try {
      const formData = new FormData();
      formData.append('htmlFile', uploadedFile);

      const response = await fetch('/api/export-excel', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al exportar a Excel');
      }

      // Get the filename from response headers
      const contentDisposition = response.headers.get('content-disposition');
      const fileName = contentDisposition 
        ? contentDisposition.split('filename=')[1]?.replace(/"/g, '')
        : `${uploadedFile.name.replace('.html', '')}_export.xlsx`;

      // Download the Excel file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: "¡Exportación exitosa!",
        description: `Se ha descargado el archivo Excel: ${fileName}`,
      });
    } catch (error) {
      console.error('Excel export error:', error);
      toast({
        title: "Error en la exportación",
        description: error.message || "No se pudo exportar a Excel",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      onClick={handleExcelExport}
      disabled={disabled || !uploadedFile || isExporting}
      variant="outline"
      className="w-full"
    >
      {isExporting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <FileSpreadsheet className="mr-2 h-4 w-4" />
      )}
      {isExporting ? 'Exportando...' : 'Exportar a Excel'}
    </Button>
  );
}