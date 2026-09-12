import type { Friend } from "@/lib/game/friends";
import { FriendRow } from "./friend-row";

export function FriendsList({
  friends,
  playedByUserId,
}: {
  friends: Friend[];
  /** `null` when there is no live game today to report on. */
  playedByUserId: Map<string, boolean> | null;
}) {
  if (friends.length === 0) {
    return <p className="text-sm text-muted">No friends yet — search by username above.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {friends.map((f) => (
        <FriendRow key={f.id} friend={f} played={playedByUserId?.get(f.id) ?? null} />
      ))}
    </ul>
  );
}
