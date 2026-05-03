export type AssetKind = "map" | "audio" | "token";

export interface AssetItem {
  id: string; // Foundry id (Scene/Actor) or pack-qualified path
  kind: AssetKind;
  name: string; // human label
  path: string; // file path or asset ref
  tags: string[];
}

export interface AssetIndex {
  version: number;
  builtAt: number;
  maps: AssetItem[];
  audio: AssetItem[];
  tokens: AssetItem[];
}
