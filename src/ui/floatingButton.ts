// ui/floatingButton.ts
import { AppManager } from "../apps/appManager";

export class FloatingButton {
  private button: HTMLElement | null = null;

  constructor(private appManager: AppManager) {}

  /**
   * Create and add the floating button to the page
   */
  create(): void {
    // Clean up existing button
    this.remove();

    // Create button element
    this.button = document.createElement("button");
    this.button.id = "rhapsody-floating-button";
    this.button.className = "rhapsody-floating-btn";
    this.button.innerHTML = '<i class="fas fa-comments"></i>';
    this.button.title = "Open Rhapsody AI Chat";

    // Add click handler
    this.button.addEventListener("click", () => {
      this.appManager.openRhapsody();
    });

    // Add to page
    document.body.appendChild(this.button);

    console.log("Rhapsody floating button created");
  }

  /**
   * Remove the floating button
   */
  remove(): void {
    if (this.button) {
      this.button.remove();
      this.button = null;
    }
  }
}
