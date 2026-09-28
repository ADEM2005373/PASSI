export function Logo({ className = "", variant = "auto" }: { className?: string, variant?: "auto" | "light" | "dark" }) {
  return (
    <svg 
      className={className} 
      viewBox="0 0 160 50" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="translate(5, 5)">
        {/* Turquoise Ticket (Bottom) */}
        <path 
          d="M 0 0 L 35 0 L 35 9 A 3.5 3.5 0 0 0 35 16 L 35 25 L 0 25 L 0 16 A 3.5 3.5 0 0 0 0 9 Z" 
          fill="#19C3B1" 
          transform="translate(0, 14) rotate(-3)" 
        />
        {/* Coral Ticket (Top) */}
        <path 
          d="M 0 0 L 35 0 L 35 9 A 3.5 3.5 0 0 0 35 16 L 35 25 L 0 25 L 0 16 A 3.5 3.5 0 0 0 0 9 Z" 
          fill="#FF6B5E" 
          transform="translate(10, 0) rotate(-12)" 
        />
      </g>
      
      {/* Text 'passi' */}
      <text 
        x="60" 
        y="37" 
        fontFamily="'Inter', system-ui, sans-serif" 
        fontWeight="900" 
        fontSize="36" 
        letterSpacing="-0.04em" 
        className={`transition-colors duration-300 ${
          variant === 'auto' ? 'fill-passi-bleu dark:fill-white' : 
          variant === 'dark' ? 'fill-white' : 'fill-passi-bleu'
        }`}
      >
        passi
      </text>
    </svg>
  );
}
