// apps/journalBrowserApp.ts
import { id as moduleId } from "../../module.json";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const Base = HandlebarsApplicationMixin(ApplicationV2);

interface JournalData {
  id: string;
  name: string;
  content: string;
  preview: string; // First few lines of text
  folderName: string; // Name of parent folder
  folderId: string | null;
  img: string | null;
  pageCount: number; // Number of pages in journal
  canView: boolean; // Can current user view this?
  isEmpty: boolean; // Has no content
}

interface JournalFolderData {
  id: string;
  name: string;
  journalCount: number;
  color: string | null;
}

interface JournalBrowserContext {
  journals: JournalData[];
  folders: JournalFolderData[];
  totalCount: number;
  folderFilter: string | null; // Current folder filter
  isEmpty: boolean;
  hasContent: boolean;
}

export default class JournalBrowserApp extends Base {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    id: "journal-browser",
    width: 500,
    height: 600,

    window: {
      title: "Journal Entry Browser",
      controls: [
        {
          icon: "fa-solid fa-refresh",
          label: "Refresh Journals",
          action: "refreshJournals",
        },
        {
          icon: "fa-solid fa-folder-open",
          label: "Show All Folders",
          action: "clearFilter",
        },
      ],
    },

    actions: {
      setFolderFilter: JournalBrowserApp.setFolderFilter,
      clearFilter: JournalBrowserApp.clearFilter,
      refreshJournals: JournalBrowserApp.refreshJournals,
      openJournal: JournalBrowserApp.openJournal,
    },

