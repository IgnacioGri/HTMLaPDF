import { BarChart3, Settings, Clock } from "lucide-react";

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-cohen-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-3">
            <div className="bg-cohen-burgundy p-2 rounded-lg">
              <BarChart3 className="text-white h-6 w-6" />
            </div>
            <div>
              <h1 className="text-cohen-text text-xl font-semibold">Cohen PDF Generator</h1>
              <p className="text-cohen-secondary-text text-sm">Reportes Financieros Profesionales</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
