import React from 'react';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  hoverEffect?: boolean;
  glow?: boolean;
}

export const GlassCard: React.FC<GlassCardProps> = ({
  children,
  className = '',
  onClick,
  hoverEffect = false,
  glow = false
}) => {
  return (
    <div
      onClick={onClick}
      className={`
        rounded-2xl border p-5 backdrop-blur-xl transition-all duration-200
        bg-slate-900/60 border-slate-800/80 text-slate-100 shadow-xl
        ${hoverEffect ? 'hover:border-hp-500/40 hover:bg-slate-900/80 hover:-translate-y-0.5 cursor-pointer' : ''}
        ${glow ? 'shadow-glass-glow border-hp-500/30' : ''}
        ${className}
      `}
    >
      {children}
    </div>
  );
};
