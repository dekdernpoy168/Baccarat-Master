import 'dotenv/config';
import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { createServer } from "http";
import { Server } from "socket.io";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import multer from "multer";
import { S3Client, PutObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { exec, query } from './src/db.js';
import { db } from './src/db/index.js';
import { users } from './src/db/schema.js';
import { initSchema } from './src/initSchema.js';
import usersApi from './src/api/users.js';
import { GoogleGenAI, Type } from "@google/genai";
import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { z } from "zod";
import { betaZodTool } from "@anthropic-ai/sdk/helpers/beta/zod";

// Database-backed API configuration
let aiConfigCache: any = null;
let lastCacheTime = 0;

async function getAiProvidersConfig() {
  if (aiConfigCache && Date.now() - lastCacheTime < 5000) {
    return aiConfigCache;
  }
  try {
    const rows = await query("SELECT value FROM settings WHERE key = 'ai_providers'");
    if (rows && rows.length > 0) {
      aiConfigCache = JSON.parse(rows[0].value);
      lastCacheTime = Date.now();
      return aiConfigCache;
    }
  } catch (err) {
    console.error("Error reading ai_providers from DB:", err);
  }
  return {};
}

async function saveAiProvidersConfig(config: any) {
  try {
    const val = JSON.stringify(config);
    await exec(
      `INSERT INTO settings (key, value, updated_at) VALUES ('ai_providers', ?, datetime('now'))
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')`,
      [val]
    );
    aiConfigCache = config;
    lastCacheTime = Date.now();
    return true;
  } catch (err) {
    console.error("Error writing ai_providers to DB:", err);
    return false;
  }
}

// Helper to get API key (prefers config file, falls back to env)
async function getApiKey(provider: string) {
  const config = await getAiProvidersConfig();
  if (config[provider] && config[provider].apiKey) {
    return config[provider].apiKey;
  }
  
  if (provider === 'openai') return process.env.OPENAI_API_KEY;
  if (provider === 'anthropic') return process.env.ANTHROPIC_API_KEY;
  if (provider === 'gemini') return process.env.GEMINI_API_KEY;
  if (provider === 'deepseek') return process.env.DEEPSEEK_API_KEY;
  if (provider === 'groq') return process.env.GROQ_API_KEY;
  if (provider === 'grok') return process.env.XAI_API_KEY;
  
  return undefined;
}

// Configure R2 Client
const r2Client = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT || `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

// Configure Multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
});

// Configure OpenAI Client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy",
});

// Configure Anthropic Client
// const anthropic = new Anthropic({
//   apiKey: process.env.ANTHROPIC_API_KEY || "dummy",
//   defaultHeaders: {
//     "anthropic-beta": "mcp-client-2025-11-20,message-batches-2024-09-24"
//   }
// });

// Define AI Tools
const keywordTool = betaZodTool({
  name: "get_keywords",
  description: "Get SEO keywords and search volume for a given topic using Keywords Everywhere API",
  inputSchema: z.object({
    keyword: z.string().describe("The main keyword to research"),
    country: z.string().optional().default("th").describe("Country code (e.g., th, us)"),
  }),
  run: async ({ keyword, country }) => {
    if (!process.env.KEYWORDS_EVERYWHERE_API_KEY) {
      return "Keywords Everywhere API key is not configured.";
    }
    try {
      const response = await fetch(`https://api.keywordseverywhere.com/v1/get_keyword_data`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.KEYWORDS_EVERYWHERE_API_KEY}`,
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: new URLSearchParams({
          'dataSource': 'gkp',
          'country': country,
          'currency': 'THB',
          'kw[]': keyword
        })
      });
      const data = await response.json();
      return JSON.stringify(data);
    } catch (error: any) {
      return `Error fetching keywords: ${error.message}`;
    }
  }
});

const articleCheckTool = betaZodTool({
  name: "check_existing_articles",
  description: "Check if articles with similar titles already exist in the database",
  inputSchema: z.object({
    query: z.string().describe("Search query for article titles"),
  }),
  run: async ({ query: searchQuery }) => {
    try {
      const results = await query(`SELECT id, title, slug FROM articles WHERE title LIKE ? LIMIT 5`, [`%${searchQuery}%`]);
      return JSON.stringify(results);
    } catch (error: any) {
      return `Error checking articles: ${error.message}`;
    }
  }
});

interface McpServerConfig {
  name: string;
  url: string;
  token?: string;
}

