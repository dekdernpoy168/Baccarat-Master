
import { GoogleGenAI, Type } from "@google/genai";
import * as fs from 'fs';
import OpenAI from 'openai';

async function generate() {
  const geminiKey = process.env.GEMINI_API_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;

  if (!geminiKey && !openaiKey) {
    console.error("Neither GEMINI_API_KEY nor OPENAI_API_KEY is set");
    process.exit(1);
  }

  const prompt = `Generate an extremely detailed and comprehensive article about 'Baccarat Strategies for Beginners' in Thai.
The article MUST be between 1000-1500 words long.
Focus on:
1. Introduction and History of Baccarat.
2. Fundamental concepts and rules (detailed).
3. Probability and House Edge analysis.
4. Basic betting strategies (Flat betting, Martingale, Paroli, Fibonacci, D'Alembert) with pros and cons for each.
5. Detailed Bankroll Management techniques.
6. Reading Roadmaps (Big Road, Bead Plate, etc.) and their psychological impact.
7. Common mistakes beginners make and how to avoid them.
8. Advanced tips for beginners to stay profitable.
9. Conclusion and final advice.

Format: HTML with h2, h3, p, ul, li, strong tags. Use h3 for sub-sections.
**Important Rules:**
- DO NOT put links (<a>) inside headings (h2, h3). Put them only inside paragraphs (p).
- At the end of the article, ALWAYS include this exact CTA block:
  <div class="cta-block">
    <h3>สนใจนำเทคนิคนี้ไปใช้จริง?</h3>
    <p>เราขอแนะนำเว็บไซต์ที่ได้มาตรฐานสากล มั่นคง และปลอดภัยที่สุดในขณะนี้</p>
    <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;">
      <a href="https://inlnk.co/registerbocker168" class="cta-btn">สมัครสมาชิกตอนนี้</a>
      <a href="https://inlnk.co/registerbocker168" class="cta-btn">ไปที่หน้าเดิมพัน</a>
    </div>
  </div>

Include:
- title: A catchy and professional Thai title.
- excerpt: A compelling summary in Thai (approx 100-150 words).
- content: The full article in HTML. Ensure the content is very long and detailed.
- category: 'เทคนิคบาคาร่า'
- slug: 'baccarat-strategies-for-beginners'
- metaTitle: SEO optimized title (max 60 chars).
- metaDescription: SEO optimized description (max 160 chars).
- author: 'Baccarat Master'
- date: '9 เมษายน 2569'
Return the result as a JSON object.`;

  try {
    console.log("Attempting to generate with Gemini...");
    const ai = new GoogleGenAI({ apiKey: geminiKey || "" });
    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-lite-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            excerpt: { type: Type.STRING },
            content: { type: Type.STRING },
            category: { type: Type.STRING },
            slug: { type: Type.STRING },
            metaTitle: { type: Type.STRING },
            metaDescription: { type: Type.STRING },
            author: { type: Type.STRING },
            date: { type: Type.STRING }
          },
          required: ["title", "excerpt", "content", "category", "slug", "metaTitle", "metaDescription", "author", "date"]
        }
      }
    });

    const result = response.text;
    fs.writeFileSync('generated_article.json', result);
    console.log("Article generated successfully with Gemini and saved to generated_article.json");
  } catch (geminiError: any) {
    console.warn("Gemini failed, trying OpenAI:", geminiError.message);
    
    if (!openaiKey) {
      console.error("OpenAI API Key not set, cannot fallback.");
      process.exit(1);
    }

    try {
      const openai = new OpenAI({ apiKey: openaiKey });
      const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
      });

      const result = response.choices[0].message.content || "{}";
      fs.writeFileSync('generated_article.json', result);
      console.log("Article generated successfully with OpenAI and saved to generated_article.json");
    } catch (openaiError: any) {
      console.error("OpenAI also failed:", openaiError.message);
      process.exit(1);
    }
  }
}

generate();
