import { AIProviderConfig } from '../../../types/ai';

export class OllamaProvider {
  /**
   * Discovers installed models on the local Ollama instance
   */
  async listModels(endpoint = 'http://127.0.0.1:11434'): Promise<string[]> {
    try {
      const cleanEndpoint = endpoint.replace(/\/+$/, '');
      const res = await fetch(`${cleanEndpoint}/api/tags`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.models || []).map((m: any) => m.name);
    } catch {
      return [];
    }
  }

  /**
   * Generate completion with JSON format
   */
  async generateJSON(
    config: AIProviderConfig,
    systemInstruction: string,
    prompt: string
  ): Promise<any> {
    const endpoint = (config.endpoint || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    const model = config.model || 'qwen2.5-coder:7b';

    const response = await fetch(`${endpoint}/api/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        system: systemInstruction,
        prompt,
        format: 'json',
        stream: false,
        options: {
          temperature: config.temperature ?? 0.2,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`Ollama Error (${response.status}): ${errorText || response.statusText}`);
    }

    const result = await response.json();
    const rawResponse = result.response;
    return JSON.parse(rawResponse);
  }

  /**
   * Multi-turn chat
   */
  async chat(
    config: AIProviderConfig,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    const endpoint = (config.endpoint || 'http://127.0.0.1:11434').replace(/\/+$/, '');
    const model = config.model || 'qwen2.5-coder:7b';

    const response = await fetch(`${endpoint}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        options: {
          temperature: config.temperature ?? 0.4,
        },
      }),
    });

    if (!response.ok) {
      throw new Error(`Ollama Chat Error (${response.status})`);
    }

    const data = await response.json();
    return data.message?.content || '';
  }
}

export const ollamaProvider = new OllamaProvider();
