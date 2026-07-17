"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { v4 as uuidv4 } from "uuid";

import type { DebugLogEntry } from "@/lib/types";

interface StartLogEntry {
  endpoint: string;
  request: unknown;
  systemPrompt?: string;
  userPrompt?: string;
}

interface UpdateLogEntry {
  response?: unknown | null;
  error?: string;
  status?: DebugLogEntry["status"];
  event?: string;
  systemPrompt?: string;
  userPrompt?: string;
}

interface DebugContextValue {
  logs: DebugLogEntry[];
  startLog: (entry: StartLogEntry) => string;
  updateLog: (id: string, update: UpdateLogEntry) => void;
  addLog: (entry: Omit<DebugLogEntry, "id" | "timestamp" | "status" | "events"> & {
    status?: DebugLogEntry["status"];
    events?: DebugLogEntry["events"];
  }) => void;
  clearLogs: () => void;
}

const DebugContext = createContext<DebugContextValue | null>(null);

function createLogEntry(
  entry: StartLogEntry & {
    status?: DebugLogEntry["status"];
    response?: unknown | null;
    error?: string;
    events?: DebugLogEntry["events"];
  },
  id?: string,
): DebugLogEntry {
  return {
    id: id ?? uuidv4(),
    timestamp: new Date().toISOString(),
    endpoint: entry.endpoint,
    request: entry.request,
    response: entry.response ?? null,
    error: entry.error,
    status: entry.status ?? "success",
    events: entry.events ?? [],
    systemPrompt: entry.systemPrompt,
    userPrompt: entry.userPrompt,
  };
}

export function DebugProvider({ children }: { children: ReactNode }) {
  const [logs, setLogs] = useState<DebugLogEntry[]>([]);

  const startLog = useCallback((entry: StartLogEntry): string => {
    const id = uuidv4();
    const log = createLogEntry(
      {
        ...entry,
        status: "pending",
        events: [{ timestamp: new Date().toISOString(), message: "Request sent" }],
      },
      id,
    );

    setLogs((prev) => [log, ...prev]);
    return id;
  }, []);

  const updateLog = useCallback((id: string, update: UpdateLogEntry) => {
    setLogs((prev) =>
      prev.map((log) => {
        if (log.id !== id) return log;

        const events = update.event
          ? [
              ...log.events,
              { timestamp: new Date().toISOString(), message: update.event },
            ]
          : log.events;

        return {
          ...log,
          response: update.response !== undefined ? update.response : log.response,
          error: update.error !== undefined ? update.error : log.error,
          status: update.status ?? log.status,
          systemPrompt: update.systemPrompt ?? log.systemPrompt,
          userPrompt: update.userPrompt ?? log.userPrompt,
          events,
        };
      }),
    );
  }, []);

  const addLog = useCallback(
    (
      entry: Omit<DebugLogEntry, "id" | "timestamp" | "status" | "events"> & {
        status?: DebugLogEntry["status"];
        events?: DebugLogEntry["events"];
      },
    ) => {
      setLogs((prev) => [createLogEntry(entry), ...prev]);
    },
    [],
  );

  const clearLogs = useCallback(() => setLogs([]), []);

  const value = useMemo(
    () => ({ logs, startLog, updateLog, addLog, clearLogs }),
    [logs, startLog, updateLog, addLog, clearLogs],
  );

  return (
    <DebugContext.Provider value={value}>{children}</DebugContext.Provider>
  );
}

export function useDebug() {
  const ctx = useContext(DebugContext);
  if (!ctx) throw new Error("useDebug must be used within DebugProvider");
  return ctx;
}

export async function apiCall<T>(
  endpoint: string,
  body: unknown,
  debug: Pick<DebugContextValue, "startLog" | "updateLog">,
  options?: { systemPrompt?: string; userPrompt?: string },
): Promise<T> {
  const logId = debug.startLog({
    endpoint,
    request: body,
    systemPrompt: options?.systemPrompt,
    userPrompt: options?.userPrompt,
  });
  let handled = false;

  try {
    debug.updateLog(logId, { event: "Waiting for server response..." });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    debug.updateLog(logId, {
      event: `Received HTTP ${response.status}`,
    });

    let data: Record<string, unknown> = {};
    const responseText = await response.text();

    try {
      data = responseText ? (JSON.parse(responseText) as Record<string, unknown>) : {};
    } catch {
      console.error(`[apiCall] ${endpoint} returned non-JSON response (${response.status}):`, responseText);
      handled = true;
      debug.updateLog(logId, {
        status: "error",
        error: `Server returned invalid JSON (${response.status})`,
        response: responseText,
        event: "Failed to parse response JSON",
      });
      throw new Error(`Server returned invalid JSON (${response.status})`);
    }

    if (!response.ok) {
      const errorMessage =
        typeof data.error === "string" ? data.error : "Request failed";
      console.error(`[apiCall] ${endpoint} failed (${response.status}):`, {
        error: errorMessage,
        response: data,
      });

      handled = true;
      debug.updateLog(logId, {
        status: "error",
        response: data,
        error: errorMessage,
        event: `Request failed: ${errorMessage}`,
      });

      throw new Error(errorMessage);
    }

    debug.updateLog(logId, {
      status: "success",
      response: data,
      event: "Request completed successfully",
      systemPrompt:
        typeof (data as { debug?: { systemPrompt?: string } }).debug
          ?.systemPrompt === "string"
          ? (data as { debug: { systemPrompt: string } }).debug.systemPrompt
          : undefined,
      userPrompt:
        typeof (data as { debug?: { userPrompt?: string } }).debug
          ?.userPrompt === "string"
          ? (data as { debug: { userPrompt: string } }).debug.userPrompt
          : undefined,
    });

    return data as T;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[apiCall] ${endpoint} error:`, error);

    if (!handled) {
      debug.updateLog(logId, {
        status: "error",
        error: message,
        event: `Error: ${message}`,
      });
    }

    throw error;
  }
}
