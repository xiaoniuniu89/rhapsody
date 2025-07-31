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

  async showSummaryEditDialog(summary: string): Promise<string | null> {
    return new Promise((resolve) => {
      const dialog = new foundry.applications.api.DialogV2({
        window: {
          title: "Edit Scene Summary",
          width: 600,
          height: 500,
        },
        content: `
          <div style="margin-bottom: 10px;">Review and edit the scene summary before saving:</div>
          <div class="summary-preview" style="border: 1px solid #444; padding: 10px; margin-bottom: 10px; max-height: 200px; overflow-y: auto; background: rgba(0,0,0,0.3);">
            ${summary}
          </div>
          <textarea name="scene-summary" style="width: 100%; height: 200px; font-family: inherit; display: none;">${summary}</textarea>
          <div style="margin-top: 10px;">
            <label>
              <input type="checkbox" name="edit-mode" onchange="
                const preview = this.closest('.window-content').querySelector('.summary-preview');
                const textarea = this.closest('.window-content').querySelector('textarea');
                if (this.checked) {
                  preview.style.display = 'none';
                  textarea.style.display = 'block';
                  textarea.value = preview.innerHTML;
                } else {
                  preview.style.display = 'block';
                  textarea.style.display = 'none';
                  preview.innerHTML = textarea.value;
                }
              ">
              Edit HTML directly
            </label>
          </div>
        `,
        buttons: [
          {
            action: "save",
            label: "Save",
            icon: "fas fa-save",
            default: true,
            callback: (event, button, dialog) => {
              const textarea = button.form.elements[
                "scene-summary"
              ] as HTMLTextAreaElement;
              const editMode = button.form.elements[
                "edit-mode"
              ] as HTMLInputElement;
              const preview = dialog.element?.querySelector(
                ".summary-preview",
              ) as HTMLElement;

              // Return either the edited HTML or the preview content
              const finalContent = editMode.checked
                ? textarea.value
                : preview.innerHTML;
              resolve(finalContent);
            },
          },
          {
            action: "cancel",
            label: "Cancel",
            icon: "fas fa-times",
            callback: () => resolve(null),
          },
        ],
        close: () => resolve(null),
      });

      dialog.render(true);
    });
  }
}
