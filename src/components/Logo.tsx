import logoGlyph from "@/assets/logo-glyph.png";

interface LogoProps {
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { glyph: "w-7 h-7", text: "text-lg" },
  md: { glyph: "w-9 h-9", text: "text-[22px]" },
  lg: { glyph: "w-12 h-12", text: "text-2xl" },
};

export function Logo({ size = "md", className = "" }: LogoProps) {
  const s = sizes[size];
  return (
    <span className={`inline-flex items-center gap-0.5 ${className}`}>
      <img src={logoGlyph} alt="" className={`${s.glyph} object-contain`} />
      <span className={`font-display font-bold text-primary tracking-tight ${s.text}`}>
        meuevento
      </span>
    </span>
  );
}
