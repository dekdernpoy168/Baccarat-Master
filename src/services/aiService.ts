import OpenAI from 'openai';
import { GoogleGenAI } from "@google/genai";

interface AiStatus {
  success: boolean;
  provider: string;
  configured: boolean;
  ready: boolean;
  message: string;
}

interface MetaDataResponse {
  meta_title: string;
  meta_description: string;
  tags: string[];
  excerpt_ai: string;
}

export class AiService {
  private provider: string;
  private apiKey: string;
  private openai: OpenAI | null = null;
  private gemini: GoogleGenAI | null = null;
  private cfOpenAI: OpenAI | null = null;

  constructor() {
    this.provider = process.env.AI_PROVIDER || 'openai';
    this.apiKey = this.getApiKey();
    this.initClient();
  }

  private getApiKey(): string {
    if (this.provider === 'openai') return process.env.OPENAI_API_KEY || '';
    if (this.provider === 'gemini') return process.env.GEMINI_API_KEY || '';
    if (this.provider === 'cloudflare') return process.env.CF_AI_TOKEN || '';
    return '';
  }

  private initClient() {
    if (!this.apiKey && this.provider !== 'cloudflare') return;
    
    if (this.provider === 'openai') {
      this.openai = new OpenAI({ apiKey: this.apiKey });
    } else if (this.provider === 'gemini') {
      this.gemini = new GoogleGenAI({ apiKey: this.apiKey });
    } else if (this.provider === 'cloudflare') {
      const accountId = process.env.CF_ACCOUNT_ID;
      const gatewaySlug = process.env.CF_AI_GATEWAY_SLUG || 'default';
      const apiToken = process.env.CF_AI_TOKEN;
      
      if (accountId && apiToken) {
        this.cfOpenAI = new OpenAI({
          apiKey: apiToken,
          baseURL: `https://gateway.ai.cloudflare.com/v1/${accountId}/${gatewaySlug}/workers-ai/v1`,
        });
      }
    }
  }

  async getStatus(): Promise<AiStatus> {
    const configured = !!this.apiKey;
    const ready = configured && (!!this.openai || !!this.gemini || !!this.cfOpenAI);
    
    return {
      success: ready,
      provider: this.provider,
      configured,
      ready,
      message: ready ? "AI พร้อมใช้งาน" : `${this.provider.toUpperCase()}_API_KEY or Cloudflare config is missing`
    };
  }

  async generateMetaData(title: string): Promise<MetaDataResponse> {
    const prompt = `คุณคือผู้เชี่ยวชาญ SEO ภาษาไทย จงสร้างข้อมูล Meta สำหรับบทความ: "${title}"
โดยตอบกลับเป็น JSON หนึ่งบรรทัดเท่านั้น ห้ามมีคำอธิบายอื่น:
{
  "meta_title": "หัวข้อที่ดึงดูดใจ (ไม่เกิน 60 ตัวอักษร)",
  "meta_description": "คำอธิบายเพื่อเรียกยอดคลิก (ไม่เกิน 160 ตัวอักษร)",
  "tags": ["tag1", "tag2", "tag3"],
  "excerpt_ai": "คำโปรยสั้นๆ สรุปเนื้อหา"
}`;

    const text = await this.callAI(prompt, true);
    return this.parseJson<MetaDataResponse>(text);
  }

  async generateTags(title: string): Promise<string[]> {
    const prompt = `จงสร้าง 5-8 แท็ก (Tags) ที่เกี่ยวข้องและเป็นที่นิยมสำหรับหัวข้อ: "${title}"
ตอบกลับเฉพาะเป็น JSON array ของ string เท่านั้น: ["tag1", "tag2", ...]`;
    
    const text = await this.callAI(prompt, true);
    const result = this.parseJson<any>(text);
    return Array.isArray(result) ? result : (result.tags || []);
  }

  async generateExcerpt(title: string): Promise<string[]> {
    const prompt = `จงสร้าง "คำโปรย" (Excerpt) ที่น่าสนใจ 3 แบบสำหรับบทความหัวข้อ: "${title}"
โดยแต่ละแบบยาวประมาณ 1-2 ประโยค
ตอบกลับเป็น JSON array ของ string เท่านั้น: ["แบบที่ 1", "แบบที่ 2", "แบบที่ 3"]`;

    const text = await this.callAI(prompt, true);
    const result = this.parseJson<any>(text);
    return Array.isArray(result) ? result : (result.options || result.excerpts || []);
  }

  private async callAI(prompt: string, isJson: boolean = false): Promise<string> {
    try {
      if (this.provider === 'openai' && this.openai) {
        const response = await this.openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          response_format: isJson ? { type: "json_object" } : { type: "text" },
        });
        return response.choices[0].message.content || '';
      } 

      if (this.provider === 'cloudflare' && this.cfOpenAI) {
        const response = await this.cfOpenAI.chat.completions.create({
          model: "@cf/meta/llama-3-8b-instruct",
          messages: [{ role: "user", content: prompt }],
        });
        return response.choices[0].message.content || '';
      }
      
      if (this.provider === 'gemini' && this.gemini) {
        const response = await this.gemini.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: [{ parts: [{ text: prompt }] }],
        });
        return response.text || '';
      }

      throw new Error("AI Provider is not configured or ready");
    } catch (error: any) {
      console.error(`AI Service Error (${this.provider}):`, error);
      throw new Error(`AI generation failed: ${error.message}`);
    }
  }

  private parseJson<T>(text: string): T {
    try {
      // Clean up potential markdown formatting
      const cleaned = text.replace(/```json\n?|\n?```/g, '').trim();
      return JSON.parse(cleaned) as T;
    } catch (e) {
      console.error("Failed to parse AI JSON response:", text);
      throw new Error("Invalid JSON format from AI");
    }
  }
}

export const aiService = new AiService();
