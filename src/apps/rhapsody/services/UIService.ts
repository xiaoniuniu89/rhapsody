// services/UIService.ts

const { DialogV2 } = foundry.applications.api;

export class UIService {
  async promptForSessionName(sessionCount: number): Promise<string | null> {
    return new Promise((resolve) => {
      const dialog = new DialogV2({
        window: {
          title: "Start New Session"
        },
        content: `
          <div style="margin-bottom: 10px;">Enter a name for this session (optional):</div>
          <input type="text" name="session-name" placeholder="Session ${sessionCount}" style="width: 100%;">
        `,
        buttons: [{
          action: "start",
          label: "Start Session",
          icon: "fas fa-play",
          default: true,
          callback: (event, button) => {
            const input = button.querySelector('input[name="session-name"]') as HTMLInputElement;
            resolve(input?.value || '');
          }
        }, {
          action: "cancel",
          label: "Cancel",
          icon: "fas fa-times",
          callback: () => resolve(null)
        }],
      });

      dialog.render(true);
    });
  }

  async confirmModal(content?: string, title?: string): Promise<boolean> {
    const confirmed = await DialogV2.confirm({
    title: title || "Confirm Action",
    content: content || "Are you sure?",
    rejectClose: false,
    modal: true
  });

    return confirmed;
  }
}
