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
import { ActionBriefingsPanel } from "./briefings/ActionBriefingsPanel";
import type { BriefingInbox } from "@/types/gmBriefings";
import { GmBriefingReader } from "./briefings/GmBriefingReader";
export function GmHomeMenu(
  props: Omit<
    ComponentProps<typeof CollapsibleMenu>,
    "gmBriefings" | "gmActionBriefings"
  >,
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
  const [actionInbox, setActionInbox] = useState<BriefingInbox | null>(null),
    [actionError, setActionError] = useState(false);
  const [actionReader, setActionReader] = useState<{
    id: string;
    origin: DOMRect;
  } | null>(null);
  const actionSequence = useRef(0),
    actionTrigger = useRef<HTMLButtonElement | null>(null),
    restoreActionFocus = useRef(false);
  const loadActions = useCallback(async () => {
    if (readAuthSession()?.user.role !== "gm") return;
    const current = ++actionSequence.current;
    try {
      const data = await requestGmBriefings<BriefingInbox>(
        "/gm/action-briefings",
      );
      if (mounted.current && current === actionSequence.current) {
        setActionInbox(data);
        setActionError(false);
      }
    } catch {
      if (mounted.current && current === actionSequence.current)
        setActionError(true);
    }
  }, []);
  useEffect(() => {
    if (!actionReader && restoreActionFocus.current) {
      restoreActionFocus.current = false;
      actionTrigger.current?.focus({ preventScroll: true });
    }
  }, [actionReader]);
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
      if (!document.hidden) {
        void load();
        void loadActions();
      }
    };
    const unsubscribe = subscribeToAuthSessionChanges(() => {
      const next = getAuthPrincipalKey(readAuthSession());
      if (next === principal) return;
      principal = next;
      ++sequence.current;
      ++actionSequence.current;
      setActionInbox(null);
      setActionError(false);
      setActionReader(null);
      setOwner(next);
      setInbox(null);
      setOrigin(null);
      setError("");
      void load();
      void loadActions();
    });
    // The inbox updates only after the external request settles.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
    void loadActions();
    window.addEventListener("focus", visible);
    window.addEventListener("online", visible);
    document.addEventListener("visibilitychange", visible);
    const interval = window.setInterval(visible, 120_000);
    return () => {
      mounted.current = false;
      ++requests.current;
      ++actionSequence.current;
      unsubscribe();
      clearInterval(interval);
      window.removeEventListener("focus", visible);
      window.removeEventListener("online", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [load, loadActions]);
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
        gmActionBriefings={{
          unreadCount: actionInbox?.unreadCount ?? 0,
          render: (onBack) => (
            <ActionBriefingsPanel
              items={actionInbox?.items ?? []}
              loading={!actionInbox && !actionError}
              error={actionError}
              onBack={onBack}
              onReload={() => void loadActions()}
              onOpen={(item, button) => {
                actionTrigger.current = button;
                setActionReader({
                  id: item.id,
                  origin: button.getBoundingClientRect(),
                });
              }}
            />
          ),
        }}
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
      {actionReader && (
        <GmBriefingReader
          items={
            actionInbox?.items.filter((item) => item.id === actionReader.id) ??
            []
          }
          origin={actionReader.origin}
          basePath="/gm/action-briefings"
          contextLabel="Aktionsbriefing"
          onClose={() => {
            restoreActionFocus.current = true;
            setActionReader(null);
            void loadActions();
          }}
          onRead={() => void loadActions()}
          onRefresh={() => void loadActions()}
        />
      )}
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