async function callAI(prompt: string, options: { json?: boolean, schema?: any, useTools?: boolean, mcpServers?: McpServerConfig[], preferredProvider?: 'openai' | 'anthropic' | 'gemini' | 'deepseek' | 'groq' | 'grok' | 'ollama', returnProvider?: boolean } = {}) {
  const config = await getAiProvidersConfig();
  
  const hasOpenAI = (config.openai?.enabled && await getApiKey('openai')) || (process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "dummy");
  const hasAnthropic = (config.anthropic?.enabled && await getApiKey('anthropic')) || (process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "dummy");
  const hasGemini = (config.gemini?.enabled && await getApiKey('gemini')) || (process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "dummy");
  const hasDeepseek = config.deepseek?.enabled && await getApiKey('deepseek');
  const hasGroq = config.groq?.enabled && await getApiKey('groq');
  const hasGrok = (config.grok?.enabled && await getApiKey('grok')) || !!process.env.XAI_API_KEY;
  const hasOllama = config.ollama?.enabled;

  // Determine order of providers based on preference and availability
  let providers: ('openai' | 'anthropic' | 'gemini' | 'deepseek' | 'groq' | 'grok' | 'ollama')[] = [];
  
  if (options.preferredProvider) {
    providers.push(options.preferredProvider);
  }
  
  // Add remaining available providers as fallbacks (DeepSeek > Gemini > Groq > Grok > Anthropic > OpenAI > Ollama)
  if (hasDeepseek && !providers.includes('deepseek')) providers.push('deepseek');
  if (hasGemini && !providers.includes('gemini')) providers.push('gemini');
  if (hasGroq && !providers.includes('groq')) providers.push('groq');
  if (hasGrok && !providers.includes('grok')) providers.push('grok');
  if (hasAnthropic && !providers.includes('anthropic')) providers.push('anthropic');
  if (hasOpenAI && !providers.includes('openai')) providers.push('openai');
  if (hasOllama && !providers.includes('ollama')) providers.push('ollama');

  if (providers.length === 0) {
    throw new Error("No AI providers are configured.");
  }

  let lastError: any = null;

  interface AIProviderOptions {
  json?: boolean;
  schema?: any;
  returnProvider?: boolean;
  preferredProvider?: string;
}

const parseJsonFallback = (text: string, provider: string, options: AIProviderOptions) => {
    if (!options.json) return text;
    try {
      return JSON.parse(text);
    } catch (e) {
      console.warn(`${provider} JSON parse failed, trying to extract JSON from:`, text.substring(0, 100) + '...');
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) {
          try {
             const parsed = JSON.parse(jsonMatch[0]);
             return parsed;
          } catch (innerError) {
             console.error("Inner JSON parse failed during extraction:", innerError);
             throw new Error(`Failed to parse extracted JSON from ${provider}`);
          }
      }
      throw new Error(`Failed to parse JSON from ${provider}`);
    }
  };

  for (const provider of providers) {
    try {
      if (provider === 'openai') {
        const apiKey = await getApiKey('openai') || process.env.OPENAI_API_KEY;
        const openaiClient = new OpenAI({ apiKey });
        
        let finalPrompt = prompt;
        if (options.json) {
          if (!prompt.toLowerCase().includes('json')) {
            finalPrompt += '\n\nPlease return the response in JSON format.';
          }
          if (options.schema) {
            finalPrompt += `\n\nExpected JSON structure:\n${JSON.stringify(options.schema, null, 2)}`;
          }
        }
        const response = await openaiClient.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: finalPrompt }],
          response_format: options.json ? { type: "json_object" } : { type: "text" },
        });
        console.log("OpenAI Usage:", response.usage);
        const text = response.choices[0].message.content || (options.json ? "{}" : "");
        const parsed = parseJsonFallback(text, provider, options);
        return options.returnProvider ? { data: parsed, provider } : parsed;
      } 
      
      else if (provider === 'anthropic') {
        const apiKey = await getApiKey('anthropic') || process.env.ANTHROPIC_API_KEY;
        const anthropicClient = new Anthropic({ apiKey, defaultHeaders: { "anthropic-beta": "prompt-caching-2024-07-31" } });
        
        let systemPrompt = options.json ? "Return ONLY a valid JSON object. No other text." : "";
        let finalPrompt = prompt;
        if (options.json && options.schema) {
          finalPrompt += `\n\nExpected JSON structure:\n${JSON.stringify(options.schema, null, 2)}`;
        }
        
        const anthropicParams: any = {
          max_tokens: 4096,
          system: systemPrompt,
          messages: [{ role: "user", content: finalPrompt }],
          model: "claude-3-5-sonnet-20241022",
        };

        if (options.mcpServers && options.mcpServers.length > 0) {
          anthropicParams.mcp_servers = options.mcpServers.map(s => ({
            type: "url",
            url: s.url,
            name: s.name,
            authorization_token: s.token
          }));
          anthropicParams.tools = options.mcpServers.map(s => ({
            type: "mcp_toolset",
            mcp_server_name: s.name
          }));
        }

        if (options.useTools && !options.mcpServers) {
          const finalMessage = await anthropicClient.beta.messages.toolRunner({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 4096,
            messages: [{ role: "user", content: finalPrompt }],
            tools: [keywordTool, articleCheckTool],
          });
          console.log("Anthropic Tool Usage:", finalMessage.usage);
          const text = finalMessage.content[0].type === 'text' ? finalMessage.content[0].text : "";
          const parsed = options.json ? JSON.parse(text) : text;
          return options.returnProvider ? { data: parsed, provider } : parsed;
        }

        const message = await anthropicClient.messages.create(anthropicParams);
        console.log("Anthropic Usage:", message.usage);
        const text = message.content[0].type === 'text' ? message.content[0].text : "";
        
        if (options.json) {
          const parsed = parseJsonFallback(text, provider, options);
          return options.returnProvider ? { data: parsed, provider } : parsed;
        } else {
          return options.returnProvider ? { data: text, provider } : text;
        }
      }

      else if (provider === 'gemini') {
        const apiKey = await getApiKey('gemini') || process.env.GEMINI_API_KEY;
        const genAI = new GoogleGenAI({ apiKey: apiKey || "" });
        
        // Dynamically get the model name from config, fallback to gemini-1.5-flash
        const modelName = config.gemini?.models?.[0] || "gemini-1.5-flash";
        
        const modelParams: any = {
          model: modelName,
          contents: [{ role: "user", parts: [{ text: prompt }] }],
        };
        
        if (options.json) {
          modelParams.config = {
            responseMimeType: "application/json",
            responseSchema: options.schema
          };
        }

        const result: any = await genAI.models.generateContent(modelParams);
        console.log(`Gemini (${modelName}) Usage:`, result.usageMetadata);
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text || (options.json ? "{}" : "");
        const parsed = parseJsonFallback(text, provider, options);
        return options.returnProvider ? { data: parsed, provider } : parsed;
      }
      
      else if (provider === 'deepseek') {
        const apiKey = await getApiKey('deepseek');
        const baseURL = config.deepseek?.proxyUrl || "https://api.deepseek.com/v1";
        const deepseekClient = new OpenAI({ apiKey, baseURL });
        
        let finalPrompt = prompt;
        if (options.json) {
          if (!prompt.toLowerCase().includes('json')) {
            finalPrompt += '\n\nPlease return the response in JSON format.';
          }
          if (options.schema) {
            finalPrompt += `\n\nExpected JSON structure:\n${JSON.stringify(options.schema, null, 2)}`;
          }
        }
        const response = await deepseekClient.chat.completions.create({
          model: "deepseek-chat",
          messages: [{ role: "user", content: finalPrompt }],
          response_format: options.json ? { type: "json_object" } : { type: "text" },
        });
        const text = response.choices[0].message.content || (options.json ? "{}" : "");
        const parsed = parseJsonFallback(text, provider, options);
        return options.returnProvider ? { data: parsed, provider } : parsed;
      }
      
      else if (provider === 'groq') {
        const apiKey = await getApiKey('groq');
        const baseURL = config.groq?.proxyUrl || "https://api.groq.com/openai/v1";
        const groqClient = new OpenAI({ apiKey, baseURL });
        
        let finalPrompt = prompt;
        if (options.json) {
          if (!prompt.toLowerCase().includes('json')) {
            finalPrompt += '\n\nPlease return the response in JSON format.';
          }
          if (options.schema) {
            finalPrompt += `\n\nExpected JSON structure:\n${JSON.stringify(options.schema, null, 2)}`;
          }
        }
        const response = await groqClient.chat.completions.create({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: finalPrompt }],
          response_format: options.json ? { type: "json_object" } : { type: "text" },
        });
        const text = response.choices[0].message.content || (options.json ? "{}" : "");
        const parsed = parseJsonFallback(text, provider, options);
        return options.returnProvider ? { data: parsed, provider } : parsed;
      }
      
      else if (provider === 'grok') {
        const apiKey = await getApiKey('grok') || process.env.XAI_API_KEY;
        const baseURL = config.grok?.proxyUrl || "https://api.x.ai/v1";
        const grokClient = new OpenAI({ apiKey, baseURL });
        
        let finalPrompt = prompt;
        if (options.json) {
          if (!prompt.toLowerCase().includes('json')) {
            finalPrompt += '\n\nPlease return the response in JSON format.';
          }
          if (options.schema) {
            finalPrompt += `\n\nExpected JSON structure:\n${JSON.stringify(options.schema, null, 2)}`;
          }
        }
        
        // We use the OpenAI SDK to connect to x.ai since x.ai provides OpenAI compatible endpoints
        const response = await grokClient.chat.completions.create({
          model: "grok-2", 
          messages: [{ role: "user", content: finalPrompt }]
        });
        const text = response.choices[0].message.content || (options.json ? "{}" : "");
        const parsed = parseJsonFallback(text, provider, options);
        return options.returnProvider ? { data: parsed, provider } : parsed;
      }
      
      else if (provider === 'ollama') {
        const baseURL = config.ollama?.proxyUrl || "http://localhost:11434/v1";
        const ollamaClient = new OpenAI({ apiKey: "ollama", baseURL });
        
        let finalPrompt = prompt;
        if (options.json) {
          if (!prompt.toLowerCase().includes('json')) {
            finalPrompt += '\n\nPlease return the response in JSON format.';
          }
          if (options.schema) {
            finalPrompt += `\n\nExpected JSON structure:\n${JSON.stringify(options.schema, null, 2)}`;
          }
        }
        const response = await ollamaClient.chat.completions.create({
          model: "deepseek-r1",
          messages: [{ role: "user", content: finalPrompt }],
          response_format: options.json ? { type: "json_object" } : { type: "text" },
        });
        const text = response.choices[0].message.content || (options.json ? "{}" : "");
        const parsed = parseJsonFallback(text, provider, options);
        return options.returnProvider ? { data: parsed, provider } : parsed;
      }
    } catch (error: any) {
      console.warn(`${provider} failed:`, error.message);
      lastError = error;
      // Continue to the next provider in the loop
    }
  }

  // If we get here, all providers failed
  console.error("All AI providers failed. Last error:", lastError?.message);
  throw new Error(`AI generation failed: ${lastError?.message || "Unknown error"}`);
}

