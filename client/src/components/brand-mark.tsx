import { Building2, HardHat } from "lucide-react";

export const BRAND_NAME = "PKB ASDAMKINDO";
export const BRAND_TAGLINE = "Kompetensi Teknik Konstruksi";

type BrandMarkProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeStyles = {
  sm: {
    wrapper: "h-10 w-10 rounded-lg",
    primaryIcon: "h-5 w-5",
    secondaryIcon: "h-3.5 w-3.5",
  },
  md: {
    wrapper: "h-12 w-12 rounded-xl",
    primaryIcon: "h-6 w-6",
    secondaryIcon: "h-4 w-4",
  },
  lg: {
    wrapper: "h-14 w-14 rounded-xl",
    primaryIcon: "h-7 w-7",
    secondaryIcon: "h-4 w-4",
  },
};

export function BrandMark({ size = "md", className = "" }: BrandMarkProps) {
  const styles = sizeStyles[size];

  return (
    <div
      role="img"
      aria-label={`${BRAND_NAME} — ${BRAND_TAGLINE}`}
      className={`relative flex shrink-0 items-center justify-center bg-sky-500 shadow-sm shadow-sky-500/30 dark:bg-sky-400 ${styles.wrapper} ${className}`}
    >
      <Building2
        aria-hidden="true"
        className={`absolute bottom-1 right-1 text-amber-300 dark:text-amber-300 ${styles.secondaryIcon}`}
      />
      <HardHat
        aria-hidden="true"
        className={`relative z-10 text-white dark:text-slate-950 ${styles.primaryIcon}`}
      />
    </div>
  );
}