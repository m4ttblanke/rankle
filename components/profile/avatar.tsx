/**
 * Initials placeholder avatar (Milestone 6). No upload — `avatar_url` stays
 * unused; deferred per the M6 brief ("use a generated/initial placeholder"
 * rather than building upload/storage infrastructure).
 */
export function AvatarPlaceholder({
  name,
  size = 48,
}: {
  name: string;
  size?: number;
}) {
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  return (
    <div
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      className="grid shrink-0 place-items-center rounded-full bg-accent font-display font-extrabold text-accent-foreground"
    >
      {initial}
    </div>
  );
}
