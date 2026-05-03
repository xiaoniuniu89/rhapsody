// src/engine/contract/types.ts

export interface SceneContract {
  question: string; // "Does the player learn the merchant is lying?"
  onOffer: ContractItem[]; // info/items/leads available
  hidden: string[]; // strings explicitly off-limits this scene
  complications: ContractItem[]; // turns the GM can pull
  exits: string[]; // candidate next-scene names
  progress: ContractProgress; // mutated as moves fire
}

export interface ContractItem {
  id: string; // stable id within the contract (slug)
  text: string; // human-readable
}

export interface ContractProgress {
  cluesRevealed: string[]; // ContractItem ids
  complicationsTriggered: string[];
  freeform: { type: string; text: string; at: number }[]; // hard_choice, ask_question, reflect_consequence
  hiddenLeaks: string[]; // strings from hidden[] that appeared in narration
}
