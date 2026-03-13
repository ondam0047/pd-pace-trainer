"use client";

import { useEffect } from "react";
import { getCurrentSession } from "@/components/currentSessionStorage";

type Params = {
  hasLoadedSettings: boolean;
  clientName: string;
  sessionNote: string;
  setClientName: (value: string) => void;
  setSessionNote: (value: string) => void;
};

export function useCurrentSessionDefaults({
  hasLoadedSettings,
  clientName,
  sessionNote,
  setClientName,
  setSessionNote,
}: Params) {
  useEffect(() => {
    if (!hasLoadedSettings) return;

    const current = getCurrentSession();

    if (!clientName.trim() && current.clientName.trim()) {
      setClientName(current.clientName);
    }

    if (!sessionNote.trim() && current.sessionNote.trim()) {
      setSessionNote(current.sessionNote);
    }
  }, [
    hasLoadedSettings,
    clientName,
    sessionNote,
    setClientName,
    setSessionNote,
  ]);
}