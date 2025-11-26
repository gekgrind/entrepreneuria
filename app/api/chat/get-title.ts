import { generateText } from "ai";
import { openai } from "@ai-sdk/openai";

export async function generateConversationTitle(
  userMessage: string
): Promise<string> {
  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      messages: [
        {
          role: "system",
          content:
            "Generate a short 3-5 word title for this conversation. Output ONLY the title, no quotes or extra text.",
        },
        {
          role: "user",
          content: userMessage,
        },
      ],
      maxTokens: 20,
    });

    return text.trim() || "New Conversation";
  } catch (err) {
    console.error("TITLE GENERATION ERROR:", err);
    return "New Conversation";
  }
}
