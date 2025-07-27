import { initSidebar } from './components/sidebar';

console.log("Rhapsody module loaded!");

Hooks.on("ready", function() {
  console.log("Rhapsody: Ready to go!");
  initSidebar();
});