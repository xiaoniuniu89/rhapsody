// src/apps/rhapsody/sceneService.ts
import type { Scene, Message, Session } from "../types";
import { ApiService } from "./apiService";

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
    return this.apiService.generateSceneSummary(messages, systemInfo);
  }

  async showSummaryEditDialog(summary: string): Promise<string | null> {
    return new Promise((resolve) => {
      const dialog = new foundry.applications.api.DialogV2({
        window: {
          title: "Edit Scene Summary",
        },
        content: `
          <div style="margin-bottom: 10px;">Review and edit the scene summary before saving:</div>
          <textarea name="scene-summary" style="width: 100%; height: 300px; font-family: inherit;">${summary}</textarea>
        `,
        buttons: [
          {
            action: "save",
            label: "Save",
            icon: "fas fa-save",
            default: true,
            callback: (event, button, dialog) => {
              console.log(event, dialog);
              const textarea = button?.form?.elements[
                // @ts-ignore
                "scene-summary"
              ] as HTMLTextAreaElement;
              resolve(textarea.value);
            },
          },
          {
            action: "cancel",
            label: "Cancel",
            icon: "fas fa-times",
            callback: () => resolve(null),
          },
        ],
        // @ts-ignore
        submit: (result) => {
          //TODO: fix this type error
          // @ts-ignore
          if (result.action === "save") {
            const form = dialog.element?.querySelector("form");
            const textarea = form?.elements.namedItem(
              "scene-summary",
            ) as HTMLTextAreaElement;
            resolve(textarea?.value || summary);
          } else {
            resolve(null);
          }
        },
        close: () => resolve(null),
      });

      dialog.render(true);
    });
  }
}
