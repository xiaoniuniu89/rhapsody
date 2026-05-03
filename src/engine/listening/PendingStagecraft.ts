export interface PendingMove {
  kind: string;
  args: any;
}

export class PendingStagecraft {
  private queue: PendingMove[] = [];

  enqueue(kind: string, args: any): void {
    this.queue.push({ kind, args });
  }

  drain(): PendingMove[] {
    const items = [...this.queue];
    this.queue = [];
    return items;
  }

  get length(): number {
    return this.queue.length;
  }
}
