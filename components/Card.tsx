import { ReactNode } from "react";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white p-5 shadow-sm ${className}`}>{children}</div>
  );
}

export function GradientCard({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-brand-gradient p-5 text-white shadow-md ${className}`}>
      {children}
    </div>
  );
}
