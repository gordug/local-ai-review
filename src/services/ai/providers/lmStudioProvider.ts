import { AIProviderConfig } from '../../../types/ai';

export class LMStudioProvider {
  /**
   * Discovers loaded models on the local LM Studio / LocalAI instance
   */
  async listModels(endpoint = 'http://127.0.0.1:1234/v1'): Promise<string[]> {
    try {
      const cleanEndpoint = endpoint.replace(/\/+$/, '');
      const res = await fetch(`${cleanEndpoint}/models`);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.data || []).map((m: any) => m.id);
    } catch {
      return [];
    }
  }

  /**
   * Generates completion with JSON schema
   */
  async generateJSON(
    config: AIProviderConfig,
    systemInstruction: string,
    prompt: string
  ): Promise<any> {
    const endpoint = (config.endpoint || 'http://127.0.0.1:1234/v1').replace(/\/+$/, '');
    const model = config.model || 'default';

    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: `${systemInstruction}\n\nIMPORTANT: Output strictly valid raw JSON with no markdown wrapping or preamble.` },
          { role: 'user', content: prompt },
        ],
        temperature: config.temperature ?? 0.2,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      throw new Error(`LM Studio Error (${response.status}): ${errorText || response.statusText}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content || '';
    // Strip markdown code fences if wrapped
    content = content.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
    return JSON.parse(content);
  }

  /**
   * Multi-turn chat
   */
  async chat(
    config: AIProviderConfig,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    const endpoint = (config.endpoint || 'http://127.0.0.1:1234/v1').replace(/\/+$/, '');
    const model = config.model || 'default';

    const response = await fetch(`${endpoint}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: config.temperature ?? 0.4,
      }),
    });

    if (!response.ok) {
      throw new Error(`LM Studio Chat Error (${response.status})`);
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  }
}

export const lmStudioProvider = new LMStudioProvider();
