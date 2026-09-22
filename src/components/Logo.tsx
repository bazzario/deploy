/**
 * Bazaario brand marks. All files live in /public and have transparent backgrounds.
 *
 * - LogoText: small "Bazaario" text logo (site header and mobile menu header)
 * - LogoIcon: small orange cart "B" icon (admin sidebar, favicon source)
 * - LogoFull: full logo, icon + "Bazaario" wordmark (larger branding areas)
 *   Use variant="light" on dark backgrounds (white wordmark).
 */

interface LogoTextProps {
  className?: string;
}

export function LogoText({ className = "text-xl sm:text-2xl" }: LogoTextProps) {
  return (
    <span className={`font-display font-extrabold leading-none select-none whitespace-nowrap ${className}`}>
      <span className="text-brand-500">Bazaar</span>
      <span className="text-ink">io</span>
    </span>
  );
}

interface LogoIconProps {
  className?: string;
}

export function LogoIcon({ className = "h-10" }: LogoIconProps) {
  return (
    <img
      src="/bazaario-icon.png"
      alt="Bazaario"
      width={320}
      height={232}
      draggable={false}
      className={`w-auto select-none ${className}`}
    />
  );
}

interface LogoFullProps {
  className?: string;
  variant?: "default" | "light";
}

export function LogoFull({ className = "h-16", variant = "default" }: LogoFullProps) {
  return (
    <img
      src={variant === "light" ? "/bazaario-logo-light.png" : "/bazaario-logo.png"}
      alt="Bazaario"
      width={700}
      height={397}
      draggable={false}
      className={`w-auto select-none ${className}`}
    />
  );
}
