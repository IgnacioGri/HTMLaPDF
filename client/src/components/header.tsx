import CohenLogo from "./cohen-logo";

export default function Header() {
  return (
    <header className="bg-white shadow-sm border-b border-cohen-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-4">
            <CohenLogo size="md" showText={true} />
            <div className="border-l border-cohen-border pl-4">
              <h1 className="text-cohen-text text-lg font-medium">PDF Generator</h1>
              <p className="text-cohen-secondary-text text-sm">Reportes Financieros Profesionales</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
