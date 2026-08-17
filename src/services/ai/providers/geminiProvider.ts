import { AIProviderConfig } from '../../../types/ai';

export class GeminiProvider {
  /**
   * Direct browser REST call to Google Gemini API
   */
  async generateJSON(
    config: AIProviderConfig,
    systemInstruction: string,
    prompt: string
  ): Promise<any> {
    if (!config.apiKey) {
      throw new Error('Gemini API key is missing. Please add your key in Settings.');
    }

    const model = config.model || 'gemini-2.5-flash';
    const cleanKey = config.apiKey.trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      systemInstruction: {
        parts: [{ text: systemInstruction }],
      },
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: config.temperature ?? 0.2,
      },
    };

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      const msg = errJson.error?.message || `Gemini API Error (${res.status})`;
      throw new Error(msg);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response received from Gemini.');

    return JSON.parse(text);
  }

  /**
   * Multi-turn chat
   */
  async chat(
    config: AIProviderConfig,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    if (!config.apiKey) {
      throw new Error('Gemini API key is missing.');
    }

    const model = config.model || 'gemini-2.5-flash';
    const cleanKey = config.apiKey.trim();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${cleanKey}`;

    const systemMsg = messages.find((m) => m.role === 'system');
    const conversation = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }],
      }));

    const payload: any = {
      contents: conversation,
      generationConfig: {
        temperature: config.temperature ?? 0.4,
      },
    };

    if (systemMsg) {
      payload.systemInstruction = {
        parts: [{ text: systemMsg.content }],
      };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `Gemini Chat Error (${res.status})`);
    }

    const data = await res.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  }
}

export const geminiProvider = new GeminiProvider();
