export type CustomPreset = {
  id: string;
  label: string;
  text: string;
};

const STORAGE_KEY = "pd-client-presets";

function isBrowser() {
  return typeof window !== "undefined";
}

function normalizeClientName(name: string) {
  return (name ?? "").trim();
}

function createDefaultPresets(): CustomPreset[] {
  return [
    {
      id: crypto.randomUUID(),
      label: "기본 문구 1",
      text: "오늘은 천천히 또박또박 말해 볼게요.",
    },
    {
      id: crypto.randomUUID(),
      label: "기본 문구 2",
      text: "잠깐만요. 제가 천천히 다시 말해 볼게요.",
    },
    {
      id: crypto.randomUUID(),
      label: "기본 문구 3",
      text: "물 한 잔 좀 주세요. 지금 목이 좀 말라요.",
    },
    {
      id: crypto.randomUUID(),
      label: "기본 문구 4",
      text: "여보세요. 저 지금 가는 중이에요. 조금만 기다려 주세요.",
    },
  ];
}

function safeParse(raw: string | null): Record<string, CustomPreset[]> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function readAllPresets(): Record<string, CustomPreset[]> {
  if (!isBrowser()) return {};
  return safeParse(window.localStorage.getItem(STORAGE_KEY));
}

function writeAllPresets(data: Record<string, CustomPreset[]>) {
  if (!isBrowser()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function loadClientPresets(clientName: string): CustomPreset[] {
  const normalizedName = normalizeClientName(clientName);
  if (!normalizedName) return createDefaultPresets();

  const all = readAllPresets();
  const presets = all[normalizedName];

  if (!Array.isArray(presets) || presets.length === 0) {
    return createDefaultPresets();
  }

  return presets.map((preset) => ({
    id: String(preset.id ?? crypto.randomUUID()),
    label: String(preset.label ?? "preset"),
    text: String(preset.text ?? ""),
  }));
}

export function saveClientPresets(clientName: string, presets: CustomPreset[]) {
  const normalizedName = normalizeClientName(clientName);
  if (!normalizedName || !isBrowser()) return;

  const all = readAllPresets();
  all[normalizedName] = presets.map((preset) => ({
    id: String(preset.id ?? crypto.randomUUID()),
    label: String(preset.label ?? "preset"),
    text: String(preset.text ?? ""),
  }));
  writeAllPresets(all);
}

export function resetClientPresets(clientName: string) {
  const normalizedName = normalizeClientName(clientName);
  if (!normalizedName || !isBrowser()) return;

  const all = readAllPresets();
  delete all[normalizedName];
  writeAllPresets(all);
}

export function upsertClientPreset(
  clientName: string,
  preset: CustomPreset
): CustomPreset[] {
  const current = loadClientPresets(clientName);
  const exists = current.some((item) => item.id === preset.id);

  const next = exists
    ? current.map((item) => (item.id === preset.id ? preset : item))
    : [...current, preset];

  saveClientPresets(clientName, next);
  return next;
}

export function deleteClientPreset(
  clientName: string,
  presetId: string
): CustomPreset[] {
  const current = loadClientPresets(clientName);
  const next = current.filter((item) => item.id !== presetId);
  saveClientPresets(clientName, next);
  return next;
}