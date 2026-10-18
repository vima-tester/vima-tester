/**
 * The vima tester mark. Served from `public/logo.png` so the same file backs
 * the in-app brand and the favicon.
 *
 * Rendered as decorative (`alt=""`): the adjacent wordmark supplies the name.
 */
export function Logo({ size = 24, className }: { size?: number; className?: string }): JSX.Element {
  return (
    <img
      src="/logo.png"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className ? `logo ${className}` : 'logo'}
    />
  );
}
