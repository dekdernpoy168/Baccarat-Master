import OpenAI from 'openai';
import { GoogleGenAI } from "@google/genai";

interface AiStatus {
  success: boolean;
  provider: string;
  configured: boolean;
  ready: boolean;
  fallback: string;
  message?: string;
}

interface MetaDataResponse {
  meta_title: string;
  meta_description: string;
  tags: string[];
  excerpt_ai: string;
}

export class AiService {
  private primaryProvider: string;
  private openai: OpenAI | null = null;
  private gemini: GoogleGenAI | null = null;

  constructor() {
    this.primaryProvider = process.env.AI_PROVIDER === 'gemini' ? 'gemini' : 'openai';
    this.initClients();
  }

  private initClients() {
    const openaiKey = process.env.OPENAI_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (openaiKey) {
      this.openai = new OpenAI({ apiKey: openaiKey });
    }
    if (geminiKey) {
      this.gemini = new GoogleGenAI({ apiKey: geminiKey });
    }
  }

  async getAiStatus(): Promise<AiStatus> {
    const openaiReady = !!this.openai;
    const geminiReady = !!this.gemini;
    
    // Check if the primary provider (default is openai) is ready
    const isPrimaryReady = this.primaryProvider === 'openai' ? openaiReady : geminiReady;
    
    if (isPrimaryReady) {
      return {
        success: true,
        provider: this.primaryProvider,
        configured: true,
        ready: true,
        fallback: this.primaryProvider === 'openai' ? 'gemini' : 'openai'
      };
    } else {
      const missingKey = this.primaryProvider === 'openai' ? 'OPENAI_API_KEY' : 'GEMINI_API_KEY';
      return {
        success: false,
        provider: this.primaryProvider,
        configured: false,
        ready: false,
        fallback: this.primaryProvider === 'openai' ? 'gemini' : 'openai',
        message: `${missingKey} is missing`
      };
    }
  }

  async generateMetaData(title: string): Promise<{ success: boolean; provider: string; data: MetaDataResponse }> {
    const prompt = `You are a Thai SEO Specialist. Generate SEO meta data for the article: "${title}"
    Return ONLY a single-line JSON object without any additional explanation:
    {
      "meta_title": "Attractive title (max 60 characters)",
      "meta_description": "Click-worthy description (max 160 characters)",
      "tags": ["tag1", "tag2", "tag3"],
      "excerpt_ai": "Short engaging summary/excerpt"
    }`;

    const { text, provider } = await this.callAIWithFallback(prompt, true);
    return { success: true, provider, data: this.parseJson<MetaDataResponse>(text) };
  }

  async generateTags(title: string): Promise<{ success: boolean; provider: string; tags: string[] }> {
    const prompt = `Generate 5-8 relevant and trending SEO tags for the topic: "${title}"
    Respond ONLY as a JSON array of strings: ["tag1", "tag2", ...]`;
    
    const { text, provider } = await this.callAIWithFallback(prompt, true);
    const result = this.parseJson<any>(text);
    const tags = Array.isArray(result) ? result : (result.tags || []);
    return { success: true, provider, tags };
  }

  async generateExcerpt(title: string): Promise<{ success: boolean; provider: string; options: string[] }> {
    const prompt = `Generate 3 engaging "Excerpts" (Meta Descriptions) for the article topic: "${title}"
    Each version should be 1-2 sentences long.
    Respond ONLY as a JSON array of strings: ["option 1", "option 2", "option 3"]`;

    const { text, provider } = await this.callAIWithFallback(prompt, true);
    const result = this.parseJson<any>(text);
    const options = Array.isArray(result) ? result : (result.options || result.excerpts || []);
    return { success: true, provider, options };
  }

  async generateSlug(title: string): Promise<{ success: boolean; provider: string; options: string[] }> {
    const prompt = `Generate suitable English URL Slugs for the article title: "${title}" 
    Provide 4 different options focused on SEO and conciseness.
    Respond ONLY as a JSON array of strings: ["slug-1", "slug-2", "slug-3", "slug-4"]`;

    const { text, provider } = await this.callAIWithFallback(prompt, true);
    const result = this.parseJson<any>(text);
    const options = Array.isArray(result) ? result : (result.options || result.slugs || []);
    return { success: true, provider, options };
  }

  private async callAIWithFallback(prompt: string, isJson: boolean = false): Promise<{ text: string; provider: string }> {
    const providers = this.primaryProvider === 'openai' ? ['openai', 'gemini'] : ['gemini', 'openai'];
    const errors: string[] = [];

    for (const provider of providers) {
      try {
        if (provider === 'openai' && this.openai) {
          const response = await this.openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: isJson ? { type: "json_object" } : { type: "text" },
          });
          const content = response.choices[0].message.content || '';
          return { text: content, provider: 'openai' };
        }

        if (provider === 'gemini' && this.gemini) {
          const response = await this.gemini.models.generateContent({
            model: "gemini-1.5-flash-latest",
            contents: [{ parts: [{ text: prompt }] }],
          });
          const content = response.text || '';
          return { text: content, provider: 'gemini' };
        }
      } catch (error: any) {
        errors.push(`${provider}: ${error.message}`);
        console.warn(`AI Provider ${provider} failed, trying next... Error:`, error.message);
      }
    }

    throw {
      success: false,
      message: "AI temporary unavailable. Please fill in manually.",
      errors
    };
  }

  private parseJson<T>(text: string): T {
    try {
      const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned) as T;
    } catch (e) {
      console.error("Failed to parse AI JSON response:", text);
      throw new Error("Invalid JSON format from AI");
    }
  }
}

export const aiService = new AiService();
