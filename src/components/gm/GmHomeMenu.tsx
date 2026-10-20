"use client";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentProps,
} from "react";
import { CollapsibleMenu } from "@/components/ui/CollapsibleMenu";
import {
  requestGmBriefings,
  getAuthPrincipalKey,
  readAuthSession,
} from "@/lib/api/backend";
import { subscribeToAuthSessionChanges } from "@/lib/auth/sessionRegistry";
import type { BriefingInbox } from "@/types/gmBriefings";
import { GmBriefingReader } from "./briefings/GmBriefingReader";
export function GmHomeMenu(
  props: Omit<ComponentProps<typeof CollapsibleMenu>, "gmBriefings">,
) {
  const [inbox, setInbox] = useState<BriefingInbox | null>(null),
    [error, setError] = useState(""),
    [owner, setOwner] = useState(() => getAuthPrincipalKey(readAuthSession()));
  const [origin, setOrigin] = useState<{
      left: number;
      top: number;
      width: number;
      height: number;
    } | null>(null),
    sequence = useRef(0),
    mounted = useRef(false),
    root = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    if (readAuthSession()?.user.role !== "gm") return;
    const current = ++sequence.current;
    try {
      const data = await requestGmBriefings<BriefingInbox>("/gm/briefings");
      if (mounted.current && current === sequence.current) {
        setInbox(data);
        setError("");
      }
    } catch {
      if (mounted.current && current === sequence.current)
        setError("Wochenschwerpunkte konnten nicht geladen werden.");
    }
  }, []);
  useEffect(() => {
    const requests = sequence;
    mounted.current = true;
    let principal = getAuthPrincipalKey(readAuthSession());
    const visible = () => {
      if (!document.hidden) void load();
    };
    const unsubscribe = subscribeToAuthSessionChanges(() => {
      const next = getAuthPrincipalKey(readAuthSession());
      if (next === principal) return;
      principal = next;
      ++sequence.current;
      setOwner(next);
      setInbox(null);
      setOrigin(null);
      setError("");
      void load();
    });
    // The inbox updates only after the external request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    window.addEventListener("focus", visible);
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    const interval = window.setInterval(visible, 120_000);
    return () => {
      mounted.current = false;
      ++requests.current;
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener("focus", visible);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load]);
  const close = useCallback(() => {
    setOrigin(null);
    void load();
    requestAnimationFrame(() =>
      root.current
        ?.querySelector<HTMLElement>("[data-gm-briefings-menu]")
        ?.focus({ preventScroll: true }),
    );
  }, [load]);
  return (
    <div ref={root}>
      <CollapsibleMenu
        key={owner ?? "signed-out"}
        {...props}
        gmBriefings={{
          unreadCount: inbox?.unreadCount ?? null,
          available: !!inbox?.items.length,
          loading: !inbox && !error,
          error: !!error,
          onOpen: (rect) => {
            if (error) {
              void load();
              return;
            }
            if (inbox?.items.length)
              setOrigin({
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
              });
          },
        }}
      />
      {origin && inbox && (
        <GmBriefingReader
          key={owner}
          items={inbox.items}
          origin={origin}
          onClose={close}
          onRead={load}
          onRefresh={load}
        />
      )}
    </div>
  );
}
