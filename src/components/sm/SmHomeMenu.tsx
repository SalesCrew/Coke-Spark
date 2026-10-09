"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { CollapsibleMenu } from "@/components/ui/CollapsibleMenu";
import { fetchSmMessageUnreadCount, SM_MESSAGES_CHANGED_EVENT, getAuthPrincipalKey, readAuthSession } from "@/lib/api/backend";
import { subscribeToAuthSessionChanges } from "@/lib/auth/sessionRegistry";
import { SmMessagesPanel } from "./SmMessagesPanel";

/** SM-only opt-in: GM callers keep the original menu and perform no inbox requests. */
export function SmHomeMenu(props: Omit<ComponentProps<typeof CollapsibleMenu>, "smMessages">) {
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [owner, setOwner] = useState(() => getAuthPrincipalKey(readAuthSession()));
  const requestSequence = useRef(0);
  useEffect(() => {
    const requests = requestSequence;
    let active = true;
    let principal = getAuthPrincipalKey(readAuthSession());
    const load = async () => {
      const sequence = ++requests.current;
      try {
        const count = await fetchSmMessageUnreadCount();
        if (active && sequence === requests.current) setUnreadCount(count);
      } catch { /* Preserve the last count; an unknown count never becomes a false zero. */ }
    };
    const visible = () => { if (!document.hidden) void load(); };
    const unsubscribe = subscribeToAuthSessionChanges(() => {
      const next = getAuthPrincipalKey(readAuthSession());
      if (next === principal) return;
      principal = next; ++requests.current; setOwner(next); setUnreadCount(null); void load();
    });
    window.addEventListener(SM_MESSAGES_CHANGED_EVENT, visible);
    window.addEventListener("focus", visible); window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    const interval = window.setInterval(visible, 120_000);
    void load();
    return () => {
      active = false; ++requests.current; unsubscribe(); window.clearInterval(interval);
      window.removeEventListener(SM_MESSAGES_CHANGED_EVENT, visible);
      window.removeEventListener("focus", visible); window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, []);
  return <><style>{`@media (prefers-reduced-motion: reduce) { [data-sm-messages-menu], [data-sm-messages-menu] * { transition: none !important; animation: none !important; } }`}</style><CollapsibleMenu key={owner ?? "signed-out"} {...props}
    smMessages={{ unreadCount, panel: <SmMessagesPanel /> }} /></>;
}
