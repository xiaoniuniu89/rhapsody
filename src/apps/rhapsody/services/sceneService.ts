// src/apps/rhapsody/sceneService.ts
import type { Scene, Message, Session } from "../types";
import { ApiService } from "./apiService";
import { MarkdownService } from "./markdownService";

export class SceneService {
  private apiService: ApiService;

  constructor(apiService: ApiService) {
    this.apiService = apiService;
  }

  createNewScene(name?: string, session?: Session | null): Scene {
    const sceneNumber = session ? session.sceneCount + 1 : 1;
    const sceneName =
      name || `Scene ${sceneNumber} - ${new Date().toLocaleTimeString()}`;

    return {
      id: foundry.utils.randomID(),
      name: sceneName,
      number: sceneNumber,
      sessionId: session?.id,
      messages: [],
      startTime: new Date(),
    };
  }

  async generateSceneSummary(messages: Message[]): Promise<string> {
    const systemInfo =
      game?.system?.title || game?.system?.id || "Unknown System";
    const markdownSummary = await this.apiService.generateSceneSummary(
      messages,
      systemInfo,
    );
    // Convert to HTML for display and storage
    return MarkdownService.convertToHTML(markdownSummary);
  }
}
