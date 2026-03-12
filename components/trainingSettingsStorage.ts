import type { ModuleType } from "./trainingStorage";

export type ChunkMode =
  | "1단어씩"
  | "2단어씩"
  | "3단어씩"
  | "4단어씩"
  | "전체 문장 읽기";

export interface TrainingModuleSettings {
  clientName: string;
  sessionNote: string;
  practiceText: string;
  targetSps: number;
  chunkMode: ChunkMode;
  pauseSec: number;
  displayFontSize: number;
  selectedPresetId: string | null;
}

function isBrowser() {
  return typeof window !== "undefined";
}

function getSettingsKey(moduleType: ModuleType) {
  return `pd-training-settings-${moduleType}`;
}

export function loadTrainingSettings(
  moduleType: ModuleType,
  fallback: TrainingModuleSettings
): TrainingModuleSettings {
  if (!isBrowser()) return fallback;

  try {
    const raw = localStorage.getItem(getSettingsKey(moduleType));
    if (!raw) return fallback;

    const parsed = JSON.parse(raw);

    return {
      clientName:
        typeof parsed.clientName === "string"
          ? parsed.clientName
          : fallback.clientName,
      sessionNote:
        typeof parsed.sessionNote === "string"
          ? parsed.sessionNote
          : fallback.sessionNote,
      practiceText:
        typeof parsed.practiceText === "string"
          ? parsed.practiceText
          : fallback.practiceText,
      targetSps:
        typeof parsed.targetSps === "number"
          ? parsed.targetSps
          : fallback.targetSps,
      chunkMode:
        typeof parsed.chunkMode === "string"
          ? parsed.chunkMode
          : fallback.chunkMode,
      pauseSec:
        typeof parsed.pauseSec === "number"
          ? parsed.pauseSec
          : fallback.pauseSec,
      displayFontSize:
        typeof parsed.displayFontSize === "number"
          ? parsed.displayFontSize
          : fallback.displayFontSize,
      selectedPresetId:
        typeof parsed.selectedPresetId === "string" || parsed.selectedPresetId === null
          ? parsed.selectedPresetId
          : fallback.selectedPresetId,
    };
  } catch (error) {
    console.error("설정 불러오기 실패:", error);
    return fallback;
  }
}

export function saveTrainingSettings(
  moduleType: ModuleType,
  settings: TrainingModuleSettings
) {
  if (!isBrowser()) return;

  try {
    localStorage.setItem(getSettingsKey(moduleType), JSON.stringify(settings));
  } catch (error) {
    console.error("설정 저장 실패:", error);
  }
}

export function clearTrainingSettings(moduleType: ModuleType) {
  if (!isBrowser()) return;

  try {
    localStorage.removeItem(getSettingsKey(moduleType));
  } catch (error) {
    console.error("설정 초기화 실패:", error);
  }
}