import { OpenAI } from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";

// 1. Initialize OpenAI (Fallback for TTS & Script if needed)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// 2. Initialize Google AI (Primary for Script Generation - Cheaper)
const googleApiKey = process.env.GOOGLE_AI_API_KEY || process.env.GEMINI_API_KEY;
const genAI = googleApiKey ? new GoogleGenerativeAI(googleApiKey) : null;

// 3. ElevenLabs Configuration
const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY;

// Voice Mapping: Maps our logical roles to specific ElevenLabs Voice IDs
// You can browse more voices at https://elevenlabs.io/app/voice-lab
const VOICE_IDS = {
  // "Alloy" equivalent (Neutral/Bold) -> "Brian" (Great narrator) or "George"
  HOST: "JBFqnCBsd6RMkjVDRZzb", // George
  // "Onyx" equivalent (Deep/Calm) -> "Sarah" or "Charlie"
  EXPERT: "IKne3meq5aSn9XLyUdCD", // Charlie
};

export interface DialogueLine {
  speaker: "Host" | "Expert";
  text: string;
}

// ------------------------------------------------------------------
// HELPER: Clean JSON output from AI models
// ------------------------------------------------------------------
function cleanJSON(text: string) {
  try {
    // Remove markdown code blocks if present
    const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e) {
    console.error("JSON Parse Error on text:", text);
    throw new Error("Failed to parse AI response as JSON");
  }
}

// ------------------------------------------------------------------
// 1. GENERATE SCRIPT (Priority: Gemini -> Fallback: OpenAI)
// ------------------------------------------------------------------
export async function generatePodcastScript(content: string): Promise<DialogueLine[]> {
  // Strategy: Use Gemini (Free/Cheap) first. If it fails or key missing, use OpenAI.
  
  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ 
        model: "gemini-1.5-flash",
        generationConfig: { responseMimeType: "application/json" }
      });

      const prompt = `
        You are an expert podcast producer. Convert the following text into a natural, engaging dialogue between two hosts:
        1. "Host": Energetic, curious, asks the right questions.
        2. "Expert": Knowledgeable, calm, explains clearly with analogies.
        
        Rules:
        - Keep the total conversation under 5 minutes (approx 750 words).
        - Use short, punchy sentences.
        - Return strictly a JSON array of objects: [{ "speaker": "Host", "text": "..." }, { "speaker": "Expert", "text": "..." }]
        
        CONTENT:
        ${content.substring(0, 20000)}
      `;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      const parsed = cleanJSON(responseText);

      return Array.isArray(parsed) ? parsed : parsed.dialogue || [];
    } catch (error) {
      console.warn("⚠️ Gemini script generation failed, falling back to OpenAI.", error);
    }
  }

  // Fallback: OpenAI
  console.log("🔄 Using OpenAI for script generation...");
  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini", // Use mini to save costs
    messages: [
      { 
        role: "system", 
        content: `Generate a podcast dialogue. Return strictly a JSON array: [{ "speaker": "Host", "text": "..." }]` 
      },
      { role: "user", content: `Content:\n${content.substring(0, 15000)}` }
    ],
    response_format: { type: "json_object" },
  });

  const contentStr = completion.choices[0].message.content || "[]";
  const parsed = JSON.parse(contentStr);
  return Array.isArray(parsed) ? parsed : parsed.dialogue || [];
}

// ------------------------------------------------------------------
// 2. SYNTHESIZE SPEECH (Priority: ElevenLabs -> Fallback: OpenAI)
// ------------------------------------------------------------------
export async function synthesizeSpeech(text: string, voice: "alloy" | "echo" | "shimmer" | "onyx") {
  // Strategy: If ElevenLabs Key exists, use it for high quality. Else, OpenAI.

  if (ELEVENLABS_API_KEY) {
    try {
      // Map the generic "voice" argument to our specific ElevenLabs IDs
      // Host = alloy/echo, Expert = onyx/shimmer
      const isHost = voice === "alloy" || voice === "echo";
      const voiceId = isHost ? VOICE_IDS.HOST : VOICE_IDS.EXPERT;

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY,
          },
          body: JSON.stringify({
            text: text,
            model_id: "eleven_monolingual_v1", // Low latency, good quality
            voice_settings: {
              stability: 0.5,       // More variable = more expressive
              similarity_boost: 0.75 // Stick to the voice tone
            },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`ElevenLabs API Error: ${errorData.detail?.message || response.statusText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);

    } catch (error) {
      console.warn("⚠️ ElevenLabs generation failed. Falling back to OpenAI.", error);
      // Proceed to OpenAI fallback below...
    }
  }

  // Fallback: OpenAI TTS
  try {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: voice,
      input: text,
    });
    return Buffer.from(await mp3.arrayBuffer());
  } catch (error: any) {
    if (error?.status === 429) {
       console.error("❌ OpenAI Quota Exceeded for Audio.");
       throw new Error("Audio generation failed: Quota exceeded on both providers.");
    }
    throw error;
  }
}