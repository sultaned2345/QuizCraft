import { OpenAI } from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface DialogueLine {
  speaker: "Host" | "Expert";
  text: string;
}

export async function generatePodcastScript(content: string): Promise<DialogueLine[]> {
  const systemPrompt = `
    You are an expert podcast producer. Your goal is to convert the provided educational content into a fast-paced, engaging dialogue between two hosts:
    1. "The Host": Curious, energetic, asks clarifying questions.
    2. "The Expert": Knowledgeable, calm, explains concepts with analogies.
    
    Rules:
    - Keep it under 5 minutes.
    - Use natural interjections like "Right", "Exactly", "Wow".
    - Avoid reading headers directly. Make it conversational.
    - Return ONLY a JSON array of objects with keys "speaker" and "text".
  `;

  const completion = await openai.chat.completions.create({
    model: "gpt-4o", // or "gemini-1.5-pro" if using Google
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Content to discuss:\n${content.substring(0, 15000)}` }
    ],
    response_format: { type: "json_object" },
  });

  const responseContent = completion.choices[0].message.content;
  if (!responseContent) throw new Error("No script generated");

  // Expecting { "dialogue": [...] } or just [...] depending on model behavior, 
  // ensuring we parse correctly.
  const parsed = JSON.parse(responseContent);
  return Array.isArray(parsed) ? parsed : parsed.dialogue || [];
}

export async function synthesizeSpeech(text: string, voice: "alloy" | "echo" | "shimmer" | "onyx") {
  const mp3 = await openai.audio.speech.create({
    model: "tts-1",
    voice: voice,
    input: text,
  });

  return Buffer.from(await mp3.arrayBuffer());
}