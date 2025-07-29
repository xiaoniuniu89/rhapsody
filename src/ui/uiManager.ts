// ui/uiManager.ts
import { AppManager } from "../apps/appManager";
import { FloatingButton } from "./FloatingButton";

export class UIManager {
  private floatingButton: FloatingButton;
  
  constructor() {
    // Pass appManager directly to FloatingButton
    this.floatingButton = new FloatingButton(new AppManager());
  }
  
  init(): void {
    console.log("Setting up Rhapsody UI...");
    this.floatingButton.create();
  }
  
  destroy(): void {
    this.floatingButton.remove();
  }
}