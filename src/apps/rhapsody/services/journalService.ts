// src/apps/rhapsody/journalService.ts
import type { Scene, Session } from "../types";

export class JournalService {
  async createJournalEntry(
    scene: Scene,
    session: Session | null,
  ): Promise<void> {
    if (!game.system || !game.folders || !game.journal || !canvas?.scene) {
      console.warn(
        "Rhapsody: JournalService requires game.system, game.folders, and game.journal to be available",
      );
      return;
    }
    const systemInfo = game.system.title || game.system.id;
    const sceneName = canvas.scene?.name || "Unknown Location";
    const worldName = game.world.title;

    // Build folder structure based on session
    const folderPath = session
      ? await this.createSessionFolderStructure(worldName, session)
      : await this.createBasicFolderStructure(worldName);

    // Create journal metadata
    const metadata = this.createMetadata(scene, session);

    await JournalEntry.create({
      name: scene.name,
      folder: folderPath.id,
      pages: [
        {
          name: "Summary",
          type: "text",
          text: {
            content: `
            ${metadata}
            <h2>${scene.name}</h2>
            <p><em>Started: ${scene.startTime.toLocaleString()}</em></p>
            <p><strong>System:</strong> ${systemInfo} | <strong>Location:</strong> ${sceneName}</p>
            ${session ? `<p><strong>Session:</strong> ${session.name} | <strong>Scene:</strong> ${scene.number}</p>` : ""}
            <hr>
            ${scene.summary ? `<div>${scene.summary}</div>` : ""}
          `,
          },
        },
      ],
    });
  }

  private createMetadata(scene: Scene, session: Session | null): string {
    // Hidden metadata for future semantic search
    const metadata = {
      sessionId: session?.id || null,
      sessionNumber: session?.number || null,
      sceneNumber: scene.number || null,
      timestamp: scene.startTime.toISOString(),
    };

    return `<!-- RHAPSODY_METADATA: ${JSON.stringify(metadata)} -->`;
  }

  private async createSessionFolderStructure(
    worldName: string,
    session: Session,
  ): Promise<any> {
    console.log("creating session folder structure for", worldName);
    // Option A: Keep flat structure
    const rhapsodyFolder = await this.getOrCreateFolder(
      "Rhapsody Sessions",
      null,
    );
    const sessionFolder = await this.getOrCreateFolder(
      session.name,
      rhapsodyFolder.id,
    );
    return sessionFolder;

    // Option B: Restore world folder nesting (uncomment if preferred)
    /*
  const worldFolder = await this.getOrCreateFolder(worldName, null);
  const rhapsodyFolder = await this.getOrCreateFolder("Rhapsody Sessions", worldFolder.id);
  const sessionFolder = await this.getOrCreateFolder(session.name, rhapsodyFolder.id);
  return sessionFolder;
  */
  }

  private async createBasicFolderStructure(worldName: string): Promise<any> {
    const topFolder = await this.getOrCreateFolder(worldName, null);
    const rhapsodyFolder = await this.getOrCreateFolder(
      "Rhapsody Sessions",
      topFolder.id,
    );
    return rhapsodyFolder;
  }

  private async getOrCreateFolder(
    name: string,
    parentId: string | null = null,
  ): Promise<any> {
    if (!game.folders) {
      console.warn("Rhapsody: game.folders is not available");
      return null;
    }
    const folder = game.folders.find(
      (f: any) =>
        f.name === name &&
        f.type === "JournalEntry" &&
        (f.folder?.id || null) === parentId,
    );

    if (folder) return folder;

    const created = await Folder.create({
      name,
      type: "JournalEntry",
      folder: parentId,
    });

    return created;
  }
}
