"use client";

import { useEffect, useRef, useState } from "react";

import { useDebug } from "@/lib/debug/context";

/** Strip fields already shown elsewhere; prefer raw LLM analysis when present. */
function sanitizeDebugResponse(response: unknown): unknown {
  if (response == null || typeof response !== "object" || Array.isArray(response)) {
    return response;
  }

  const record = { ...(response as Record<string, unknown>) };
  const llmAnalysis = record.llmAnalysis;
  delete record.model;
  delete record.debug;
  delete record.llmAnalysis;

  if (llmAnalysis != null) {
    return { analysis: llmAnalysis };
  }

  return record;
}

function formatPayloadSize(value: unknown): string {
  const text =
    typeof value === "string"
      ? value
      : value == null
        ? ""
        : JSON.stringify(value);
  const bytes = new TextEncoder().encode(text).length;
  const chars = text.length;
  if (bytes < 1024) {
    return `${chars.toLocaleString()} chars · ${bytes} B`;
  }
  return `${chars.toLocaleString()} chars · ${(bytes / 1024).toFixed(1)} KB`;
}

function statusLabel(status: string, error?: string) {
  switch (status) {
    case "pending":
      return "running";
    case "error":
      return error ? "error" : "error";
    default:
      return "ok";
  }
}

function statusColor(status: string) {
  switch (status) {
    case "pending":
      return "text-amber-400";
    case "error":
      return "text-red-400";
    default:
      return "text-emerald-400";
  }
}

export function DebugPanel() {
  const { logs, clearLogs } = useDebug();
  const [open, setOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const pendingCount = logs.filter((log) => log.status === "pending").length;

  useEffect(() => {
    if (open && scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [logs, open]);

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target)) return;
      if (toggleRef.current?.contains(target)) return;
      setOpen(false);
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  return (
    <>
      {open && <div className="fixed inset-0 z-40" aria-hidden="true" />}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
        {open && (
          <div
            ref={panelRef}
            className="w-[min(90vw,520px)] max-h-[60vh] overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-700 px-4 py-2">
              <span className="text-sm font-medium text-zinc-200">
                AI Debug Log ({logs.length}
                {pendingCount > 0 ? `, ${pendingCount} running` : ""})
              </span>
              <button
                type="button"
                onClick={clearLogs}
                className="text-xs text-zinc-400 hover:text-zinc-200"
              >
                Clear
              </button>
            </div>
            <div
              ref={scrollRef}
              className="overflow-y-auto max-h-[calc(60vh-40px)] p-2 space-y-2"
            >
              {logs.length === 0 && (
                <p className="text-xs text-zinc-500 p-2">No requests yet.</p>
              )}
              {logs.map((log) => {
                const isExpanded = expandedId === log.id;
                const isPending = log.status === "pending";

                return (
                  <div
                    key={log.id}
                    className={`rounded border text-xs ${
                      isPending
                        ? "border-amber-600/50 bg-zinc-800 animate-pulse"
                        : "border-zinc-700 bg-zinc-800"
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full px-3 py-2 text-left flex items-center justify-between hover:bg-zinc-750"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : log.id)
                      }
                    >
                      <span className="text-zinc-300 truncate flex items-center gap-2">
                        {isPending && (
                          <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-ping" />
                        )}
                        {log.endpoint.replace("/api/", "")}
                      </span>
                      <span className={statusColor(log.status)}>
                        {statusLabel(log.status, log.error)}
                      </span>
                    </button>
                    {isExpanded && (
                      <div className="border-t border-zinc-700 p-3 space-y-2">
                        <p className="text-zinc-500">{log.timestamp}</p>

                        {log.events.length > 0 && (
                          <div>
                            <p className="text-zinc-400 mb-1">Timeline:</p>
                            <ul className="space-y-1">
                              {log.events.map((event, index) => (
                                <li
                                  key={`${event.timestamp}-${index}`}
                                  className="text-zinc-300 flex gap-2"
                                >
                                  <span className="text-zinc-500 shrink-0">
                                    {new Date(event.timestamp).toLocaleTimeString()}
                                  </span>
                                  <span>{event.message}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {log.error && (
                          <p className="text-red-400">{log.error}</p>
                        )}
                        {log.systemPrompt && (
                          <div>
                            <p className="text-zinc-400 mb-1">
                              System prompt{" "}
                              <span className="text-zinc-500">
                                ({formatPayloadSize(log.systemPrompt)})
                              </span>
                            </p>
                            <pre className="overflow-x-auto rounded bg-zinc-950 p-2 text-zinc-300 max-h-40 whitespace-pre-wrap">
                              {log.systemPrompt}
                            </pre>
                          </div>
                        )}
                        {log.userPrompt && (
                          <div>
                            <p className="text-zinc-400 mb-1">
                              User message{" "}
                              <span className="text-zinc-500">
                                ({formatPayloadSize(log.userPrompt)})
                              </span>
                            </p>
                            <pre className="overflow-x-auto rounded bg-zinc-950 p-2 text-zinc-300 max-h-48 whitespace-pre-wrap">
                              {log.userPrompt}
                            </pre>
                          </div>
                        )}
                        <div>
                          <p className="text-zinc-400 mb-1">
                            Response{" "}
                            <span className="text-zinc-500">
                              (
                              {log.response != null
                                ? formatPayloadSize(
                                    sanitizeDebugResponse(log.response),
                                  )
                                : isPending
                                  ? "…"
                                  : "0 B"}
                              )
                            </span>
                          </p>
                          <pre className="overflow-x-auto rounded bg-zinc-950 p-2 text-zinc-300 max-h-48">
                            {log.response != null
                              ? JSON.stringify(
                                  sanitizeDebugResponse(log.response),
                                  null,
                                  2,
                                )
                              : isPending
                                ? "Waiting..."
                                : "null"}
                          </pre>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        <button
          ref={toggleRef}
          type="button"
          onClick={() => setOpen(!open)}
          className="rounded-full bg-zinc-800 border border-zinc-600 px-4 py-2 text-sm text-zinc-200 shadow-lg hover:bg-zinc-700 transition-colors flex items-center gap-2"
        >
          {pendingCount > 0 && (
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-ping" />
          )}
          {open ? "Hide" : "Show"} AI Debug
        </button>
      </div>
    </>
  );
}
