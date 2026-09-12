import type { FriendRequestEntry } from "@/lib/game/friends-schema";
import { IncomingRequestRow } from "./incoming-request-row";

export function IncomingRequests({ requests }: { requests: FriendRequestEntry[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {requests.map((r) => (
        <IncomingRequestRow key={r.requestId} entry={r} />
      ))}
    </ul>
  );
}
