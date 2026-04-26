// @ts-ignore — foundry global
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class RhapsodyApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "rhapsody",
    tag: "div",
    window: {
      title: "Rhapsody",
      icon: "fa-solid fa-theater-masks",
      resizable: true,
    },
    position: { width: 600, height: 700 },
  };

  static PARTS = {
    panel: {
      template: "modules/rhapsody/public/templates/rhapsody-panel.hbs",
    },
  };
}
