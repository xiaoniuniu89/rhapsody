// apps/actorListApp.ts
import { id as moduleId } from "../../module.json";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const Base = HandlebarsApplicationMixin(ApplicationV2);

interface ActorData {
  id: string;
  name: string;
  type: string;
  img: string;
  isPC: boolean;
  isNPC: boolean;
  hp?: {
    value: number;
    max: number;
  };
}

interface ActorListContext {
  actors: ActorData[];
  totalCount: number;
  pcCount: number;
  npcCount: number;
  isEmpty: boolean;
  filterType: 'all' | 'pc' | 'npc';
}

export default class ActorListApp extends Base {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    id: "actor-list",
    width: 400,
    height: 200,
    
    window: {
      title: "Actor List Viewer",
      controls: [
        {
          icon: 'fa-solid fa-refresh',
          label: "Refresh List",
          action: "refreshList"
        }
      ]
    },
    
    actions: {
      setFilter: ActorListApp.setFilter,
      refreshList: ActorListApp.refreshList,
      viewActor: ActorListApp.viewActor
    },
    
    classes: ["actor-list-app"]
  };

  static PARTS = {
    header: {
      template: `modules/${moduleId}/public/templates/actor-list-header.hbs`,
      classes: ['actor-header']
    },
    filters: {
      template: `modules/${moduleId}/public/templates/actor-list-filters.hbs`, 
      classes: ['actor-filters']
    },
    list: {
      template: `modules/${moduleId}/public/templates/actor-list-items.hbs`,
      classes: ['actor-list-container'],
      scrollable: ['.actor-list']
    }
  };

  // Application state (minimal - most data comes from game)
  private filterType: 'all' | 'pc' | 'npc' = 'all';

  // Main context preparation
  async _prepareContext(options: any): Promise<ActorListContext> {
    console.log("Preparing actor list context");
    
    // Get all actors from the game
    const allActors = this.getAllActors();
    
    // Apply current filter
    const filteredActors = this.getFilteredActors(allActors);
    
    // Calculate stats
    const pcCount = allActors.filter(actor => actor.isPC).length;
    const npcCount = allActors.filter(actor => actor.isNPC).length;
    
    return {
      actors: filteredActors,
      totalCount: allActors.length,
      pcCount,
      npcCount,
      isEmpty: allActors.length === 0,
      filterType: this.filterType
    };
  }

  // Part-specific context preparation
  async _preparePartContext(partId: string, context: ActorListContext): Promise<any> {
    switch (partId) {
      case 'header':
        return {
          ...context,
          title: "Actors in World",
          subtitle: this.getSubtitle(context)
        };
        
      case 'filters':
        return {
          ...context,
          filters: [
            { 
              key: 'all', 
              label: `All (${context.totalCount})`, 
              active: this.filterType === 'all' 
            },
            { 
              key: 'pc', 
              label: `PCs (${context.pcCount})`, 
              active: this.filterType === 'pc' 
            },
            { 
              key: 'npc', 
              label: `NPCs (${context.npcCount})`, 
              active: this.filterType === 'npc' 
            }
          ]
        };
        
      case 'list':
        return {
          ...context,
          emptyMessage: this.getEmptyMessage()
        };
        
      default:
        return context;
    }
  }

  // Show/hide parts based on data
  _configureRenderOptions(options: any) {
    super._configureRenderOptions(options);
    
    // Always show header
    options.parts = ['header'];
    
    // Only show filters if we have actors
    if (!this.isEmpty()) {
      options.parts.push('filters');
    }
    
    // Always show list (handles empty state)
    options.parts.push('list');
  }

  // CORE METHOD: Extract actor data from Foundry
  private getAllActors(): ActorData[] {
    console.log("Getting actors from game.actors");

    console.log("Found actors:", game.actors);
    
    // game.actors is Foundry's collection of all actors
    return game.actors.map(actor => {
      // Extract the data we need from each actor document
      return {
        id: actor.id,
        name: actor.name || "Unnamed Actor",
        type: actor.type || "unknown",
        img: actor.img || "icons/svg/mystery-man.svg",
        isPC: actor.type === "character", // Depends on your system
        isNPC: actor.type !== "character",
        // HP example (depends on your game system)
        hp: actor.system?.attributes?.hp ? {
          value: actor.system.attributes.hp.value || 0,
          max: actor.system.attributes.hp.max || 0
        } : undefined
      };
    });
  }

  // Filter actors based on current filter
  private getFilteredActors(actors: ActorData[]): ActorData[] {
    switch (this.filterType) {
      case 'pc':
        return actors.filter(actor => actor.isPC);
      case 'npc':
        return actors.filter(actor => actor.isNPC);
      default:
        return actors; // 'all'
    }
  }

  // Helper methods
  private isEmpty(): boolean {
    return game.actors.size === 0;
  }

  private getSubtitle(context: ActorListContext): string {
    if (context.isEmpty) {
      return "No actors in world";
    }
    
    switch (this.filterType) {
      case 'pc':
        return `Showing ${context.actors.length} player characters`;
      case 'npc':
        return `Showing ${context.actors.length} NPCs`;
      default:
        return `Showing ${context.actors.length} of ${context.totalCount} actors`;
    }
  }

  private getEmptyMessage(): string {
    if (this.isEmpty()) {
      return "No actors exist in this world. Create some actors to see them here!";
    }
    
    switch (this.filterType) {
      case 'pc':
        return "No player characters found.";
      case 'npc':
        return "No NPCs found.";
      default:
        return "No actors match the current filter.";
    }
  }

  // ACTION METHODS

  static async setFilter(this: ActorListApp, event: Event, target: HTMLElement) {
    const filter = target.dataset.filter as 'all' | 'pc' | 'npc';
    
    if (filter && filter !== this.filterType) {
      console.log(`Changing filter from ${this.filterType} to ${filter}`);
      this.filterType = filter;
      
      // Re-render parts that depend on filtering
      this.render({ parts: ['header', 'filters', 'list'] });
    }
  }

  static async refreshList(this: ActorListApp, event: Event, target: HTMLElement) {
    console.log("Refreshing actor list");
    
    // Force a complete re-render to pick up any new/deleted actors
    this.render({ force: true });
    
    ui.notifications?.info("Actor list refreshed");
  }

  static async viewActor(this: ActorListApp, event: Event, target: HTMLElement) {
    const actorId = target.dataset.actorId;
    if (!actorId) return;

    if(!game.actors){return ui.notifications?.error("No actors found in game");}
    
    // Find the actor in Foundry's collection
    const actor = game.actors.get(actorId);
    if (!actor) {
      ui.notifications?.error("Actor not found");
      return;
    }
    
    console.log("Opening actor sheet for:", actor.name);
    
    // Open the actor's character sheet (Foundry built-in)
    actor.sheet?.render(true);
  }
}