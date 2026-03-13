"use client";

import { getCurrentSession } from "@/components/currentSessionStorage";
import type { TrainingModuleSettings } from "./trainingSettingsStorage";

export function mergeWithCurrentSession(
  saved: TrainingModuleSettings
): TrainingModuleSettings {
  const current = getCurrentSession();

  return {
    ...saved,
    clientName: current.clientName ?? "",
    sessionNote: current.sessionNote ?? "",
  };
}