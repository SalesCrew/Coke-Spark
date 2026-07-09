"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { Plus, X, Trash2, Search } from "lucide-react";
import {
  type PhotoTagPoolItem,
  activeTagPool,
} from "@/utils/photoTags";
import { createPhotoTag, fetchPhotoTags, updatePhotoTag } from "@/lib/api/backend";

interface PhotoTagsConfigProps {
  config: Record<string, unknown>;
  onChange: (c: Record<string, unknown>) => void;
  accentColor?: string;
}

export function PhotoTagsConfig({
  config,
  onChange,
  accentColor = "#DC2626",
}: PhotoTagsConfigProps) {
  const instruction = String(config.instruction ?? "");
  const tagsEnabled = Boolean(config.tagsEnabled ?? false);
  const tagIds = (config.tagIds as string[]) ?? [];

  // ── Pool state ────────────────────────────────────────────────
  const [pool, setPool] = useState<PhotoTagPoolItem[]>([]);
  const [poolOpen, setPoolOpen] = useState(false);
  const [poolSearch, setPoolSearch] = useState("");
  const [createInput, setCreateInput] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [dropPos, setDropPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [isCreatingTag, setIsCreatingTag] = useState(false);
  const [deletingTagIds, setDeletingTagIds] = useState<Record<string, boolean>>({});

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const tags = await fetchPhotoTags();
        if (cancelled) return;
        setPool(
          tags.map((t) => ({
            id: t.id,
            label: t.label,
            deletedAt: t.deletedAt ?? undefined,
          })),
        );
      } catch {
        if (!cancelled) setPool([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync expanded with tagsEnabled
  useEffect(() => {
    if (tagsEnabled && !expanded) setExpanded(true);
    if (!tagsEnabled && expanded) setExpanded(false);
  }, [tagsEnabled]); // eslint-disable-line react-hooks/exhaustive-deps

  // Position dropdown under trigger button
  const updateDropPos = useCallback(() => {
    if (!triggerRef.current) return;
    const r = triggerRef.current.getBoundingClientRect();
    setDropPos({ top: r.bottom + 4, left: r.left, width: r.width });
  }, []);

  // Keep position in sync while open
  useEffect(() => {
    if (!poolOpen) return;
    updateDropPos();
    window.addEventListener("scroll", updateDropPos, true);
    window.addEventListener("resize", updateDropPos);
    return () => {
      window.removeEventListener("scroll", updateDropPos, true);
      window.removeEventListener("resize", updateDropPos);
    };
  }, [poolOpen, updateDropPos]);

  // Close pool on outside click
  useEffect(() => {
    if (!poolOpen) return;
    const h = (e: MouseEvent) => {
      if (triggerRef.current && triggerRef.current.contains(e.target as Node)) return;
      if (dropRef.current && dropRef.current.contains(e.target as Node)) return;
      setPoolOpen(false);
      setPoolSearch("");
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [poolOpen]);

  // Focus search when pool opens
  useEffect(() => {
    if (poolOpen) setTimeout(() => searchRef.current?.focus(), 80);
  }, [poolOpen]);

  // ── Helpers ───────────────────────────────────────────────────
  const set = useCallback(
    (patch: Record<string, unknown>) => onChange({ ...config, ...patch }),
    [config, onChange]
  );

  const handleToggle = () => {
    const next = !tagsEnabled;
    set({ tagsEnabled: next });
    if (!next) setPoolOpen(false);
  };

  const handleSelectTag = (id: string) => {
    const next = tagIds.includes(id)
      ? tagIds.filter(t => t !== id)
      : [...tagIds, id];
    set({ tagIds: next });
  };

  const handleRemoveFromQuestion = (id: string) => {
    set({ tagIds: tagIds.filter(t => t !== id) });
  };

  const handleCreate = async () => {
    const label = createInput.trim();
    if (!label || isCreatingTag) return;
    const existingTag = pool.find((tag) => !tag.deletedAt && tag.label.trim().toLocaleLowerCase("de-AT") === label.toLocaleLowerCase("de-AT"));
    if (existingTag) {
      set({ tagIds: [...new Set([...tagIds, existingTag.id])] });
      setCreateInput("");
      return;
    }
    setIsCreatingTag(true);
    try {
      const tag = await createPhotoTag(label);
      setPool((prev) => {
        const nextTag = { id: tag.id, label: tag.label, deletedAt: tag.deletedAt ?? undefined };
        return prev.some((item) => item.id === tag.id)
          ? prev.map((item) => (item.id === tag.id ? nextTag : item))
          : [...prev, nextTag];
      });
      set({ tagIds: [...new Set([...tagIds, tag.id])] });
      setCreateInput("");
    } catch {
      // Keep UI stable if backend rejects.
    } finally {
      setIsCreatingTag(false);
    }
  };

  const handleSoftDelete = async (id: string) => {
    if (deletingTagIds[id]) return;
    setDeletingTagIds((prev) => ({ ...prev, [id]: true }));
    try {
      const tag = await updatePhotoTag(id, { deleted: true });
      setPool((prev) =>
        prev.map((t) => (t.id === id ? { ...t, deletedAt: tag.deletedAt ?? new Date().toISOString() } : t)),
      );
    } catch {
      // Keep UI stable if backend rejects.
    } finally {
      setDeletingTagIds((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
  };

  const handleOpenPool = () => {
    if (!poolOpen) {
      updateDropPos();
      setPoolOpen(true);
    } else {
      setPoolOpen(false);
      setPoolSearch("");
    }
  };

  // ── Derived ───────────────────────────────────────────────────
  const visiblePool = activeTagPool(pool).filter(t =>
    !poolSearch.trim() || t.label.toLowerCase().includes(poolSearch.toLowerCase())
  );

  const selectedTags = tagIds.map(id => pool.find(t => t.id === id)).filter(Boolean) as PhotoTagPoolItem[];
  const activeSel   = selectedTags.filter(t => !t.deletedAt);
  const archivedSel = selectedTags.filter(t => !!t.deletedAt);

  // ── Styles ────────────────────────────────────────────────────
  const labelStyle: React.CSSProperties = {
    fontSize: 9,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "rgba(0,0,0,0.35)",
  };

  const inputUnderlineStyle: React.CSSProperties = {
    display: "block",
    width: "100%",
    marginTop: 4,
    fontSize: 11,
    padding: "4px 0",
    border: "none",
    borderBottom: "1px solid rgba(0,0,0,0.08)",
    outline: "none",
    color: "#374151",
    backgroundColor: "transparent",
    fontFamily: "inherit",
  };

  // ── Portal dropdown ───────────────────────────────────────────
  const dropdown = poolOpen && dropPos ? createPortal(
    <div
      ref={dropRef}
      style={{
        position: "fixed",
        top: dropPos.top,
        left: dropPos.left,
        width: dropPos.width,
        background: "#fff",
        borderRadius: 8,
        border: "1px solid rgba(0,0,0,0.09)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.11), 0 1px 4px rgba(0,0,0,0.05)",
        zIndex: 9999,
        overflow: "hidden",
        animation: "ptDropIn 0.14s ease both",
      }}
    >
      <style>{`@keyframes ptDropIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}`}</style>

      {/* Search */}
      <div style={{ padding: "7px 9px", borderBottom: "1px solid rgba(0,0,0,0.05)", display: "flex", alignItems: "center", gap: 6 }}>
        <Search size={10} strokeWidth={2} color="rgba(0,0,0,0.28)" />
        <input
          ref={searchRef}
          type="text"
          placeholder="Tag suchen…"
          value={poolSearch}
          onChange={e => setPoolSearch(e.target.value)}
          style={{ flex: 1, border: "none", outline: "none", fontSize: 10, color: "#374151", background: "transparent", fontFamily: "inherit" }}
        />
        {poolSearch && (
          <button onClick={() => setPoolSearch("")} style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: "rgba(0,0,0,0.25)", display: "flex" }}>
            <X size={9} strokeWidth={2} />
          </button>
        )}
        {visiblePool.length > 0 && (
          <button
            onClick={() => {
              const allIds = visiblePool.map(t => t.id);
              const alreadyAll = allIds.every(id => tagIds.includes(id));
              set({ tagIds: alreadyAll ? tagIds.filter(id => !allIds.includes(id)) : [...new Set([...tagIds, ...allIds])] });
            }}
            style={{
              background: "none", border: "none", cursor: "pointer", padding: 0,
              fontSize: 9, fontWeight: 600, color: accentColor,
              whiteSpace: "nowrap", fontFamily: "inherit", lineHeight: 1,
              opacity: 0.8, transition: "opacity 0.12s ease",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.8"; }}
          >
            {visiblePool.every(t => tagIds.includes(t.id)) ? "Alle entfernen" : "Alle auswählen"}
          </button>
        )}
      </div>

      {/* Tag list */}
      <div style={{ maxHeight: 160, overflowY: "auto" }}>
        {visiblePool.length === 0 && (
          <p style={{ padding: "8px 10px", fontSize: 10, color: "rgba(0,0,0,0.3)", margin: 0, fontStyle: "italic" }}>
            {poolSearch ? "Kein Tag gefunden." : "Noch keine Tags im Pool."}
          </p>
        )}
        {visiblePool.map(tag => {
          const selected = tagIds.includes(tag.id);
          return (
            <div
              key={tag.id}
              style={{
                display: "flex", alignItems: "center",
                padding: "6px 9px", cursor: "pointer",
                background: selected ? `${accentColor}08` : "transparent",
                transition: "background 0.1s ease",
              }}
              onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.background = "rgba(0,0,0,0.025)"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.background = selected ? `${accentColor}08` : "transparent"; }}
              onClick={() => handleSelectTag(tag.id)}
            >
              <span style={{
                width: 7, height: 7, borderRadius: "50%", flexShrink: 0, marginRight: 7,
                background: selected ? accentColor : "rgba(0,0,0,0.12)",
                transition: "background 0.12s ease",
              }} />
              <span style={{
                flex: 1, fontSize: 10, fontWeight: selected ? 600 : 400,
                color: selected ? accentColor : "#374151",
                transition: "color 0.12s ease",
              }}>
                {tag.label}
              </span>
              <button
                onClick={e => { e.stopPropagation(); handleSoftDelete(tag.id); }}
                disabled={Boolean(deletingTagIds[tag.id])}
                title="Tag aus Pool entfernen"
                style={{ display: "flex", background: "none", border: "none", cursor: deletingTagIds[tag.id] ? "not-allowed" : "pointer", padding: 2, color: deletingTagIds[tag.id] ? "rgba(0,0,0,0.3)" : "rgba(0,0,0,0.2)", borderRadius: 4, transition: "all 0.12s ease", marginLeft: 4 }}
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = "#ef4444"; (e.currentTarget as HTMLButtonElement).style.background = "rgba(239,68,68,0.07)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,0,0,0.2)"; (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
              >
                <Trash2 size={9} strokeWidth={2} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Create new tag */}
      <div style={{ borderTop: "1px solid rgba(0,0,0,0.05)", padding: "6px 9px", display: "flex", alignItems: "center", gap: 6 }}>
        <Plus size={10} strokeWidth={2.5} color="rgba(0,0,0,0.3)" />
        <input
          type="text"
          placeholder="Neuen Tag anlegen…"
          value={createInput}
          onChange={e => setCreateInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); handleCreate(); } }}
          style={{ flex: 1, border: "none", outline: "none", fontSize: 10, color: "#374151", background: "transparent", fontFamily: "inherit" }}
        />
        {createInput.trim() && (
          <button
            onClick={handleCreate}
            disabled={isCreatingTag}
            style={{
              padding: "2px 7px", borderRadius: 4, border: "none", cursor: "pointer",
              fontSize: 9, fontWeight: 700, color: "#fff",
              background: accentColor,
              boxShadow: "0 1px 3px rgba(0,0,0,0.14)",
              transition: "opacity 0.12s ease",
              fontFamily: "inherit",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.85"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
          >
            {isCreatingTag ? "Erstellen..." : "Erstellen"}
          </button>
        )}
      </div>
    </div>,
    document.body
  ) : null;

  return (
    <div style={{ marginTop: 10 }}>
      {/* Anweisung */}
      <span style={labelStyle}>Anweisung</span>
      <input
        type="text"
        value={instruction}
        onChange={e => set({ instruction: e.target.value })}
        placeholder="z.B. Foto vom Display aufnehmen"
        style={inputUnderlineStyle}
      />

      {/* Tags section */}
      <div style={{ marginTop: 12 }}>
        {/* Toggle row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={labelStyle}>Tags</span>
          <button
            onClick={handleToggle}
            title={tagsEnabled ? "Tags deaktivieren" : "Tags aktivieren"}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 5,
              padding: "2px 8px 2px 4px",
              borderRadius: 20,
              border: "1px solid rgba(0,0,0,0.1)",
              background: tagsEnabled ? `${accentColor}10` : "transparent",
              cursor: "pointer",
              transition: "all 0.18s ease",
              fontSize: 9,
              fontWeight: 600,
              color: tagsEnabled ? accentColor : "rgba(0,0,0,0.38)",
              letterSpacing: "0.02em",
            }}
            onMouseEnter={e => { if (!tagsEnabled) (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.04)"; }}
            onMouseLeave={e => { if (!tagsEnabled) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
          >
            <span style={{
              display: "inline-block",
              width: 22, height: 13, borderRadius: 7,
              background: tagsEnabled ? accentColor : "rgba(0,0,0,0.12)",
              position: "relative",
              transition: "background 0.18s ease",
              flexShrink: 0,
            }}>
              <span style={{
                position: "absolute",
                top: 2,
                left: tagsEnabled ? 11 : 2,
                width: 9, height: 9, borderRadius: "50%",
                background: "#fff",
                boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                transition: "left 0.18s ease",
              }} />
            </span>
            {tagsEnabled ? "Aktiv" : "Inaktiv"}
          </button>
        </div>

        {/* Expanded tag body */}
        <div style={{
          maxHeight: expanded ? 400 : 0,
          opacity: expanded ? 1 : 0,
          overflow: "hidden",
          transition: "max-height 0.24s cubic-bezier(0.4,0,0.2,1), opacity 0.18s ease",
        }}>
          <div style={{
            marginTop: 8,
            padding: "10px",
            borderRadius: 8,
            background: "rgba(0,0,0,0.025)",
            border: "1px solid rgba(0,0,0,0.06)",
            transform: expanded ? "translateY(0)" : "translateY(4px)",
            transition: "transform 0.22s cubic-bezier(0.4,0,0.2,1)",
          }}>

            {/* Selected active tags */}
            {(activeSel.length > 0 || archivedSel.length > 0) && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
                {activeSel.map(tag => (
                  <span
                    key={tag.id}
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 8px", borderRadius: 20,
                      background: `${accentColor}12`,
                      border: `1px solid ${accentColor}28`,
                      fontSize: 10, fontWeight: 600, color: accentColor,
                      transition: "all 0.12s ease",
                    }}
                  >
                    {tag.label}
                    <button
                      onClick={() => handleRemoveFromQuestion(tag.id)}
                      style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0, color: `${accentColor}80`, lineHeight: 1, transition: "color 0.12s ease" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = accentColor; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = `${accentColor}80`; }}
                    >
                      <X size={9} strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
                {archivedSel.map(tag => (
                  <span
                    key={tag.id}
                    title="Tag wurde aus dem Pool entfernt"
                    style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 8px", borderRadius: 20,
                      background: "rgba(0,0,0,0.04)",
                      border: "1px solid rgba(0,0,0,0.09)",
                      fontSize: 10, fontWeight: 500, color: "rgba(0,0,0,0.32)",
                      textDecoration: "line-through",
                    }}
                  >
                    {tag.label}
                    <button
                      onClick={() => handleRemoveFromQuestion(tag.id)}
                      style={{ display: "flex", background: "none", border: "none", cursor: "pointer", padding: 0, color: "rgba(0,0,0,0.25)", lineHeight: 1 }}
                    >
                      <X size={9} strokeWidth={2.5} />
                    </button>
                  </span>
                ))}
              </div>
            )}

            {selectedTags.length === 0 && (
              <p style={{ fontSize: 10, color: "rgba(0,0,0,0.28)", margin: "0 0 8px", fontStyle: "italic" }}>
                Noch keine Tags für diese Frage gewählt.
              </p>
            )}

            {/* Pool trigger */}
            <button
              ref={triggerRef}
              onClick={handleOpenPool}
              style={{
                display: "flex", alignItems: "center", gap: 5,
                fontSize: 10, fontWeight: 600,
                color: poolOpen ? accentColor : "rgba(0,0,0,0.45)",
                background: poolOpen ? `${accentColor}08` : "rgba(0,0,0,0.03)",
                border: `1px solid ${poolOpen ? accentColor + "30" : "rgba(0,0,0,0.08)"}`,
                borderRadius: 6,
                padding: "4px 9px",
                cursor: "pointer",
                transition: "all 0.15s ease",
                fontFamily: "inherit",
                width: "100%",
                justifyContent: "flex-start",
              }}
              onMouseEnter={e => { if (!poolOpen) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.05)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,0,0,0.6)"; }}}
              onMouseLeave={e => { if (!poolOpen) { (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,0,0,0.03)"; (e.currentTarget as HTMLButtonElement).style.color = "rgba(0,0,0,0.45)"; }}}
            >
              <Search size={10} strokeWidth={2} />
              Tags aus Pool wählen
              {activeTagPool(pool).length > 0 && (
                <span style={{ marginLeft: "auto", fontSize: 9, color: "rgba(0,0,0,0.28)", fontWeight: 400 }}>
                  {activeTagPool(pool).length} verfügbar
                </span>
              )}
            </button>

            {/* Portal dropdown rendered at body level */}
            {dropdown}
          </div>
        </div>
      </div>
    </div>
  );
}
