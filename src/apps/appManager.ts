// apps/appManager.ts
import RhapsodyApp from "./rhapsodyApp";

export class AppManager {
  private rhapsodyApp: RhapsodyApp | null = null;

  /**
   * Initialize the Rhapsody app
   */
  init(): void {
    console.log("Initializing Rhapsody app...");
    this.rhapsodyApp = new RhapsodyApp();
  }

  /**
   * Open the Rhapsody chat
   */
  openRhapsody(): void {
    if (this.rhapsodyApp) {
      this.rhapsodyApp.render({ force: true });
    } else {
      console.error("Rhapsody app not initialized");
      ui.notifications?.error("Rhapsody not ready");
    }
  }

  /**
   * Close Rhapsody
   */
  closeRhapsody(): void {
    if (this.rhapsodyApp) {
      this.rhapsodyApp.close();
    }
  }

  /**
   * Get the app instance (for external access)
   */
  getRhapsodyApp(): RhapsodyApp | null {
    return this.rhapsodyApp;
  }
}
