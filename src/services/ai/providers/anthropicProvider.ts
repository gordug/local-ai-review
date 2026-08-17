import { AIProviderConfig } from '../../../types/ai';

export class AnthropicProvider {
  async generateJSON(
    config: AIProviderConfig,
    systemInstruction: string,
    prompt: string
  ): Promise<any> {
    if (!config.apiKey) {
      throw new Error('Anthropic API key is missing.');
    }

    const model = config.model || 'claude-3-5-sonnet-latest';
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: config.maxTokens || 4096,
        system: `${systemInstruction}\n\nCRITICAL: Respond ONLY with a valid JSON object. No other text or explanation.`,
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature ?? 0.2,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `Anthropic API Error (${response.status})`);
    }

    const data = await response.json();
    let text = data.content?.[0]?.text || '';
    text = text.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
    return JSON.parse(text);
  }

  async chat(
    config: AIProviderConfig,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    if (!config.apiKey) {
      throw new Error('Anthropic API key is missing.');
    }

    const model = config.model || 'claude-3-5-sonnet-latest';
    const systemMsg = messages.find((m) => m.role === 'system');
    const conversation = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.apiKey.trim(),
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model,
        max_tokens: config.maxTokens || 4096,
        system: systemMsg?.content || 'You are an expert AI code reviewer.',
        messages: conversation,
        temperature: config.temperature ?? 0.4,
      }),
    });

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `Anthropic Chat Error (${response.status})`);
    }

    const data = await response.json();
    return data.content?.[0]?.text || '';
  }
}

export const anthropicProvider = new AnthropicProvider();
