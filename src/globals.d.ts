import '@league-of-foundry-developers/foundry-vtt-types';

declare global {
  const game: Game;
  const canvas: Canvas;
  const ui: UI;
  const Hooks: typeof foundry.utils.Hooks;
}

export {};