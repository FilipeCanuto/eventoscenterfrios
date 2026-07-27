import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Domínio público oficial. Usado em links compartilháveis (UTMs, QR Codes),
 * para que o preview do Lovable nunca vaze em campanhas.
 */
export const PUBLIC_ORIGIN = "https://eventos.centerfrios.com";

export function publicUrl(path: string) {
  return `${PUBLIC_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

