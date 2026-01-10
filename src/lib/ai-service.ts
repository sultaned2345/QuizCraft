import OpenAI from 'openai';

// Initialize Client (Groq preferred for speed, falls back to OpenAI)
const openai = new OpenAI({
  apiKey: process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY,
  baseURL: process.env.GROQ_API_KEY ? "https://api.groq.com/openai/v1" : undefined
});

export const AI_MODELS = {
  FAST: 'llama3-8b-8192', // Good for simple tasks (Flashcards)
  SMART: 'llama3-70b-8192', // Good for complex tasks (Summaries, Mixed Quizzes)
};

/**
 * Generates a comprehensive Markdown summary of a document.
 */
export async function generateDocumentSummary(text: string, title: string) {
  const prompt = `
    You are an expert academic tutor. 
    Analyze the following text from the document "${title}".
    Create a detailed, structured study note in Markdown format.
    
    Structure your response as follows:
    # ${title} - Study Guide
    
    ## 🎯 Core Concepts
    (Bulleted list of the most important ideas)
    
    ## 📝 Detailed Analysis
    (Break down the content into logical sections with clear headings)
    
    ## 🔑 Key Terminology
    (Definition list of important terms found in the text)
    
    ## 🧠 Summary Conclusion
    (A brief wrap-up paragraph)
    
    TEXT TO ANALYZE:
    ${text.slice(0, 20000)} // Truncate to safe token limit
  `;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: AI_MODELS.SMART,
    });

    return completion.choices[0].message.content || "Failed to generate summary.";
  } catch (error) {
    console.error("Summary Generation Error:", error);
    throw new Error("AI service failed to generate summary.");
  }
}

/**
 * Generates Flashcards (Front/Back) from text.
 */
export async function generateFlashcardsFromText(text: string, count: number = 10) {
  const prompt = `
    Extract ${count} key terms and concepts from the text below and create study flashcards.
    Return strictly a JSON array. Do not wrap in markdown code blocks.
    
    JSON Format:
    [
      { "front": "Term or Question", "back": "Definition, Answer, or Explanation" }
    ]
    
    TEXT:
    ${text.slice(0, 15000)}
  `;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: AI_MODELS.FAST,
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content || "[]";
    // Clean potential markdown wrappers if the model misbehaves
    const cleaned = content.replace(/```json/g, '').replace(/```/g, '');
    const json = JSON.parse(cleaned);
    
    // Handle different potential root keys
    return Array.isArray(json) ? json : (json.flashcards || json.cards || []);
  } catch (error) {
    console.error("Flashcard Generation Error:", error);
    return [];
  }
}

/**
 * Generates a Quiz with mixed question types (MCQ, True/False, Fill-in-Blank).
 */
export async function generateQuizFromText(text: string, count: number = 5) {
  const prompt = `
    Generate a mixed-format quiz with ${count} questions based on the text below.
    Use a variety of question types to test understanding.
    
    Required JSON Format (Array of Objects):
    [
      {
        "question_text": "The actual question text",
        "question_type": "MULTIPLE_CHOICE" | "TRUE_FALSE" | "FILL_IN_THE_BLANK" | "SHORT_ANSWER",
        "correct_answer": "The correct answer string",
        "options": ["Option A", "Option B", "Option C", "Option D"], // Null for Short Answer
        "explanation": "Brief explanation of why this is correct"
      }
    ]

    Rules:
    1. For MULTIPLE_CHOICE: Provide 4 options.
    2. For TRUE_FALSE: Options must be ["True", "False"].
    3. For FILL_IN_THE_BLANK: Use "_______" in the question_text where the blank goes. "correct_answer" is the missing word. Options can be null.
    4. For SHORT_ANSWER: Options should be null.
    
    TEXT:
    ${text.slice(0, 15000)}
  `;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: AI_MODELS.SMART, // Smart model required for complex JSON structures
      response_format: { type: "json_object" }
    });

    const content = completion.choices[0].message.content || "[]";
    const cleaned = content.replace(/```json/g, '').replace(/```/g, '');
    const json = JSON.parse(cleaned);

    const questions = Array.isArray(json) ? json : (json.questions || []);

    // Validate and sanitize questions
    return questions.map((q: any) => ({
      question_text: q.question_text || "Error generating question",
      question_type: q.question_type || "MULTIPLE_CHOICE",
      correct_answer: q.correct_answer || "",
      options: Array.isArray(q.options) ? q.options : [],
      explanation: q.explanation || "No explanation provided."
    }));

  } catch (error) {
    console.error("Quiz Generation Error:", error);
    return [];
  }
}

/**
 * (Optional) Grading Assistant Logic
 * Use this if you want to implement the "ProjectEssayGrader" later.
 */
export async function gradeUserEssay(essay: string, context: string) {
  const prompt = `
    You are a strict professor. Grade the user's essay based ONLY on the provided Context.
    Return JSON: { "score": number (0-100), "strengths": "string", "weaknesses": "string", "suggestion": "string" }
    
    CONTEXT: ${context.slice(0, 10000)}
    
    USER ESSAY: ${essay.slice(0, 5000)}
  `;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: AI_MODELS.SMART,
      response_format: { type: "json_object" }
    });
    return JSON.parse(completion.choices[0].message.content || "{}");
  } catch (e) {
    console.error("Grading failed", e);
    return { score: 0, strengths: "", weaknesses: "Error grading essay.", suggestion: "" };
  }
}