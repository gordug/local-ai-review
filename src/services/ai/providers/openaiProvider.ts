import { AIProviderConfig } from '../../../types/ai';

export class OpenAICompatibleProvider {
  private getEndpointAndHeaders(config: AIProviderConfig): { url: string; headers: Record<string, string> } {
    let url = 'https://api.openai.com/v1/chat/completions';
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (config.apiKey) {
      headers.Authorization = `Bearer ${config.apiKey.trim()}`;
    }

    switch (config.provider) {
      case 'groq':
        url = 'https://api.groq.com/openai/v1/chat/completions';
        break;
      case 'deepseek':
        url = 'https://api.deepseek.com/v1/chat/completions';
        break;
      case 'openrouter':
        url = 'https://openrouter.ai/api/v1/chat/completions';
        headers['HTTP-Referer'] = window.location.origin;
        headers['X-Title'] = 'RevFlow Local Review';
        break;
      case 'custom':
        if (config.endpoint) {
          url = config.endpoint.replace(/\/+$/, '');
          if (!url.endsWith('/chat/completions')) {
            url += '/chat/completions';
          }
        }
        break;
      case 'openai':
      default:
        url = 'https://api.openai.com/v1/chat/completions';
        break;
    }

    if (config.customHeaders) {
      Object.assign(headers, config.customHeaders);
    }

    return { url, headers };
  }

  async generateJSON(
    config: AIProviderConfig,
    systemInstruction: string,
    prompt: string
  ): Promise<any> {
    const { url, headers } = this.getEndpointAndHeaders(config);

    const isJsonResponseSupported = ['openai', 'groq', 'deepseek', 'openrouter'].includes(config.provider);
    const body: any = {
      model: config.model || (config.provider === 'groq' ? 'llama-3.3-70b-versatile' : 'gpt-4o-mini'),
      messages: [
        {
          role: 'system',
          content: `${systemInstruction}\n\nIMPORTANT: Output MUST be strictly valid JSON without markdown wrapping or commentary.`,
        },
        { role: 'user', content: prompt },
      ],
      temperature: config.temperature ?? 0.2,
    };

    if (isJsonResponseSupported && config.provider !== 'deepseek') {
      body.response_format = { type: 'json_object' };
    }

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `${config.provider.toUpperCase()} API Error (${res.status})`);
    }

    const data = await res.json();
    let content = data.choices?.[0]?.message?.content || '';
    content = content.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '').trim();
    return JSON.parse(content);
  }

  async chat(
    config: AIProviderConfig,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>
  ): Promise<string> {
    const { url, headers } = this.getEndpointAndHeaders(config);

    const body = {
      model: config.model || 'gpt-4o-mini',
      messages,
      temperature: config.temperature ?? 0.4,
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error?.message || `${config.provider.toUpperCase()} Chat Error (${res.status})`);
    }

    const data = await res.json();
    return data.choices?.[0]?.message?.content || '';
  }
}

export const openAICompatibleProvider = new OpenAICompatibleProvider();
