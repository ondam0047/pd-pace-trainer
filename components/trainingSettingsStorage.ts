export type ChunkMode =
  | "1단어씩"
  | "2단어씩"
  | "3단어씩"
  | "4단어씩"
  | "전체 문장 읽기";

export type TrainingModule = "visual" | "audio" | "mixed";

export type TrainingModuleSettings = {
  clientName: string;
  sessionNote: string;
  practiceText: string;
  selectedPresetId: string | null;
  targetSps: number;
  chunkMode: ChunkMode;
  pauseSec: number;
  displayFontSize: number;
};

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeName(name: string) {
  return (name ?? "").trim();
}

function getLegacyKey(moduleType: TrainingModule) {
  return `pd-training-settings-${moduleType}`;
}

function getNamedKey(moduleType: TrainingModule, clientName: string) {
  return `pd-training-settings-${moduleType}::${normalizeName(clientName)}`;
}

function safeParse<T>(raw: string | null): T | null {
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function sanitizeSettings(
  input: Partial<TrainingModuleSettings> | null | undefined,
  fallback: TrainingModuleSettings
): TrainingModuleSettings {
  return {
    clientName:
      typeof input?.clientName === "string"
        ? input.clientName
        : fallback.clientName,
    sessionNote:
      typeof input?.sessionNote === "string"
        ? input.sessionNote
        : fallback.sessionNote,
    practiceText:
      typeof input?.practiceText === "string"
        ? input.practiceText
        : fallback.practiceText,
    selectedPresetId:
      typeof input?.selectedPresetId === "string" || input?.selectedPresetId === null
        ? input.selectedPresetId
        : fallback.selectedPresetId,
    targetSps:
      typeof input?.targetSps === "number" && Number.isFinite(input.targetSps)
        ? input.targetSps
        : fallback.targetSps,
    chunkMode:
      input?.chunkMode === "1단어씩" ||
      input?.chunkMode === "2단어씩" ||
      input?.chunkMode === "3단어씩" ||
      input?.chunkMode === "4단어씩" ||
      input?.chunkMode === "전체 문장 읽기"
        ? input.chunkMode
        : fallback.chunkMode,
    pauseSec:
      typeof input?.pauseSec === "number" && Number.isFinite(input.pauseSec)
        ? input.pauseSec
        : fallback.pauseSec,
    displayFontSize:
      typeof input?.displayFontSize === "number" &&
      Number.isFinite(input.displayFontSize)
        ? input.displayFontSize
        : fallback.displayFontSize,
  };
}

export function loadTrainingSettings(
  moduleType: TrainingModule,
  fallback: TrainingModuleSettings,
  clientName?: string
): TrainingModuleSettings {
  if (!isBrowser()) return fallback;

  const normalizedName = normalizeName(clientName ?? "");

  if (normalizedName) {
    const namedRaw = window.localStorage.getItem(getNamedKey(moduleType, normalizedName));
    const namedParsed = safeParse<Partial<TrainingModuleSettings>>(namedRaw);

    if (namedParsed) {
      return sanitizeSettings(namedParsed, {
        ...fallback,
        clientName: normalizedName,
      });
    }
  }

  const legacyRaw = window.localStorage.getItem(getLegacyKey(moduleType));
  const legacyParsed = safeParse<Partial<TrainingModuleSettings>>(legacyRaw);

  if (legacyParsed) {
    return sanitizeSettings(legacyParsed, fallback);
  }

  return fallback;
}

export function saveTrainingSettings(
  moduleType: TrainingModule,
  settings: TrainingModuleSettings
) {
  if (!isBrowser()) return;

  const normalizedName = normalizeName(settings.clientName);

  if (normalizedName) {
    const nextSettings: TrainingModuleSettings = {
      ...settings,
      clientName: normalizedName,
    };

    window.localStorage.setItem(
      getNamedKey(moduleType, normalizedName),
      JSON.stringify(nextSettings)
    );
  } else {
    window.localStorage.setItem(
      getLegacyKey(moduleType),
      JSON.stringify(settings)
    );
  }
}

export function clearTrainingSettings(
  moduleType: TrainingModule,
  clientName?: string
) {
  if (!isBrowser()) return;

  const normalizedName = normalizeName(clientName ?? "");

  if (normalizedName) {
    window.localStorage.removeItem(getNamedKey(moduleType, normalizedName));
    return;
  }

  window.localStorage.removeItem(getLegacyKey(moduleType));
}