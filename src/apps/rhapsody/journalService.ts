// services/journalService.ts
import type { Scene } from "./types";

export class JournalService {
  async createJournalEntry(scene: Scene): Promise<void> {
    const systemInfo = game.system.title || game.system.id;
    const sceneName = canvas.scene?.name || "Unknown Location";
    const worldName = game.world.title;
    const rhapsodyFolderName = "Rhapsody Sessions";

    const topFolder = await this.getOrCreateFolder(worldName, null);
    const rhapsodyFolder = await this.getOrCreateFolder(rhapsodyFolderName, topFolder.id);

    await JournalEntry.create({
      name: scene.name,
      folder: rhapsodyFolder.id,
      pages: [{
        name: "Summary",
        type: "text",
        text: {
          content: `
            <h2>${scene.name}</h2>
            <p><em>${scene.startTime.toLocaleString()}</em></p>
            <p><strong>System:</strong> ${systemInfo} | <strong>Location:</strong> ${sceneName}</p>
            ${scene.summary ? `<div>${scene.summary}</div>` : ''}
          `
        }
      }]
    });
  }

  private async getOrCreateFolder(name: string, parentId: string | null = null): Promise<Folder> {
    const folder = game.folders.find(f =>
      f.name.toLowerCase() === name.toLowerCase()
    );

    if (folder) return folder;

    const created = await Folder.create({
      name,
      type: "JournalEntry",
      folder: parentId ?? null,
      sorting: "a"
    });

    return created;
  }
}