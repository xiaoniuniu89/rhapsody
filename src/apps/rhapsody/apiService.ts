// services/apiService.ts
import type { Message, DeepSeekResponse } from "./types";
import { id as moduleId } from "../../../module.json";

export class ApiService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

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
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data: DeepSeekResponse = await response.json();
    return data.choices[0].message.content;
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