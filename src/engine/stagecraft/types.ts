export type LightingPreset = "day" | "dusk" | "night" | "torchlit" | "dark";

export class AssetNotFoundError extends Error {
  constructor(kind: string, query: string) {
    super(`No ${kind} found matching "${query}"`);
    this.name = "AssetNotFoundError";
  }
}

export class StagecraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StagecraftError";
  }
}
