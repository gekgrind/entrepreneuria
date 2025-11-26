import { streamText, generateText } from "ai";
import { openai } from "@ai-sdk/openai";
import OpenAI from "openai";
import { createServerClient } from "@supabase/ssr";
import { generateConversationTitle } from "./get-title";

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

/* -------------------------------------------------------------
   TYPES
------------------------------------------------------------- */

type UIMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

/* -------------------------------------------------------------
   SUPABASE HELPER
------------------------------------------------------------- */

function createClient(request: Request) {
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          const cookieHeader = request.headers.get("cookie");
          if (!cookieHeader) return undefined;

          const cookies = cookieHeader.split(';').map(c => c.trim());
          const cookie = cookies.find(c => c.startsWith(`${name}=`));
          return cookie?.substring(name.length + 1);
        },
      },
    }
  );
}

/* -------------------------------------------------------------
   EMBEDDING HELPERS
------------------------------------------------------------- */

async function getEmbedding(text: string) {
  try {
    const res = await openaiClient.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });

    return res.data[0]?.embedding ?? null;
  } catch (err) {
    console.error("EMBEDDING ERROR:", err);
    return null;
  }
}

/* -------------------------------------------------------------
   MEMORY RETRIEVAL
------------------------------------------------------------- */

async function getUserMemories(
  supabase: any,
  userId: string,
  embedding?: number[] | null
) {
  try {
    if (!embedding) {
      const { data } = await supabase
        .from("ai_memory")
        .select("*")
        .eq("user_id", userId)
        .order("importance", { ascending: false })
        .limit(20);

      return data || [];
    }

    // If you have a match_memories RPC, this will use it.
    // If not, it will just log an error and return [].
    const { data, error } = await supabase.rpc("match_memories", {
      query_embedding: embedding,
      user_id: userId,
      match_count: 20,
    });

    if (error) {
      console.error("match_memories RPC ERROR:", error);
      return [];
    }

    return data || [];
  } catch (err) {
    console.error("MEMORY RETRIEVAL ERROR:", err);
    return [];
  }
}

/* -------------------------------------------------------------
   MEMORY SCORING  (non-streaming: uses generateText)
------------------------------------------------------------- */

async function scoreMemory(memoryText: string) {
  try {
    const { text } = await generateText({
      model: openai("gpt-4o-mini"),
      messages: [
        {
          role: "system",
          content:
            "Score this memory 1–5 based on long-term usefulness. Output ONLY a number.",
        },
        {
          role: "user",
          content: memoryText,
        },
      ],
      maxTokens: 5,
    });

    const n = parseInt(text.trim(), 10);
    return Number.isNaN(n) ? 3 : n;
  } catch (err) {
    console.error("MEMORY SCORE ERROR:", err);
    return 3;
  }
}

/* -------------------------------------------------------------
   MEMORY EXTRACTION  (non-streaming: uses generateText)
------------------------------------------------------------- */

async function extractMemories(
  modelName: string,
  lastUserMessage: string,
  aiResponse: string
) {
  try {
    const { text } = await generateText({
      model: openai(modelName),
      messages: [
        {
          role: "system",
          content:
            'Extract meaningful long-term memories only. Output JSON: { "memories": [ { "memory_type": "...", "memory": "...", "importance": 1-5 } ] }',
        },
        {
          role: "user",
          content: `User said: "${lastUserMessage}"\nAI responded: "${aiResponse}"`,
        },
      ],
      maxTokens: 200,
    });

    return JSON.parse(text);
  } catch (err) {
    console.error("MEMORY EXTRACTION ERROR:", err);
    return { memories: [] };
  }
}

/* -------------------------------------------------------------
   MEMORY SAVE
------------------------------------------------------------- */

async function saveMemories(
  supabase: any,
  userId: string,
  memories: any[]
) {
  if (!memories || memories.length === 0) return;

  for (const m of memories) {
    try {
      const importance = await scoreMemory(m.memory);
      const embedding = await getEmbedding(m.memory);

      await supabase.from("ai_memory").insert({
        user_id: userId,
        memory_type: m.memory_type || "note",
        memory: m.memory,
        importance,
        embedding,
      });
    } catch (err) {
      console.error("MEMORY SAVE ERROR:", err);
    }
  }
}

/* -------------------------------------------------------------
   MAIN HANDLER
------------------------------------------------------------- */

export const maxDuration = 30;