async function* streamAI(prompt: string) {
  try {
    if (process.env.ANTHROPIC_API_KEY) {
      const stream = anthropic.messages.stream({
        max_tokens: 4096,
        messages: [{ role: "user", content: prompt }],
        model: "claude-3-opus-20240229",
      });

      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          yield chunk.delta.text;
        }
      }
      return;
    }

    const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
    const result: any = await genAI.models.generateContent({
      model: "gemini-1.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = result.candidates?.[0]?.content?.parts?.[0]?.text || "";
    yield text;
  } catch (error: any) {
    console.warn("Streaming AI Error, falling back to OpenAI:", error.message);
    
    if (process.env.OPENAI_API_KEY) {
      const stream = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || "";
        yield content;
      }
    } else {
      throw error;
    }
  }
}

async function startServer() {
  const server = express();
  const httpServer = createServer(server);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    },
    pingTimeout: 60000,
    pingInterval: 25000,
    connectTimeout: 45000
  });

  server.use(cors());
  server.use(express.json({ limit: '50mb' }));
  server.use('/api/users', usersApi);

  // Cloudflare AI Integration
const cfOpenAI = new OpenAI({
  apiKey: process.env.CLOUDFLARE_AI_TOKEN || "unused",
  baseURL: `https://api.cloudflare.com/client/v4/accounts/${process.env.CLOUDFLARE_ACCOUNT_ID}/ai/v1`,
});

// Diagnostics route to test Cloudflare AI
server.get("/api/ai/test-cf", async (req, res) => {
  try {
    const chatCompletion = await cfOpenAI.chat.completions.create({
      messages: [{ role: "user", content: "Hello, just a quick test." }],
      model: "@cf/meta/llama-3.1-8b-instruct",
    });
    res.json({ status: "success", result: chatCompletion });
  } catch (error: any) {
    console.error("Cloudflare Diagnostic Error:", error);
    res.status(500).json({ status: "error", message: error.message });
  }
});

// AI Proxy Routes
server.post("/api/ai/run-cf", async (req, res) => {
  try {
    const { model, messages } = req.body;
    const chatCompletion = await cfOpenAI.chat.completions.create({
      messages,
      model,
    });
    res.json(chatCompletion);
  } catch (error: any) {
    console.error("Cloudflare AI Error:", error);
    res.status(500).json({ error: error.message });
  }
});

