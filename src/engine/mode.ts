import { id as moduleId } from "../../module.json";

export type RhapsodyMode = "play" | "prep";

export function getMode(): RhapsodyMode {
  // @ts-ignore
  return game.settings.get(moduleId, "rhapsodyMode") as RhapsodyMode;
}

export function getPlayModel(): string {
  // @ts-ignore
  return game.settings.get(moduleId, "openaiModel") as string;
}

export function getPrepModel(): string {
  // @ts-ignore
  return game.settings.get(moduleId, "openaiPrepModel") as string;
}
