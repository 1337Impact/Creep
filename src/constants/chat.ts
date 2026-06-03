import {
  CHAT_MODELS,
  getModelById,
} from "@/ai/models";
import type { ChatModel, ChatTab } from "@/types/chat";

export { CHAT_MODELS, getModelById };

export const DEFAULT_MODEL: ChatModel = CHAT_MODELS[1];

export const CHAT_MAX_TABS = 3;

export const FLOATING_BUTTON_Y_OFFSET = 100;

export const CHAT_DEFAULT_SIZE = { width: 384, height: 600 };
export const CHAT_MIN_SIZE = { width: 300, height: 400 };
export const CHAT_MAX_SIZE = { width: 1024, height: 900 };

export const CHAT_STORAGE_PREFIX = "chat_";

export const PAGE_CONTENT_MAX_CHARS = 10000;

export const SELECTION_PREVIEW_LENGTH = 50;
export const SELECTION_QUESTION_PREVIEW_LENGTH = 30;
export const SELECTED_TEXT_CHIP_PREVIEW_LENGTH = 40;

const FUNNY_TAB_NAMES = [
  "Zibble",
  "Flompy",
  "Glorp",
  "Snizzle",
  "Blarbo",
  "Womple",
  "Boingo",
  "Tinko",
  "Plompy",
  "Snorko",
  "Xarlo",
  "Vreeb",
  "Quorp",
  "Zarnox",
  "Vloppo",
  "Dreeko",
  "Klarn",
  "Noovo",
  "Zyggo",
  "Plix",
  "Mippo",
  "Luli",
  "Poffi",
  "Nunu",
  "Zuzu",
  "Piplo",
  "Momozi",
  "Fluffo",
  "Titiroo",
  "Kikiro",
];

export function getChatStorageKey(url: string = window.location.href): string {
  return `${CHAT_STORAGE_PREFIX}${btoa(url).slice(0, 50)}`;
}

export function isChatStorageKey(key: string): boolean {
  return key.startsWith(CHAT_STORAGE_PREFIX);
}

export function getPageHost(url: string = window.location.href): string {
  try {
    return new URL(url).host;
  } catch {
    return window.location.host;
  }
}

export function getRandomUnusedTabName(usedNames: string[]): string {
  const availableNames = FUNNY_TAB_NAMES.filter((name) => !usedNames.includes(name));
  if (availableNames.length === 0) {
    return `Chat ${usedNames.length + 1}`;
  }
  return availableNames[Math.floor(Math.random() * availableNames.length)];
}

export function getInitialGreeting(name: string): string {
  return `Hello, I'm ${name}, here to help...`;
}

export function createInitialTab(): ChatTab {
  const name = getRandomUnusedTabName([]);
  return {
    id: Date.now().toString(),
    name,
    messages: [{ text: getInitialGreeting(name), role: "model" }],
    history: [],
    modelId: DEFAULT_MODEL.id,
    host: getPageHost(),
  };
}

export type { ChatModel };
