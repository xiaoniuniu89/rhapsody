import { id as moduleId } from "../../module.json";
import type {
  MemoryScope,
  PageContent,
  PageSummary,
  RhapsodyMode,
} from "./types";

const BIBLE_FOLDER_NAME = "Rhapsody Bible";
const JOURNAL_FOLDER_NAME = "Rhapsody Journal";

export class MemoryService {
  private bibleFolder: any = null;
  private journalFolder: any = null;

  async init(): Promise<void> {
    this.bibleFolder = await this.findOrCreateFolder(BIBLE_FOLDER_NAME);
    this.journalFolder = await this.findOrCreateFolder(JOURNAL_FOLDER_NAME);
  }

  getMode(): RhapsodyMode {
    // @ts-ignore — foundry global
    return game.settings.get(moduleId, "rhapsodyMode") as RhapsodyMode;
  }

  get folderIds(): { bible: string | null; journal: string | null } {
    return {
      bible: this.bibleFolder?.id ?? null,
      journal: this.journalFolder?.id ?? null,
    };
  }

  listPages(scope: MemoryScope): PageSummary[] {
    const folder = this.folderFor(scope);
    if (!folder) return [];
    // @ts-ignore — foundry global
    const entries: any[] = [...game.journal.values()].filter(
      (e: any) => e.folder?.id === folder.id,
    );
    return entries.map((e) => ({
      id: e.id,
      name: e.name,
      hasPrivate: this.findSubPage(e, "Private") != null,
    }));
  }

  readPage(scope: MemoryScope, name: string): PageContent | null {
    const folder = this.folderFor(scope);
    if (!folder) return null;
    // @ts-ignore — foundry global
    const entry: any = [...game.journal.values()].find(
      (e: any) => e.folder?.id === folder.id && e.name === name,
    );
    if (!entry) return null;

    const publicPage = this.findSubPage(entry, "Public");
    const publicHtml = publicPage?.text?.content ?? "";

    let privateHtml: string | null = null;
    if (scope === "bible" && this.getMode() === "prep") {
      const privatePage = this.findSubPage(entry, "Private");
      privateHtml = privatePage?.text?.content ?? null;
    }

    return {
      name: entry.name,
      public: publicHtml,
      private: privateHtml,
    };
  }

  async writePage(
    scope: MemoryScope,
    name: string,
    content: { public: string; private?: string },
  ): Promise<PageSummary> {
    const folder = this.folderFor(scope);
    if (!folder) throw new Error(`Folder for scope ${scope} not initialized`);

    if (scope === "journal" && content.private) {
      throw new Error("Journal scope cannot have private content");
    }

    // @ts-ignore — foundry global
    let entry: any = [...game.journal.values()].find(
      (e: any) => e.folder?.id === folder.id && e.name === name,
    );

    if (!entry) {
      // @ts-ignore — foundry global
      entry = await JournalEntry.create({
        name,
        folder: folder.id,
      });
    }

    const pagesToUpsert: any[] = [
      {
        name: "Public",
        type: "text",
        "text.content": content.public,
        "text.format": 1, // HTML
      },
    ];

    if (content.private) {
      pagesToUpsert.push({
        name: "Private",
        type: "text",
        "text.content": content.private,
        "text.format": 1, // HTML
      });
    }

    for (const pageData of pagesToUpsert) {
      const existing = this.findSubPage(entry, pageData.name);
      if (existing) {
        await existing.update(pageData);
      } else {
        await entry.createEmbeddedDocuments("JournalEntryPage", [pageData]);
      }
    }

    return {
      id: entry.id,
      name: entry.name,
      hasPrivate:
        content.private != null || this.findSubPage(entry, "Private") != null,
    };
  }

  async appendPage(
    scope: MemoryScope,
    name: string,
    section: "Public" | "Private",
    html: string,
  ): Promise<void> {
    const folder = this.folderFor(scope);
    if (!folder) throw new Error(`Folder for scope ${scope} not initialized`);

    if (scope === "journal" && section === "Private") {
      throw new Error("Journal scope cannot have private content");
    }

    // @ts-ignore — foundry global
    let entry: any = [...game.journal.values()].find(
      (e: any) => e.folder?.id === folder.id && e.name === name,
    );

    if (!entry) {
      // @ts-ignore — foundry global
      entry = await JournalEntry.create({
        name,
        folder: folder.id,
      });
    }

    const existing = this.findSubPage(entry, section);
    if (existing) {
      const currentContent = existing.text?.content ?? "";
      const newContent = currentContent ? `${currentContent}<br>${html}` : html;
      await existing.update({ "text.content": newContent });
    } else {
      await entry.createEmbeddedDocuments("JournalEntryPage", [
        {
          name: section,
          type: "text",
          "text.content": html,
          "text.format": 1, // HTML
        },
      ]);
    }
  }

  private folderFor(scope: MemoryScope): any {
    return scope === "bible" ? this.bibleFolder : this.journalFolder;
  }

  private findSubPage(entry: any, name: string): any {
    const pages = entry.pages;
    if (!pages) return null;
    return [...pages.values()].find((p: any) => p.name === name) ?? null;
  }

  private async findOrCreateFolder(name: string): Promise<any> {
    // @ts-ignore — foundry global
    const existing = game.folders?.find(
      (f: any) =>
        f.name === name && f.type === "JournalEntry" && f.folder == null,
    );
    if (existing) return existing;
    // @ts-ignore — foundry global
    return await Folder.create({ name, type: "JournalEntry" });
  }
}
