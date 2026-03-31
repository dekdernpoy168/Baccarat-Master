import { GoogleGenAI } from "@google/genai";

async function generateLogo() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-image',
    contents: {
      parts: [
        {
          text: "A professional and luxurious logo for a website named 'Baccarat Master Guide'. The design should feature a combination of playing cards, a golden crown, and elegant typography. The color palette should be gold, black, and deep red. High-end, minimalist but authoritative. Square aspect ratio.",
        },
      ],
    },
    config: {
      imageConfig: {
        aspectRatio: "1:1",
      },
    },
  });

  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      console.log("LOGO_BASE64_START");
      console.log(part.inlineData.data);
      console.log("LOGO_BASE64_END");
    }
  }
}

generateLogo();
