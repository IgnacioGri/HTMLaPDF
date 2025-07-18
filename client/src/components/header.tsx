import { BarChart3, Settings, Clock } from "lucide-react";

export default function Header() {
  return (
    <header className="cohen-burgundy shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <div className="bg-white p-2 rounded">
              <BarChart3 className="text-cohen-burgundy h-6 w-6" />
            </div>
            <div>
              <h1 className="text-white text-xl font-semibold">Cohen PDF Generator</h1>
              <p className="text-white/80 text-sm">Reportes Financieros Profesionales</p>
            </div>
          </div>
          <nav className="hidden md:flex space-x-6">
            <a href="#" className="text-white hover:text-cohen-burgundy-light transition-colors flex items-center">
              <BarChart3 className="mr-2 h-4 w-4" />
              Convertir
            </a>
            <a href="#" className="text-white/80 hover:text-white transition-colors flex items-center">
              <Settings className="mr-2 h-4 w-4" />
              Configuración
            </a>
            <a href="#" className="text-white/80 hover:text-white transition-colors flex items-center">
              <Clock className="mr-2 h-4 w-4" />
              Historial
            </a>
          </nav>
        </div>
      </div>
    </header>
  );
}
