import centerfrios from "@/assets/centerfrios-logo.webp";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: "h-8",
  md: "h-10",
  lg: "h-14",
};

export function Logo({ size = "md", className = "" }: LogoProps) {
  return (
    <span className={`inline-flex items-center ${className}`}>
      <img src={centerfrios} alt="Centerfrios" className={`${sizes[size]} object-contain`} />
    </span>
  );
}
