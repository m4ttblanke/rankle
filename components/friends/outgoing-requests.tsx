import type { FriendRequestEntry } from "@/lib/game/friends-schema";
import { OutgoingRequestRow } from "./outgoing-request-row";

export function OutgoingRequests({ requests }: { requests: FriendRequestEntry[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {requests.map((r) => (
        <OutgoingRequestRow key={r.requestId} entry={r} />
      ))}
    </ul>
  );
}