    classes: ["journal-browser-app"],
  };

  static PARTS = {
    header: {
      template: `modules/${moduleId}/public/templates/journal-browser-header.hbs`,
      classes: ["journal-header"],
    },
    folders: {
      template: `modules/${moduleId}/public/templates/journal-browser-folders.hbs`,
      classes: ["journal-folders"],
    },
    list: {
      template: `modules/${moduleId}/public/templates/journal-browser-list.hbs`,
      classes: ["journal-list-container"],
      scrollable: [".journal-list"],
    },
  };

  // Application state
  private folderFilter: string | null = null; // Which folder to show (null = all)

  // Main context preparation
  async _prepareContext(options: any): Promise<JournalBrowserContext> {
    console.log("Preparing journal browser context");

    // Get all journals and folders from the game
    const allJournals = this.getAllJournals();
    const allFolders = this.getAllFolders();

    // Apply folder filter if active
    const filteredJournals = this.getFilteredJournals(allJournals);

    return {
      journals: filteredJournals,
      folders: allFolders,
      totalCount: allJournals.length,
      folderFilter: this.folderFilter,
      isEmpty: allJournals.length === 0,
      hasContent: filteredJournals.length > 0,
    };
  }

  // Part-specific context preparation
  async _preparePartContext(
    partId: string,
    context: JournalBrowserContext,
  ): Promise<any> {
    switch (partId) {
      case "header":
        return {
          ...context,
          title: "Journal Entries",
          subtitle: this.getSubtitle(context),
        };

      case "folders":
        return {
          ...context,
          showFolders: context.folders.length > 0,
          activeFolderId: this.folderFilter,
        };

      case "list":
        return {
          ...context,
          emptyMessage: this.getEmptyMessage(context),
        };

      default:
        return context;
    }
  }

  // Show/hide parts based on data
  _configureRenderOptions(options: any) {
    super._configureRenderOptions(options);

    // Always show header
    options.parts = ["header"];

    // Show folders if we have any
    if (this.hasFolders()) {
      options.parts.push("folders");
    }

    // Always show list (handles empty state)
    options.parts.push("list");
  }

  // CORE METHOD: Extract journal data from Foundry
  private getAllJournals(): JournalData[] {
    console.log("Getting journals from game.journal");

    console.log("Found journals:", game.journal);

    return game.journal
      .map((journal) => {
        // Extract text content for preview
        const textContent = this.extractTextContent(journal);
        const preview = this.createPreview(textContent);

        return {
          id: journal.id,
          name: journal.name || "Untitled Journal",
          content: textContent,
          preview: preview,
          folderName: journal.folder?.name || "Unfiled",
          folderId: journal.folder?.id || null,
          img: journal.img || null,
          pageCount: journal.pages?.size || 0,
          canView: journal.testUserPermission(game.user, "OBSERVER"),
          isEmpty: textContent.trim().length === 0,
        };
      })
      .filter((journal) => journal.canView); // Only show journals user can view
  }

  // Extract folders from game data
  private getAllFolders(): JournalFolderData[] {
    if (!game.folders) return [];

    return game.folders
      .filter((folder) => folder.type === "JournalEntry")
      .map((folder) => {
        // Count journals in this folder
        const journalCount = game.journal.filter(
          (j) => j.folder?.id === folder.id,
        ).length;

        return {
          id: folder.id,
          name: folder.name || "Unnamed Folder",
          journalCount,
          color: folder.color || null,
        };
      })
      .filter((folder) => folder.journalCount > 0); // Only show folders with content
  }

  // Extract plain text from journal content
  private extractTextContent(journal: any): string {
    // Modern journals have pages
    if (journal.pages && journal.pages.size > 0) {
      let allText = "";
      journal.pages.forEach((page: any) => {
        if (page.text?.content) {
          console.log(`Extracting text from page: ${page.text.content}`);
          // Strip HTML tags to get plain text
          const div = document.createElement("div");
          div.innerHTML = page.text.content;
          allText += div.textContent || div.innerText || "";
          allText += "\n\n";
        }
      });
      return allText.trim();
    }

    // Legacy journals have direct content
    if (journal.content) {
      const div = document.createElement("div");
      div.innerHTML = journal.content;
      return div.textContent || div.innerText || "";
    }

    return "";
  }

  // Create a preview snippet from full text
  private createPreview(text: string): string {
    if (!text || text.trim().length === 0) {
      return "No content";
    }

    // Get first 150 characters, break at word boundary
    let preview = text.substring(0, 150);
    const lastSpace = preview.lastIndexOf(" ");

    if (lastSpace > 0 && text.length > 150) {
      preview = preview.substring(0, lastSpace) + "...";
    }

    return preview;
  }

  // Filter journals by folder
  private getFilteredJournals(journals: JournalData[]): JournalData[] {
    if (!this.folderFilter) {
      return journals; // Show all
    }

    return journals.filter((journal) => journal.folderId === this.folderFilter);
  }

  // Helper methods
  private hasFolders(): boolean {
    return game.folders?.filter((f) => f.type === "JournalEntry").length > 0;
  }

  private getSubtitle(context: JournalBrowserContext): string {
    if (context.isEmpty) {
      return "No journal entries in world";
    }

    if (this.folderFilter) {
      const folder = context.folders.find((f) => f.id === this.folderFilter);
      const folderName = folder?.name || "Unknown Folder";
      return `Showing ${context.journals.length} entries from "${folderName}"`;
    }

    return `Showing ${context.journals.length} of ${context.totalCount} journal entries`;
  }

  private getEmptyMessage(context: JournalBrowserContext): string {
    if (context.isEmpty) {
      return "No journal entries exist in this world. Create some journals to see them here!";
    }

    if (this.folderFilter && !context.hasContent) {
      return "No journal entries in the selected folder.";
    }

    return "No journal entries match the current filter.";
  }

  // ACTION METHODS

  static async setFolderFilter(
    this: JournalBrowserApp,
    event: Event,
    target: HTMLElement,
  ) {
    const folderId = target.dataset.folderId;

    if (folderId !== this.folderFilter) {
      console.log(`Setting folder filter to: ${folderId}`);
      this.folderFilter = folderId || null;

      // Re-render parts that depend on filtering
      this.render({ parts: ["header", "folders", "list"] });
    }
  }

  static async clearFilter(
    this: JournalBrowserApp,
    event: Event,
    target: HTMLElement,
  ) {
    if (this.folderFilter !== null) {
      console.log("Clearing folder filter");
      this.folderFilter = null;

      this.render({ parts: ["header", "folders", "list"] });
      ui.notifications?.info("Showing all journal entries");
    }
  }

  static async refreshJournals(
    this: JournalBrowserApp,
    event: Event,
    target: HTMLElement,
  ) {
    console.log("Refreshing journal list");

    // Force complete re-render to pick up new/deleted journals
    this.render({ force: true });

    ui.notifications?.info("Journal list refreshed");
  }

  static async openJournal(
    this: JournalBrowserApp,
    event: Event,
    target: HTMLElement,
  ) {
    const journalId = target.dataset.journalId;
    if (!journalId) return;

    // Find the journal in Foundry's collection
    const journal = game.journal.get(journalId);
    if (!journal) {
      ui.notifications?.error("Journal not found");
      return;
    }

    console.log("Opening journal:", journal.name);

    // Open the journal's native sheet
    journal.sheet?.render(true);
  }
}
