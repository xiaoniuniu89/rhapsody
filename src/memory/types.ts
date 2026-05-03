export type MemoryScope = "bible" | "journal";

export interface PageSummary {
  id: string;
  name: string;
  hasPrivate: boolean;
}

export interface PageContent {
  name: string;
  public: string;
  private: string | null;
}
