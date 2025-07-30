import type { Message, DeepSeekResponse } from "../types";

export class ApiService {
  public readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // Keep the original method for summaries
  async callDeepSeekAPI(userInput: string, messages: any[]): Promise<string> {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: false // Keep non-streaming for this method
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: DeepSeekResponse = await response.json();
    return data.choices[0].message.content;
  }

  // New streaming method for chat
  async *streamDeepSeekAPI(messages: any[]): AsyncGenerator<string, void, unknown> {
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages,
        temperature: 0.7,
        max_tokens: 1000,
        stream: true // Enable streaming
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      
      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices[0]?.delta?.content;
            if (content) {
              yield content;
            }
          } catch (e) {
            // Skip parsing errors
            console.warn('Failed to parse streaming data:', e);
          }
        }
      }
    }
  }

  async generateSummary(messages: Message[]): Promise<string> {
    const conversation = messages
      .filter(m => !m.isLoading && m.id !== 'summary-marker')
      .map(m => `${m.sender === 'user' ? 'Player' : 'GM'}: ${m.content}`)
      .join('\n');
    
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{
          role: 'user',
          content: `Summarize the key facts, events, and context from this RPG conversation. Focus on information that would be important for continuing the scene:\n\n${conversation}`
        }],
        temperature: 0.3,
        max_tokens: 500
      })
    });

    const data: DeepSeekResponse = await response.json();
    return data.choices[0].message.content;
  }

  async generateSceneSummary(messages: Message[], systemInfo: string): Promise<string> {
    const allMessages = messages
      .filter(m => !m.isLoading && m.id !== 'summary-marker')
      .map(m => `${m.sender === 'user' ? 'Player' : 'GM'}: ${m.content}`)
      .join('\n');
    
    const prompt = `Create a narrative summary of this ${systemInfo} RPG scene. Include:
    - What happened in the scene
    - Key NPCs introduced or interacted with
    - Important locations mentioned
    - Significant items or clues discovered
    - Any unresolved questions or hooks
    - Any ${systemInfo}-specific mechanics or rules that came up
    
    Format it as an engaging narrative summary that would be fun to read later.
    Keep it appropriate for ${systemInfo}'s tone and setting.
    
    Conversation:
    ${allMessages}`;
    
    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: [{
          role: 'user',
          content: prompt
        }],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    const data: DeepSeekResponse = await response.json();
    return data.choices[0].message.content;
  }
}