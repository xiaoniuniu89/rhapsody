export interface SystemBrief {
  id: string;
  title: string;
  version: string;
  actorTypes: string[];
  itemTypes: string[];
  packs: PackSummary[];
}

export interface PackSummary {
  id: string;
  label: string;
  type: string;
  size: number;
}

export interface SceneBrief {
  id: string;
  name: string;
  active: boolean;
  regions: RegionSummary[];
}

export interface RegionSummary {
  id: string;
  name: string;
  shapeCount: number;
  behaviorCount: number;
}

export class IntrospectionService {
  private _system: SystemBrief | null = null;

  init(): SystemBrief {
    // @ts-ignore — foundry global, V13 types are partial
    const sys: any = game.system;
    // @ts-ignore
    const model: any = game.model ?? {};
    const actorTypes = Object.keys(model.Actor ?? {}).filter(
      (t) => t !== "base",
    );
    const itemTypes = Object.keys(model.Item ?? {}).filter(
      (t) => t !== "base",
    );

    // @ts-ignore
    const packs: PackSummary[] = [...game.packs.values()].map((p: any) => ({
      id: p.collection,
      label: p.metadata?.label ?? p.collection,
      type: p.metadata?.type ?? "unknown",
      size: p.index?.size ?? 0,
    }));

    this._system = {
      id: sys?.id ?? "unknown",
      title: sys?.title ?? "",
      version: sys?.version ?? "",
      actorTypes,
      itemTypes,
      packs,
    };
    return this._system;
  }

  get system(): SystemBrief | null {
    return this._system;
  }

  briefScene(sceneId?: string): SceneBrief | null {
    // @ts-ignore
    const scene = sceneId ? game.scenes.get(sceneId) : game.scenes.active;
    if (!scene) return null;

    // @ts-ignore — V14 Scene Regions
    const regionCollection = scene.regions ?? new Map();
    const regions: RegionSummary[] = [...regionCollection.values()].map(
      (r: any) => ({
        id: r.id,
        name: r.name ?? "",
        shapeCount: Array.isArray(r.shapes) ? r.shapes.length : 0,
        behaviorCount: r.behaviors?.size ?? 0,
      }),
    );

    return {
      id: scene.id,
      name: scene.name,
      active: !!scene.active,
      regions,
    };
  }
}
