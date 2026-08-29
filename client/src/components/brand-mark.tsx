import { Building2, HardHat } from "lucide-react";

export const BRAND_NAME = "Pembelajaran Bisnis Konstruksi";
export const BRAND_TAGLINE = "Kompetensi Kontraktor";

type BrandMarkProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeStyles = {
  sm: {
    wrapper: "h-8 w-8 rounded-md",
    primaryIcon: "h-4 w-4",
    secondaryIcon: "h-3 w-3",
  },
  md: {
    wrapper: "h-10 w-10 rounded-md",
    primaryIcon: "h-5 w-5",
    secondaryIcon: "h-3.5 w-3.5",
  },
  lg: {
    wrapper: "h-12 w-12 rounded-xl",
    primaryIcon: "h-6 w-6",
    secondaryIcon: "h-4 w-4",
  },
};

export function BrandMark({ size = "md", className = "" }: BrandMarkProps) {
  const styles = sizeStyles[size];

  return (
    <div
      role="img"
      aria-label={`${BRAND_NAME} — ${BRAND_TAGLINE}`}
      className={`relative flex shrink-0 items-center justify-center bg-primary ${styles.wrapper} ${className}`}
    >
      <Building2
        aria-hidden="true"
        className={`absolute bottom-1 right-1 text-amber-300/90 ${styles.secondaryIcon}`}
      />
      <HardHat
        aria-hidden="true"
        className={`relative z-10 text-primary-foreground ${styles.primaryIcon}`}
      />
    </div>
  );
}