export async function POST(req: Request) {
  try {
    const {
      messages,
      conversationId: incomingConversationId,
    }: { messages: UIMessage[]; conversationId?: string | null } =
      await req.json();

    if (!messages || !Array.isArray(messages)) {
      console.error("BAD MESSAGES PAYLOAD:", messages);
      return new Response("Invalid message payload", { status: 400 });
    }

    const supabase = createClient(req);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    let conversationId = incomingConversationId ?? null;
    const lastUserMessage =
      messages[messages.length - 1]?.content || "";

    let memoryContext = "No relevant memories found.";
    let isPremium = false;

    /* -----------------------------------------------------------
       USER LOGGED IN → MEMORY + PROFILE + CREDITS + PREMIUM
    ----------------------------------------------------------- */
    if (user) {
      // 1) Embedding + memory retrieval
      const queryEmbedding = await getEmbedding(lastUserMessage);
      const memories = await getUserMemories(
        supabase,
        user.id,
        queryEmbedding
      );

      memoryContext =
        memories && memories.length > 0
          ? memories
              .map(
                (m: any) =>
                  `• (${m.memory_type}, importance ${m.importance}) ${m.memory}`
              )
              .join("\n")
          : "No relevant memories found.";

      // 2) Load profile with premium + credit info
      const { data: userProfile, error: profileError } =
        await supabase
          .from("profiles")
          .select(
            "is_premium, plan_tier, subscription_status, daily_credit_limit, daily_credits_used, last_credit_reset"
          )
          .eq("id", user.id)
          .single();

      if (profileError) {
        console.error("PROFILE LOAD ERROR:", profileError);
      }

      // Safeguard defaults
      const planTier = userProfile?.plan_tier ?? "free";
      const subscriptionStatus =
        userProfile?.subscription_status ?? "inactive";
      let dailyLimit = userProfile?.daily_credit_limit ?? 5;
      let dailyUsed = userProfile?.daily_credits_used ?? 0;
      let lastReset = userProfile?.last_credit_reset ?? null;

      // 3) Daily credit reset for free users
      try {
        const today = new Date().toISOString().split("T")[0];

        if (lastReset !== today) {
          await supabase
            .from("profiles")
            .update({
              daily_credits_used: 0,
              last_credit_reset: today,
            })
            .eq("id", user.id);

          dailyUsed = 0;
          lastReset = today;
        }
      } catch (err) {
        console.error("CREDIT RESET ERROR:", err);
      }

      // 4) Premium determination
      isPremium =
        userProfile?.is_premium === true ||
        (planTier !== "free" && subscriptionStatus === "active");

      // 5) Free-tier credit enforcement (only if NOT premium)
      if (!isPremium) {
        if (dailyUsed >= dailyLimit) {
          // Out of free credits → soft-upgrade message
          return new Response(
            "✨ You've used today's free Prospra prompts. Upgrade to keep the inspiration flowing!",
            {
              status: 200,
              headers: { "Content-Type": "text/plain" },
            }
          );
        }

        // Increment usage for this request
        try {
          await supabase
            .from("profiles")
            .update({
              daily_credits_used: dailyUsed + 1,
            })
            .eq("id", user.id);
        } catch (err) {
          console.error("CREDIT INCREMENT ERROR:", err);
        }
      }

      // 6) Create conversation if missing
      if (!conversationId) {
        try {
          const title = await generateConversationTitle(
            lastUserMessage
          );
          const { data: newConv, error: convError } =
            await supabase
              .from("conversations")
              .insert({ user_id: user.id, title })
              .select()
              .single();

          if (convError) {
            console.error("CONVERSATION CREATE ERROR:", convError);
          }

          conversationId = newConv?.id ?? null;
        } catch (err) {
          console.error("CONVERSATION TITLE ERROR:", err);
        }
      }

      // 7) PREMIUM KEYWORDS → feature gating
      const premiumKeywords = [
        "swot",
        "s.w.o.t",
        "roadmap",
        "pitch deck",
        "financial model",
        "pricing strategy",
        "market analysis",
        "business model",
        "growth strategy",
        "go-to-market",
      ];

      const isPremiumFeature = premiumKeywords.some((k) =>
        lastUserMessage.toLowerCase().includes(k)
      );

      if (isPremiumFeature && !isPremium) {
        // Return friendly upgrade message
        return new Response(
          "👀 Oop—this one's for premium members only! Upgrade to unlock the boss-level features.",
          {
            status: 200,
            headers: { "Content-Type": "text/plain" },
          }
        );
      }
    } else {
      // Guest mode — no Supabase rows, no stored memory
      memoryContext = "Guest session: no stored memories yet.";
      isPremium = false;
    }

    /* -----------------------------------------------------------
       MODEL SELECTION
    ----------------------------------------------------------- */

    const modelName = isPremium ? "gpt-4o" : "gpt-4o-mini";

    /* -----------------------------------------------------------
       SYSTEM PROMPT
    ----------------------------------------------------------- */

    const systemPrompt = `
You are Prospra, an elite entrepreneurial AI mentor.

User Memory Context:
${memoryContext}

Rules:
- Respond with warmth, clarity, and actionable advice.
- Use structured steps when helpful.
- Keep answers focused and practical.
- Ask clarifying questions when needed.
`;

    // Build model messages safely
    const coreMessages = [
      { role: "system" as const, content: systemPrompt },
      ...messages.map((m) => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      })),
    ];

    /* -----------------------------------------------------------
       GENERATE AI RESPONSE (STREAMED) + MEMORY PIPELINE ON FINISH
    ----------------------------------------------------------- */

    const result = await streamText({
      model: openai(modelName),
      messages: coreMessages,
      temperature: isPremium ? 0.8 : 0.5,
      maxTokens: isPremium ? 1200 : 600,
      // Capture final text for memory after streaming is done
      onFinish: async (event: any) => {
        try {
          const aiResponseText = event.text as string;

          if (user && aiResponseText) {
            const extracted = await extractMemories(
              modelName,
              lastUserMessage,
              aiResponseText
            );
            await saveMemories(
              supabase,
              user.id,
              extracted.memories || []
            );
          }
        } catch (err) {
          console.error("MEMORY PIPELINE ERROR:", err);
        }
      },
    });

    // Stream back to the client the way useChat expects
    return result.toDataStreamResponse();
  } catch (err) {
    console.error("CHAT API ERROR:", err);
    return new Response(
      "⚠️ Prospra ran into an error. Try again in a moment.",
      {
        status: 500,
        headers: { "Content-Type": "text/plain" },
      }
    );
  }
}
