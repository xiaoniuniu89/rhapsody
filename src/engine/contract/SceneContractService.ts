// src/engine/contract/SceneContractService.ts
import { id as moduleId } from "../../../module.json";
import type { SceneContract, ContractProgress } from "./types";

export class SceneContractService {
  /**
   * Returns the contract for the currently viewed scene.
   */
  active(): { sceneId: string; contract: SceneContract } | null {
    // @ts-ignore
    const scene = game.scenes.viewed;
    if (!scene) return null;

    const contract = this.read(scene.id);
    if (!contract) return null;

    return { sceneId: scene.id, contract };
  }

  /**
   * Reads a contract from a scene's flags.
   */
  read(sceneId: string): SceneContract | null {
    // @ts-ignore
    const scene = game.scenes.get(sceneId);
    if (!scene) return null;

    // @ts-ignore
    const contract = scene.getFlag(moduleId, "contract") as
      | SceneContract
      | undefined;
    if (!contract) return null;

    // Ensure progress exists
    if (!contract.progress) {
      contract.progress = this.emptyProgress();
    }

    return contract;
  }

  /**
   * Overwrites the contract on a scene.
   */
  async write(sceneId: string, contract: SceneContract): Promise<void> {
    // @ts-ignore
    const scene = game.scenes.get(sceneId);
    if (!scene) throw new Error(`Scene ${sceneId} not found`);

    // @ts-ignore
    await scene.setFlag(moduleId, "contract", contract);
  }

  /**
   * Merges a partial contract update.
   */
  async patch(sceneId: string, patch: Partial<SceneContract>): Promise<void> {
    const existing = this.read(sceneId);
    if (!existing) {
      // If no contract exists and we're patching, we might need a default base
      // but usually the GM creates one first. For now, let's just fail if missing.
      throw new Error(`Cannot patch missing contract for scene ${sceneId}`);
    }

    const updated = { ...existing, ...patch };
    await this.write(sceneId, updated);
  }

  /**
   * Mutates the progress portion of a contract.
   */
  async recordProgress(
    sceneId: string,
    patch: Partial<ContractProgress>,
  ): Promise<void> {
    const existing = this.read(sceneId);
    if (!existing) return;

    const updatedProgress: ContractProgress = {
      ...existing.progress,
      ...patch,
      // Handle arrays/objects that might need merging if specified in spec,
      // but spec says recordProgress(sceneId, patch: Partial<ContractProgress>)
      // which implies the caller provides the NEW full array for that field if they want to append.
    };

    // Special handling for freeform to ensure we don't accidentally wipe it if patch doesn't include it
    if (patch.cluesRevealed)
      updatedProgress.cluesRevealed = patch.cluesRevealed;
    if (patch.complicationsTriggered)
      updatedProgress.complicationsTriggered = patch.complicationsTriggered;
    if (patch.freeform) updatedProgress.freeform = patch.freeform;
    if (patch.hiddenLeaks) updatedProgress.hiddenLeaks = patch.hiddenLeaks;

    await this.patch(sceneId, { progress: updatedProgress });
  }

  private emptyProgress(): ContractProgress {
    return {
      cluesRevealed: [],
      complicationsTriggered: [],
      freeform: [],
      hiddenLeaks: [],
    };
  }
}
