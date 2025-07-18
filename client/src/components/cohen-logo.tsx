interface CohenLogoProps {
  className?: string;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export default function CohenLogo({ className = "", showText = true, size = 'md' }: CohenLogoProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8', 
    lg: 'w-12 h-12'
  };

  const textSizeClasses = {
    sm: 'text-lg',
    md: 'text-xl',
    lg: 'text-3xl'
  };

  return (
    <div className={`flex items-center space-x-3 ${className}`}>
      {/* Cohen Square Logo */}
      <div className={`${sizeClasses[size]} flex-shrink-0`}>
        <svg 
          width="100%" 
          height="100%" 
          viewBox="0 0 100 100" 
          fill="none" 
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Outer burgundy square */}
          <rect 
            x="2" 
            y="2" 
            width="96" 
            height="96" 
            fill="var(--cohen-burgundy)" 
            stroke="var(--cohen-burgundy)" 
            strokeWidth="4"
          />
          
          {/* Inner white area */}
          <rect 
            x="12" 
            y="12" 
            width="76" 
            height="76" 
            fill="white"
          />
          
          {/* Horizontal lines - representing financial reports/documents */}
          {/* Top line - shortest */}
          <rect 
            x="25" 
            y="35" 
            width="25" 
            height="4" 
            fill="var(--cohen-burgundy)"
          />
          
          {/* Middle line - medium */}
          <rect 
            x="25" 
            y="47" 
            width="35" 
            height="4" 
            fill="var(--cohen-burgundy)"
          />
          
          {/* Bottom line - longest */}
          <rect 
            x="25" 
            y="59" 
            width="45" 
            height="4" 
            fill="var(--cohen-burgundy)"
          />
        </svg>
      </div>
      
      {/* Cohen Text */}
      {showText && (
        <div className="flex items-baseline">
          <span className={`font-light text-cohen-text ${textSizeClasses[size]}`}>
            Cohen
          </span>
          <span className="text-xs text-cohen-secondary-text ml-1 font-normal">
            TM
          </span>
        </div>
      )}
    </div>
  );
}