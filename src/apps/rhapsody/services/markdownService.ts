// First, install marked:
// npm install marked
// npm install @types/marked --save-dev

// src/apps/rhapsody/markdownService.ts
import { marked } from "marked";

export class MarkdownService {
  static {
    // Configure marked options
    marked.setOptions({
      breaks: true, // Convert \n to <br>
      gfm: true, // GitHub Flavored Markdown
      pedantic: false,
      sanitize: false, // We'll handle our own sanitization
      smartLists: true,
      smartypants: true, // Nice quotes and dashes
    });
  }

  /**
   * Convert markdown to HTML using marked
   */
  static convertToHTML(markdown: string): string {
    if (!markdown) return "";

    // marked automatically escapes HTML in markdown for safety
    return marked.parse(markdown);
  }

  /**
   * Convert markdown to HTML for streaming
   * Handles incomplete markdown gracefully
   */
  static convertStreamingChunk(currentFullText: string): string {
    try {
      // marked handles incomplete markdown pretty well
      let html = marked.parse(currentFullText);

      // Add cursor if we detect incomplete formatting
      const hasUnclosedFormatting =
        this.detectUnclosedFormatting(currentFullText);
      if (hasUnclosedFormatting) {
        html = html.replace(
          /<\/p>$/,
          '<span class="streaming-cursor">▊</span></p>',
        );
      }

      return html;
    } catch (error) {
      // If marked fails on incomplete markdown, return escaped text
      console.warn("Marked parsing error during streaming:", error);
      return this.escapeHtml(currentFullText);
    }
  }

  /**
   * Detect if we have unclosed markdown formatting
   */
  private static detectUnclosedFormatting(text: string): boolean {
    // Check for odd number of formatting characters at the end
    const lastLine = text.split("\n").pop() || "";

    // Count unmatched markers
    const asterisks = (lastLine.match(/\*/g) || []).length;
    const underscores = (lastLine.match(/_/g) || []).length;
    const backticks = (lastLine.match(/`/g) || []).length;

    return (
      asterisks % 2 !== 0 ||
      underscores % 2 !== 0 ||
      backticks % 2 !== 0 ||
      lastLine.endsWith("[") || // Incomplete link
      lastLine.endsWith("](")
    ); // Incomplete link URL
  }

  /**
   * Strip HTML to plain text for search
   */
  static stripHTML(html: string): string {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.textContent || div.innerText || "";
  }

  /**
   * Escape HTML (backup utility)
   */
  static escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Configure marked for Foundry-specific rendering
   */
  static configureForFoundry(): void {
    // Create a custom renderer
    const renderer = new marked.Renderer();

    // Override link rendering to open in new tab
    renderer.link = (href, title, text) => {
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" ${title ? `title="${title}"` : ""}>${text}</a>`;
    };

    // Override code block rendering for better styling
    renderer.code = (code, language) => {
      return `<pre class="code-block"><code class="${language ? `language-${language}` : ""}">${code}</code></pre>`;
    };

    // Apply the custom renderer
    marked.setOptions({ renderer });
  }
}

// Initialize Foundry-specific configuration
MarkdownService.configureForFoundry();