server.post("/api/ai/generate-meta-data", async (req, res) => {
    try {
      const { title } = req.body;
      const prompt = `คุณคือผู้เชี่ยวชาญ SEO ภาษาไทย รับรายชื่อหัวข้อบทความต่อไปนี้ แล้วตอบกลับเป็น JSON ที่ระบุเท่านั้น \`{ "meta_title": "...", "meta_description": "...", "tags": ["..."], "excerpt_ai": "..." }\` เน้น Keyword บาคาร่า และความเชื่อมั่น ห้ามมีคำฟุ่มเฟือย ความยาว Meta Description ต้องไม่เกิน 160 ตัวอักษร
ชื่อบทความ: "${title}"
โครงสร้าง JSON ตามที่กำหนด (ต้องตอบแค่นี้เท่านั้น ห้ามมีคำอธิบาย):
{
  "meta_title": "...",
  "meta_description": "...",
  "tags": ["...", "..."],
  "excerpt_ai": "เขียนสรุปบทความเป็นสไตล์ AI Overview (70-100 คำ) โดยเน้นการตอบคำถามที่ผู้ใช้สงสัยทันที เพื่อใช้ชิงพื้นที่ Featured Snippet บน Google"
}`;

      const result = await callAI(prompt, {
        json: true,
        returnProvider: true,
        preferredProvider: 'openai'
      });
      res.json(result);
    } catch (error: any) {
      console.error("Meta Gen Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.get("/api/ai/providers", async (req, res) => {
    const config = await getAiProvidersConfig();
    
    // Add default providers from env if not in config
    if (!config.openai) config.openai = { enabled: !!process.env.OPENAI_API_KEY, apiKey: process.env.OPENAI_API_KEY || '', proxyUrl: '', models: ['gpt-4o-mini', 'gpt-4o'] };
    if (!config.anthropic) config.anthropic = { enabled: !!process.env.ANTHROPIC_API_KEY, apiKey: process.env.ANTHROPIC_API_KEY || '', proxyUrl: '', models: ['claude-3-5-sonnet-20241022'] };
    if (!config.gemini) config.gemini = { enabled: !!process.env.GEMINI_API_KEY, apiKey: process.env.GEMINI_API_KEY || '', proxyUrl: '', models: ['gemini-2.5-flash', 'gemini-2.5-pro'] };
    if (!config.grok) config.grok = { enabled: !!process.env.XAI_API_KEY, apiKey: process.env.XAI_API_KEY || '', proxyUrl: 'https://api.x.ai/v1', models: ['grok-4.20-reasoning', 'grok-beta'] };
    
    // Mask API keys for security before sending to client
    const maskedConfig = { ...config };
    for (const provider in maskedConfig) {
      if (maskedConfig[provider].apiKey) {
        const key = maskedConfig[provider].apiKey;
        maskedConfig[provider].apiKey = key.substring(0, 4) + '*'.repeat(Math.max(0, key.length - 8)) + key.substring(key.length - 4);
      }
    }
    res.json(maskedConfig);
  });

  server.put("/api/ai/providers", async (req, res) => {
    const newConfig = req.body;
    const currentConfig = await getAiProvidersConfig();
    
    // Merge configs, preserving actual API keys if the new one is masked
    for (const provider in newConfig) {
      if (currentConfig[provider] && newConfig[provider].apiKey && newConfig[provider].apiKey.includes('*')) {
        newConfig[provider].apiKey = currentConfig[provider].apiKey;
      }
    }
    
    if (await saveAiProvidersConfig(newConfig)) {
      res.json({ success: true });
    } else {
      res.status(500).json({ error: "Failed to save configuration" });
    }
  });

  server.post("/api/ai/test-connection", async (req, res) => {
    const { provider, apiKey, proxyUrl } = req.body;
    
    if (!apiKey && provider !== 'ollama') {
      return res.status(400).json({ success: false, error: "API key is required" });
    }

    try {
      if (provider === 'openai') {
        const openaiClient = new OpenAI({ apiKey, baseURL: proxyUrl || undefined });
        await openaiClient.models.list();
        return res.json({ success: true });
      } 
      else if (provider === 'anthropic') {
        const anthropicClient = new Anthropic({ apiKey, baseURL: proxyUrl || undefined });
        // Anthropic doesn't have a simple models.list, so we do a minimal completion
        await anthropicClient.messages.create({
          model: "claude-3-haiku-20240307",
          max_tokens: 1,
          messages: [{ role: "user", content: "Hi" }]
        });
        return res.json({ success: true });
      }
      else if (provider === 'gemini') {
        const genAI = new GoogleGenAI({ apiKey });
        // Minimal call to test key
        const result = await genAI.models.generateContent({
          model: "gemini-1.5-flash",
          contents: [{ role: "user", parts: [{ text: "Hi" }] }],
        });
        return res.json({ success: true });
      }
      else if (provider === 'deepseek') {
        const deepseekClient = new OpenAI({ apiKey, baseURL: proxyUrl || "https://api.deepseek.com/v1" });
        await deepseekClient.models.list();
        return res.json({ success: true });
      }
      else if (provider === 'groq') {
        const groqClient = new OpenAI({ apiKey, baseURL: proxyUrl || "https://api.groq.com/openai/v1" });
        await groqClient.models.list();
        return res.json({ success: true });
      }
      else if (provider === 'grok') {
        const grokClient = new OpenAI({ apiKey, baseURL: proxyUrl || "https://api.x.ai/v1" });
        await grokClient.models.list();
        return res.json({ success: true });
      }
      else if (provider === 'ollama') {
        const ollamaClient = new OpenAI({ apiKey: "ollama", baseURL: proxyUrl || "http://localhost:11434/v1" });
        await ollamaClient.models.list();
        return res.json({ success: true });
      }
      
      return res.status(400).json({ success: false, error: "Unknown provider" });
    } catch (error: any) {
      console.error(`Connection test failed for ${provider}:`, error.message);
      return res.status(400).json({ success: false, error: error.message || "Connection failed" });
    }
  });

  server.post("/api/ai/generate-keywords", async (req, res) => {
    try {
      const { primaryKeyword, count } = req.body;
      const prompt = `Generate ${count || 10} secondary keywords (คีย์รอง) related to the primary keyword: "${primaryKeyword}". 
      Return ONLY the keywords as a comma-separated list. No other text.`;
      
      const text = await callAI(prompt);
      res.json({ text });
    } catch (error: any) {
      console.error("AI Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/generate-slug", async (req, res) => {
    try {
      const { title } = req.body;
      const prompt = `Generate 4 SEO-friendly URL slug options for this article title: "${title}". ALL 4 options MUST be in English Language (using English letters and hyphens). Use only lowercase characters and hyphens. Do not use any spaces.`;
      const data = await callAI(prompt, {
        json: true,
        preferredProvider: 'openai',
        schema: {
          type: Type.OBJECT,
          properties: {
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["options"]
        }
      });
      res.json(data);
    } catch (error: any) {
      console.error("Slug Gen Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/grok-brainstorm", async (req, res) => {
    try {
      const { keyword } = req.body;
      const prompt = `ให้ Grok วิเคราะห์กระแสล่าสุดจาก X (Twitter) เกี่ยวกับ Keyword นี้: "${keyword}" แล้วเสนอชื่อหัวข้อที่ดึงดูดใจ (Clickbait) มาให้ 3 แบบรูปแบบ JSON { "topics": ["หัวข้อที่ 1", "หัวข้อที่ 2", "หัวข้อที่ 3"] }`;
      
      const result = await callAI(prompt, {
        json: true,
        preferredProvider: 'grok',
        returnProvider: true
      });
      res.json(result);
    } catch (error: any) {
      console.error("Grok Brainstorm Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/generate-excerpt", async (req, res) => {
    try {
      const { title } = req.body;
      const prompt = `เขียนคำโปรย (Excerpt) แบบ AI Overview สำหรับบทความหัวข้อ: "${title}". 
      ข้อกำหนด:
      - เขียนสรุปเนื้อหาสั้นๆ กระชับ ตอบโจทย์สิ่งที่ผู้ใช้ค้นหาทันที
      - ใช้ภาษาที่เป็นธรรมชาติ ทันสมัย เหมือน AI สรุปข้อมูล
      - ทำมา 3 ตัวเลือกที่แตกต่างกัน
      - ความยาวไม่เกิน 100 คำต่อตัวเลือก
      - ตอบกลับเป็น JSON เท่านั้นในรูปแบบ { "options": ["ตัวเลือกที่ 1", "ตัวเลือกที่ 2", "ตัวเลือกที่ 3"] }`;
      const data = await callAI(prompt, {
        json: true,
        schema: {
          type: Type.OBJECT,
          properties: {
            options: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["options"]
        }
      });
      res.json(data);
    } catch (error: any) {
      console.error("Excerpt Gen Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/generate-faq", async (req, res) => {
    try {
      const { title, content } = req.body;
      const cleanContent = content ? content.replace(/<[^>]*>?/gm, '').substring(0, 2000) : "";
      
      const prompt = `สร้างคำถามที่พบบ่อย (FAQ) และคำตอบ 3 ข้อสำหรับบทความนี้:
หัวข้อ: ${title}
เนื้อความ (แบบย่อ): ${cleanContent}
หากไม่มีเนื้อหา ให้สร้างจากหัวข้อแทน ตอบกลับเป็น JSON เท่านั้น
{
  "faqs": [
    { "question": "?", "answer": "..." }
  ]
}
`;
      const data = await callAI(prompt, {
        json: true,
        schema: {
          type: Type.OBJECT,
          properties: {
            faqs: {
              type: Type.ARRAY,
              items: { 
                 type: Type.OBJECT,
                 properties: {
                    question: { type: Type.STRING },
                    answer: { type: Type.STRING }
                 },
                 required: ["question", "answer"]
              }
            }
          },
          required: ["faqs"]
        }
      });
      res.json(data);
    } catch (error: any) {
      console.error("FAQ Gen Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/generate-article", async (req, res) => {
    try {
      const { prompt: userAiPrompt } = req.body;
      const systemPrompt = `คุณคือผู้เชี่ยวชาญด้านการเขียนบทความ SEO และการพนันออนไลน์ (บาคาร่า) ที่มีประสบการณ์จริง เขียนด้วยภาษาที่อ่านง่าย สื่อสารได้ใจความ ไม่ซับซ้อน มีความเป็นมนุษย์ มีมุมมองเฉพาะตัวเหมือนคนเขียนจริงๆ ไม่ใช่หุ่นยนต์`;
      const fullPrompt = `${systemPrompt}\n\nโจทย์/คีย์เวิร์ด: ${userAiPrompt}

ข้อกำหนด:
- เขียนเนื้อหาบทความในรูปแบบ HTML (ใช้ <h2>, <p>, <ul>, <li>, <strong>)
- **ห้ามใส่ลิงก์ (<a>) ในหัวข้อ (<h2>, <h3>) เด็ดขาด** ให้ใส่ลิงก์แทรกในเนื้อหาปกติเท่านั้น
- **ความยาวของเนื้อหาบทความต้องอยู่ระหว่าง 1000 - 1500 คำ** (เน้นเนื้อหาที่เจาะลึกและมีประโยชน์)
- นำคีย์เวิร์ดที่เกี่ยวข้องมาแทรกในเนื้อหาและติดตัวหนา (<strong>) ไว้ด้วย
- เน้นความแม่นยำของข้อมูล
- **Meta Title: ห้ามเกิน 60 ตัวอักษร**
- **Meta Description: ห้ามเกิน 160 ตัวอักษร**
- **URL Slug: ภาษาอังกฤษเท่านั้น ใช้ - แทนช่องว่าง**
- **ที่ท้ายบทความ ต้องมีส่วน Call to Action (CTA) โดยใช้โครงสร้าง HTML นี้เสมอ:**
  <div class="cta-block">
    <h3>สนใจนำเทคนิคนี้ไปใช้จริง?</h3>
    <p>เราขอแนะนำเว็บไซต์ที่ได้มาตรฐานสากล มั่นคง และปลอดภัยที่สุดในขณะนี้</p>
    <a href="https://inlnk.co/registerbocker168" class="cta-btn">ไปที่หน้าเดิมพัน ↗</a>
  </div>

สำคัญ: ให้ตอบกลับเป็น JSON เท่านั้นตามโครงสร้างที่กำหนด ห้ามมีข้อความอื่นนอกเหนือจาก JSON:
{
  "content": "เนื้อหาบทความ HTML ความยาว 1000-1500 คำ",
  "metaTitle": "Meta Title สำหรับ SEO",
  "metaDescription": "Meta Description สำหรับ SEO",
  "slug": "URL Slug ภาษาอังกฤษ"
}`;

      const data = await callAI(fullPrompt, {
        json: true,
        useTools: true,
        schema: {
          type: Type.OBJECT,
          properties: {
            content: { type: Type.STRING },
            metaTitle: { type: Type.STRING },
            metaDescription: { type: Type.STRING },
            slug: { type: Type.STRING }
          },
          required: ["content", "metaTitle", "metaDescription", "slug"]
        }
      });
      res.json(data);
    } catch (error: any) {
      console.error("Article Gen Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/brainstorm", async (req, res) => {
    try {
      const prompt = `คุณคือผู้เชี่ยวชาญด้าน Content Strategy สำหรับเว็บไซต์บาคาร่าและคาสิโนออนไลน์ ช่วยคิดหัวข้อบทความที่น่าสนใจและมีโอกาสติดอันดับ SEO สูงมาให้ 10 หัวข้อ โดยเน้นเทคนิคใหม่ๆ สูตรที่คนสนใจ หรือข่าวสารที่เกี่ยวข้อง
      ตอบกลับมาเป็น JSON เท่านั้นตามโครงสร้างที่กำหนด: { "topics": ["หัวข้อที่ 1", "หัวข้อที่ 2", ...] }`;
      
      const data = await callAI(prompt, {
        json: true,
        schema: {
          type: Type.OBJECT,
          properties: {
            topics: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            }
          },
          required: ["topics"]
        }
      });
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/generate-seo", async (req, res) => {
    try {
      const { keyword, topic } = req.body;
      const prompt = `คุณคือผู้เชี่ยวชาญด้าน SEO เขียน Meta Title และ Meta Description โดยอิงจากคีย์เวิร์ดหลักและหัวข้อที่กำหนดให้
      คีย์เวิร์ดหลัก: ${keyword}
      หัวข้อ: ${topic}
      ข้อกำหนด: Meta Title ห้ามเกิน 60 ตัวอักษร, Meta Description ห้ามเกิน 160 ตัวอักษร`;
      
      const data = await callAI(prompt, {
        json: true,
        schema: {
          type: Type.OBJECT,
          properties: {
            metaTitle: { type: Type.STRING },
            metaDescription: { type: Type.STRING }
          },
          required: ["metaTitle", "metaDescription"]
        }
      });
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/keywords-everywhere", async (req, res) => {
    try {
      const { topic } = req.body;
      const apiKey = process.env.KEYWORDS_EVERYWHERE_API_KEY;
      if (!apiKey) throw new Error("API Key missing");

      const formData = new URLSearchParams();
      formData.append('dataSource', 'gsc');
      formData.append('country', 'th');
      formData.append('currency', 'THB');
      formData.append('kw[]', topic);

      const response = await fetch('https://api.keywordseverywhere.com/v1/get_keyword_data', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Accept': 'application/json'
        },
        body: formData
      });

      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/generate-image", async (req, res) => {
    try {
      const { title, type } = req.body;
      let prompt = "";
      if (type === 'logo') {
        prompt = "A professional and luxurious logo for a website named 'Baccarat Master Guide'. The design should feature a combination of playing cards, a golden crown, and elegant typography. The color palette should be gold, black, and deep red. High-end, minimalist but authoritative. Square aspect ratio.";
      } else {
        prompt = `A high-quality, professional, and visually striking featured image for a blog post titled: "${title}". The theme is online baccarat, luxury casino, gambling strategy, and professional gaming. The style should be realistic but with a cinematic, high-end feel. Use a color palette of gold, black, and deep red. No text in the image. 16:9 aspect ratio.`;
      }

      try {
        const genAI = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });
        const result: any = await genAI.models.generateContent({
          model: "gemini-2.5-flash-image",
          contents: [{ role: "user", parts: [{ text: prompt }] }]
        });
        
        const candidates = result.candidates || [];
        const parts = candidates[0]?.content?.parts || [];
        let base64 = null;
        for (const part of parts) {
          if (part.inlineData) {
            base64 = `data:image/png;base64,${part.inlineData.data}`;
            break;
          }
        }
        
        if (base64) {
          return res.json({ image: base64 });
        }
        throw new Error("No image data in Gemini response");
      } catch (geminiError: any) {
        console.warn("Gemini Image Gen Error, falling back to DALL-E:", geminiError.message);
        
        if (!process.env.OPENAI_API_KEY) {
          throw new Error("Gemini failed and OPENAI_API_KEY is not set.");
        }

        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: prompt,
          n: 1,
          size: type === 'logo' ? "1024x1024" : "1024x1024", // DALL-E 3 supports 1024x1024, 1792x1024, 1024x1792
          response_format: "b64_json",
        });

        const base64 = `data:image/png;base64,${response.data[0].b64_json}`;
        res.json({ image: base64 });
      }
    } catch (error: any) {
      console.error("Image Gen Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/batch-seo", async (req, res) => {
    try {
      const { titles, mcpServers } = req.body;
      if (!Array.isArray(titles)) {
        return res.status(400).json({ error: "titles must be an array" });
      }

      const hasOpenAI = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "dummy";
      const hasAnthropic = process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== "dummy";

      if (!hasOpenAI && !hasAnthropic) {
        return res.status(501).json({ error: "No AI API keys are configured (OpenAI or Anthropic)." });
      }

      // Determine preferred provider based on mcpServers
      let preferredProvider = hasAnthropic ? "anthropic" : "openai";
      if (mcpServers && Array.isArray(mcpServers)) {
        if (mcpServers.some(s => s.name.includes('OPENAI'))) {
          preferredProvider = hasOpenAI ? "openai" : preferredProvider;
        } else if (mcpServers.some(s => s.name.includes('ANTHROPIC'))) {
          preferredProvider = hasAnthropic ? "anthropic" : preferredProvider;
        }
      }

      // Process concurrently using Promise.all
      const results = await Promise.all(titles.map(async (title, index) => {
        const prompt = `Generate SEO meta title and description for this article title: "${title}". 
              Return ONLY a JSON object with "metaTitle" and "metaDescription" keys. 
              Meta Title should be under 60 characters. Meta Description should be under 160 characters.`;

        let resultData = null;
        let lastError = null;

        // Helper to call OpenAI
        const callOpenAI = async () => {
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            response_format: { type: "json_object" }
          });
          return {
            type: 'succeeded',
            message: {
              content: [{ type: 'text', text: response.choices[0].message.content || '{}' }]
            }
          };
        };

        // Helper to call Anthropic
        const callAnthropic = async () => {
          const response = await anthropic.messages.create({
            model: "claude-3-5-sonnet-20241022",
            max_tokens: 500,
            messages: [{ role: "user", content: prompt }]
          });
          return {
            type: 'succeeded',
            message: {
              content: response.content
            }
          };
        };

        try {
          if (preferredProvider === "openai") {
            try {
              resultData = await callOpenAI();
            } catch (err: any) {
              console.warn(`OpenAI failed for "${title}", falling back to Anthropic:`, err.message);
              if (hasAnthropic) {
                resultData = await callAnthropic();
              } else {
                throw err;
              }
            }
          } else {
            try {
              resultData = await callAnthropic();
            } catch (err: any) {
              console.warn(`Anthropic failed for "${title}", falling back to OpenAI:`, err.message);
              if (hasOpenAI) {
                resultData = await callOpenAI();
              } else {
                throw err;
              }
            }
          }
        } catch (err: any) {
          lastError = err;
        }

        if (resultData) {
          return { custom_id: `seo-req-${index}`, result: resultData };
        } else {
          return {
            custom_id: `seo-req-${index}`,
            result: {
              type: 'errored',
              error: { message: lastError?.message || "Unknown error" }
            }
          };
        }
      }));

      res.json({ results });
    } catch (error: any) {
      console.error("Batch SEO Error Details:", {
        message: error.message,
        stack: error.stack,
        response: error.response?.data || error.response
      });
      res.status(500).json({ error: error.message });
    }
  });

  server.get("/api/ai/batch-results/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const batchApi = (anthropic as any).beta?.messages?.batches || (anthropic as any).messages?.batches;
      
      if (!batchApi) {
        throw new Error("Anthropic Batch API is not available.");
      }

      const batch = await batchApi.retrieve(id);
      
      if (batch.processing_status === 'ended') {
        const results = [];
        const iter = await batchApi.results(id);
        for await (const entry of iter) {
          results.push(entry);
        }
        res.json({ status: 'ended', results });
      } else {
        res.json({ status: batch.processing_status });
      }
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/execute-prompt", async (req, res) => {
    try {
      const { prompt } = req.body;
      const textResponse = await callAI(prompt);
      // Handles case where AI provider returned an object instead of string by accident
      const text = typeof textResponse === 'object' ? JSON.stringify(textResponse) : textResponse;
      res.json({ text });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  server.post("/api/ai/stream-prompt", async (req, res) => {
    try {
      const { prompt } = req.body;
      
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      for await (const chunk of streamAI(prompt)) {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      }
      
      res.write('data: [DONE]\n\n');
      res.end();
    } catch (error: any) {
      console.error("Streaming Error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: error.message });
      } else {
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.end();
      }
    }
  });
  
  // Request logging middleware
  server.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      console.log(`[${new Date().toISOString()}] ${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms`);
    });
    next();
  });

  const PORT = Number(process.env.PORT || 3000);

  // Socket.io connection
  io.engine.on("connection_error", (err) => {
    console.log("Connection error:", err.req ? err.req.url : 'unknown', err.code, err.message, err.context);
  });

  io.on("connection", (socket) => {
    console.log("Client connected:", socket.id);
    
    socket.on("get_users", async () => {
      const allUsers = await db.select().from(users);
      socket.emit("users_updated", allUsers);
    });

    socket.on("error", (err) => {
      console.error("Socket error:", err);
    });
    socket.on("disconnect", (reason) => {
      console.log("Client disconnected:", socket.id, "Reason:", reason);
    });
  });

  // Helper to broadcast updates
  const broadcastArticlesUpdate = () => {
    console.log("Broadcasting articles_updated event");
    io.emit("articles_updated");
  };
  const broadcastCategoriesUpdate = () => {
    console.log("Broadcasting categories_updated event");
    io.emit("categories_updated");
  };

  // Initialize Cloudflare D1 tables
  const hasCloudflareConfig = process.env.CLOUDFLARE_ACCOUNT_ID && 
                             process.env.CLOUDFLARE_API_TOKEN && 
                             process.env.CLOUDFLARE_D1_DATABASE_ID;

  if (!hasCloudflareConfig) {
    console.error("CRITICAL: Cloudflare D1 configuration is missing! Database operations will fail.");
    console.error("Please set CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN, and CLOUDFLARE_D1_DATABASE_ID in environment variables.");
  }

  try {
    if (hasCloudflareConfig) {
      await initSchema();
      console.log("Cloudflare D1 tables initialized successfully.");
    }
  } catch (error) {
    console.error("Error initializing Cloudflare D1 tables:", error);
  }

  // Helper functions
  function slugify(text: string) {
    return String(text || '')
      .trim()
      .toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function normalizeArticleBody(body: any) {
    return {
      title: String(body.title || '').trim(),
      slug: String(body.slug || '').trim(),
      excerpt: body.excerpt ?? '',
      content: body.content ?? '',
      image: body.image ?? '',
      category: body.category ?? null,
      tags: body.tags ?? '',
      metaTitle: body.metaTitle ?? '',
      metaDescription: body.metaDescription ?? '',
      metaKeywords: body.metaKeywords ?? '',
      faqs: body.faqs ?? '[]',
      author: body.author ?? 'Admin',
      status: body.status === 'published' ? 'published' : 'draft',
      type: body.type === 'page' ? 'page' : 'post',
      date: body.date ?? today(),
      publishedAt: body.publishedAt ?? null,
    };
  }

  async function getArticleById(id: number) {
    const rows = await query(
      `
      SELECT
        a.id,
        a.title,
        a.slug,
        a.excerpt,
        a.content,
        a.image,
        a.category,
        c.slug AS categorySlug,
        a.tags,
        a.meta_title AS metaTitle,
        a.meta_description AS metaDescription,
        a.meta_keywords AS metaKeywords,
        a.faqs,
        a.author,
        a.status,
        a.type,
        a.date,
        a.published_at AS publishedAt,
        a.created_at AS createdAt,
        a.updated_at AS updatedAt
      FROM articles a
      LEFT JOIN categories c ON a.category = c.name
      WHERE a.id = ?
      LIMIT 1
      `,
      [id]
    );

    return rows[0] || null;
  }

  
  server.get("/api/socket-status", (req, res) => {
    const clients = io.sockets.sockets.size;
    res.json({ connectedClients: clients });
  });

  // --- Image Upload (Cloudflare R2) ---
  server.get("/api/assets", async (req, res) => {
    try {
      const bucketName = process.env.R2_BUCKET_NAME || "baccarat-master-assets";
      const command = new ListObjectsV2Command({ Bucket: bucketName });
      const response = await r2Client.send(command);
      const publicUrlBase = process.env.R2_PUBLIC_DEV_URL || `https://${bucketName}.r2.dev`;
      
      const images = (response.Contents || [])
        .filter(item => item.Key && /\.(jpg|jpeg|png|gif|webp)$/i.test(item.Key))
        .map(item => ({
          key: item.Key,
          url: `${publicUrlBase}/${item.Key}`
        }));
      res.json(images);
    } catch (error: any) {
      console.error("Error listing assets:", error);
      // Return empty array instead of 500 error to avoid breaking the UI
      res.json([]);
    }
  });

  server.post("/api/upload", upload.single("image"), async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No image file provided" });
      }

      const file = req.file;
      const fileExtension = path.extname(file.originalname);
      const fileName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExtension}`;
      const bucketName = process.env.R2_BUCKET_NAME || "baccarat-master-assets";

      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      });

      await r2Client.send(command);

      // Return the public URL for the uploaded image
      // If R2_PUBLIC_DEV_URL is set (e.g., https://pub-xxx.r2.dev), use it.
      // Otherwise, fallback to a relative path or a custom domain if configured.
      const publicUrlBase = process.env.R2_PUBLIC_DEV_URL || `https://${bucketName}.r2.dev`;
      const imageUrl = `${publicUrlBase}/${fileName}`;

      res.json({ url: imageUrl, success: true });
    } catch (error: any) {
      console.error("Error uploading image to R2:", error);
      res.status(500).json({ error: error.message || "Failed to upload image" });
    }
  });

  // --- Articles ---
  server.get("/api/articles", async (req, res) => {
    try {
      const rows = await query(
        `
        SELECT
          a.id,
          a.title,
          a.slug,
          a.excerpt,
          a.content,
          a.image,
          a.category,
          c.slug AS categorySlug,
          a.tags,
          a.meta_title AS metaTitle,
          a.meta_description AS metaDescription,
          a.meta_keywords AS metaKeywords,
          a.faqs,
          a.author,
          a.status,
          a.type,
          a.date,
          a.published_at AS publishedAt,
          a.created_at AS createdAt,
          a.updated_at AS updatedAt
        FROM articles a
        LEFT JOIN categories c ON a.category = c.name
        ORDER BY datetime(a.created_at) DESC, a.id DESC
        `
      );
      res.json(rows);
    } catch (error: any) {
      console.error("Error fetching articles:", error);
      res.status(500).json({ error: error.message || 'Failed to fetch articles' });
    }
  });

  server.get('/api/articles/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      const article = await getArticleById(id);

      if (!article) {
        return res.status(404).json({ error: 'Article not found' });
      }

      res.json(article);
    } catch (error: any) {
      res.status(500).json({ error: error.message || 'Failed to fetch article' });
    }
  });

  server.post("/api/articles", async (req, res) => {
    try {
      const data = normalizeArticleBody(req.body);

      if (!data.title) {
        return res.status(400).json({ error: 'title is required' });
      }

      if (!data.slug) {
        data.slug = slugify(data.title);
      }

      const inserted = await query<{ id: number }>(
        `
        INSERT INTO articles (
          title,
          slug,
          excerpt,
          content,
          image,
          category,
          tags,
          meta_title,
          meta_description,
          meta_keywords,
          faqs,
          author,
          status,
          type,
          date,
          published_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        RETURNING id
        `,
        [
          data.title,
          data.slug,
          data.excerpt,
          data.content,
          data.image,
          data.category,
          data.tags,
          data.metaTitle,
          data.metaDescription,
          data.metaKeywords,
          data.faqs,
          data.author,
          data.status,
          data.type,
          data.date,
          data.publishedAt,
        ]
      );

      const article = await getArticleById(inserted[0].id);
      broadcastArticlesUpdate();
      res.status(201).json(article);
    } catch (error: any) {
      console.error("Error creating article:", error);
      res.status(500).json({ error: error.message || 'Failed to create article' });
    }
  });

  server.put("/api/articles/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const data = normalizeArticleBody(req.body);

      if (!data.title) {
        return res.status(400).json({ error: 'title is required' });
      }

      if (!data.slug) {
        data.slug = slugify(data.title);
      }

      await exec(
        `
        UPDATE articles
        SET
          title = ?,
          slug = ?,
          excerpt = ?,
          content = ?,
          image = ?,
          category = ?,
          tags = ?,
          meta_title = ?,
          meta_description = ?,
          meta_keywords = ?,
          faqs = ?,
          author = ?,
          status = ?,
          type = ?,
          date = ?,
          published_at = ?,
          updated_at = datetime('now')
        WHERE id = ?
        `,
        [
          data.title,
          data.slug,
          data.excerpt,
          data.content,
          data.image,
          data.category,
          data.tags,
          data.metaTitle,
          data.metaDescription,
          data.metaKeywords,
          data.faqs,
          data.author,
          data.status,
          data.type,
          data.date,
          data.publishedAt,
          id,
        ]
      );

      const article = await getArticleById(id);
      broadcastArticlesUpdate();
      res.json(article);
    } catch (error: any) {
      console.error("Error updating article:", error);
      res.status(500).json({ error: error.message || 'Failed to update article' });
    }
  });

  server.delete("/api/articles/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      await exec(`DELETE FROM articles WHERE id = ?`, [id]);
      broadcastArticlesUpdate();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting article:", error);
      res.status(500).json({ error: error.message || 'Failed to delete article' });
    }
  });

  // Reset articles table
  server.post("/api/articles/reset", async (req, res) => {
    try {
      await exec(`DELETE FROM articles;`);
      broadcastArticlesUpdate();
      res.json({ success: true, message: "Articles table reset successfully." });
    } catch (error: any) {
      console.error("Error resetting articles:", error);
      res.status(500).json({ error: error.message });
    }
  });

  // --- Categories ---
  server.get("/api/categories", async (req, res) => {
    try {
      const rows = await query(
        `
        SELECT
          id,
          name,
          slug,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM categories
        ORDER BY name ASC
        `
      );
      res.json(rows);
    } catch (error: any) {
      console.error("Error fetching categories:", error);
      res.status(500).json({ error: error.message || 'Failed to fetch categories' });
    }
  });

  server.post("/api/categories", async (req, res) => {
    try {
      const name = String(req.body?.name || '').trim();

      if (!name) {
        return res.status(400).json({ error: 'name is required' });
      }

      const slug = slugify(name);

      await exec(
        `
        INSERT INTO categories (name, slug)
        VALUES (?, ?)
        ON CONFLICT(name) DO UPDATE SET
          slug = excluded.slug,
          updated_at = datetime('now')
        `,
        [name, slug]
      );

      const rows = await query(
        `
        SELECT
          id,
          name,
          slug,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM categories
        WHERE name = ?
        LIMIT 1
        `,
        [name]
      );

      broadcastCategoriesUpdate();
      res.status(201).json(rows[0]);
    } catch (error: any) {
      console.error("Error creating category:", error);
      res.status(500).json({ error: error.message || 'Failed to create category' });
    }
  });

  server.put("/api/categories/by-name/:name", async (req, res) => {
    try {
      const oldName = decodeURIComponent(req.params.name);
      const newName = String(req.body?.newName || '').trim();

      if (!newName) {
        return res.status(400).json({ error: 'newName is required' });
      }

      const slug = slugify(newName);

      await exec(
        `
        UPDATE categories
        SET
          name = ?,
          slug = ?,
          updated_at = datetime('now')
        WHERE name = ?
        `,
        [newName, slug, oldName]
      );

      await exec(
        `
        UPDATE articles
        SET
          category = ?,
          updated_at = datetime('now')
        WHERE category = ?
        `,
        [newName, oldName]
      );

      const rows = await query(
        `
        SELECT
          id,
          name,
          slug,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM categories
        WHERE name = ?
        LIMIT 1
        `,
        [newName]
      );

      broadcastCategoriesUpdate();
      broadcastArticlesUpdate();
      res.json(rows[0] || { success: true });
    } catch (error: any) {
      console.error("Error updating category:", error);
      res.status(500).json({ error: error.message || 'Failed to update category' });
    }
  });

  server.delete("/api/categories/by-name/:name", async (req, res) => {
    try {
      const name = decodeURIComponent(req.params.name);

      await exec(`UPDATE articles SET category = NULL, updated_at = datetime('now') WHERE category = ?`, [name]);
      await exec(`DELETE FROM categories WHERE name = ?`, [name]);

      broadcastCategoriesUpdate();
      broadcastArticlesUpdate();
      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting category:", error);
      res.status(500).json({ error: error.message || 'Failed to delete category' });
    }
  });

  // Reset and seed categories
  server.post("/api/categories/reset", async (req, res) => {
    try {
      const defaults = [
        'บาคาร่า',
        'สูตรบาคาร่า',
        'เทคนิคบาคาร่า',
        'ข่าวบาคาร่า',
        'คาสิโนออนไลน์',
        'มือใหม่หัดเล่น',
      ];

      await exec(`DELETE FROM categories`);

      for (const name of defaults) {
        await exec(
          `INSERT INTO categories (name, slug) VALUES (?, ?)`,
          [name, slugify(name)]
        );
      }

      const rows = await query(
        `
        SELECT
          id,
          name,
          slug,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM categories
        ORDER BY name ASC
        `
      );

      broadcastCategoriesUpdate();
      res.json({ success: true, categories: rows });
    } catch (error: any) {
      console.error("Error resetting categories:", error);
      res.status(500).json({ error: error.message || 'Failed to reset categories' });
    }
  });

  // Clean duplicate categories
  server.post("/api/categories/clean-duplicates", async (req, res) => {
    try {
      await exec(`
        DELETE FROM categories
        WHERE id NOT IN (
          SELECT MIN(id)
          FROM categories
          GROUP BY TRIM(LOWER(name))
        )
      `);

      const rows = await query(
        `
        SELECT
          id,
          name,
          slug,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM categories
        ORDER BY name ASC
        `
      );

      broadcastCategoriesUpdate();
      res.json({ success: true, categories: rows });
    } catch (error: any) {
      console.error("Error cleaning duplicates:", error);
      res.status(500).json({ error: error.message || 'Failed to clean duplicate categories' });
    }
  });

  // Sitemap route
  server.get("/sitemap.xml", async (req, res) => {
    try {
      const articles = await query(`SELECT * FROM articles;`);

      const baseUrl = "https://huisache.com";
      let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
      xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';
      
      // Static pages
      const staticPages = ["", "/articles", "/formula", "/about"];
      staticPages.forEach(page => {
        xml += '  <url>\n';
        xml += `    <loc>${baseUrl}${page}</loc>\n`;
        xml += '    <changefreq>daily</changefreq>\n';
        xml += `    <priority>${page === "" ? "1.0" : "0.8"}</priority>\n`;
        xml += '  </url>\n';
      });

      // Dynamic articles
      const now = new Date();
      articles.forEach((article: any) => {
        let isPublished = true;
        if (article.status === 'draft') {
          isPublished = false;
        } else if (article.published_at) {
          const pubDate = new Date(article.published_at);
          isPublished = pubDate <= now;
        }
        
        if (isPublished && article.slug) {
          const updatedAt = article.updated_at ? new Date(article.updated_at) : new Date();
          xml += '  <url>\n';
          xml += `    <loc>${baseUrl}/articles/${article.slug}</loc>\n`;
          xml += `    <lastmod>${updatedAt.toISOString()}</lastmod>\n`;
          xml += '    <changefreq>weekly</changefreq>\n';
          xml += '    <priority>0.7</priority>\n';
          xml += '  </url>\n';
        }
      });

      xml += '</urlset>';

      res.header("Content-Type", "application/xml");
      res.send(xml);
    } catch (error) {
      console.error("Error generating sitemap:", error);
      res.status(500).send("Error generating sitemap");
    }
  });

  // Robots.txt route
  server.get("/robots.txt", (req, res) => {
    const robots = `User-agent: *
Allow: /
Disallow: /login
Disallow: /admin
Sitemap: https://huisache.com/sitemap.xml`;
    res.header("Content-Type", "text/plain");
    res.send(robots);
  });

  // Catch-all for API routes that don't exist
  server.all("/api/*", (req, res) => {
    console.log(`[${new Date().toISOString()}] Unmatched API route: ${req.method} ${req.url}`);
    res.status(404).json({ error: `API route not found: ${req.method} ${req.url}` });
  });

  // Auth API routes
  server.post("/api/auth/register", async (req, res) => {
    const { email, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    const id = Date.now().toString();
    const createdAt = new Date().toISOString();
    try {
      await exec(`INSERT INTO users (id, email, password, createdAt) VALUES (?, ?, ?, ?)`, [id, email, hashedPassword, createdAt]);
      res.status(201).json({ message: "User registered" });
    } catch (err) {
      res.status(400).json({ error: "Registration failed" });
    }
  });

  server.post("/api/auth/login", async (req, res) => {
    const { email, password } = req.body;
    const users = await query(`SELECT * FROM users WHERE email = ?`, [email]);
    if (users.length === 0) return res.status(401).json({ error: "Invalid credentials" });
    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, "secret", { expiresIn: "1h" });
    res.json({ token, user: { id: user.id, email: user.email, role: user.role } });
  });

  server.get("/api/auth/me", (req, res) => {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ error: "Unauthorized" });
    try {
      const user = jwt.verify(token, "secret");
      res.json(user);
    } catch (err) {
      res.status(401).json({ error: "Unauthorized" });
    }
  });

  // Vite middleware for development
  const isProduction = process.env.NODE_ENV === "production";
  const distPath = path.join(process.cwd(), "dist");
  const indexPath = path.join(distPath, "index.html");
  const hasBuild = fs.existsSync(indexPath);

  if (isProduction && hasBuild) {
    console.log("Serving production build from:", distPath);
    server.use(express.static(distPath));
    server.get("*", (req, res) => {
      res.sendFile(indexPath);
    });
  } else {
    if (isProduction && !hasBuild) {
      console.warn(`Production build not found at ${indexPath}. Falling back to Vite middleware.`);
    }
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
      },
      appType: "spa",
    });
    server.use(vite.middlewares);
  }

  server.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Express error:", err);
    res.status(500).send("Internal Server Error");
  });

  httpServer.on('request', (req, res) => {
    if (req.url?.startsWith('/socket.io')) {
      const start = Date.now();
      res.on('finish', () => {
        console.log(`[RAW] ${req.method} ${req.url} ${res.statusCode} ${Date.now() - start}ms`);
      });
    }
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

