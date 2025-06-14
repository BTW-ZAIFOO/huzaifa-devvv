import dotenv from "dotenv";
dotenv.config();

export const moderateContent = async (content) => {
  try {
    const moderationResult = {
      flagged: false,
      categories: {},
      categoryScores: {},
    };

    const flaggedWords = ["hate", "violence", "threat", "sexual", "explicit"];
    const contentLower = content.toLowerCase();

    const containsFlaggedWord = flaggedWords.some((word) =>
      contentLower.includes(word)
    );

    if (containsFlaggedWord) {
      moderationResult.flagged = true;
      moderationResult.categories.hate = true;
    }

    return moderationResult;
  } catch (error) {
    console.error("Content moderation error:", error);
    return {
      flagged: false,
      categories: {},
      categoryScores: {},
      error: error.message,
    };
  }
};

export const transcribeAudio = async (audioBuffer) => {
  try {
    return "This is a voice message (transcription not available)";
  } catch (error) {
    console.error("Audio transcription error:", error);
    return "Voice message (transcription failed)";
  }
};

export const getSuggestion = async (conversation) => {
  if (!process.env.OPENAI_API_KEY) {
    return {
      suggestions: [
        "Thanks for your message!",
        "I appreciate your perspective.",
        "Could you tell me more about that?",
      ],
      error: "API key missing - using default suggestions",
    };
  }

  try {
    const messages = [
      {
        role: "system",
        content:
          "You are a helpful assistant that generates 3 short, appropriate reply suggestions based on the conversation context. Keep suggestions concise (under 60 characters) and appropriate for a chat application. Respond with JSON format containing an array of 3 suggestions.",
      },
    ];

    if (Array.isArray(conversation)) {
      conversation.forEach((msg) => {
        messages.push({
          role: msg.isUser ? "user" : "assistant",
          content: msg.content,
        });
      });
    } else if (typeof conversation === "string") {
      messages.push({
        role: "user",
        content: conversation,
      });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages,
        temperature: 0.7,
        max_tokens: 150,
      }),
    });

    const data = await response.json();

    if (data.error) {
      console.error("OpenAI API error:", data.error);
      return {
        suggestions: [
          "Thanks for your message!",
          "I appreciate your perspective.",
          "Could you tell me more about that?",
        ],
        error: data.error.message,
      };
    }

    let suggestions = [];
    try {
      const content = data.choices[0].message.content;
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed.suggestions)) {
        suggestions = parsed.suggestions;
      } else if (Array.isArray(parsed)) {
        suggestions = parsed;
      }
    } catch (e) {
      const content = data.choices[0].message.content;
      const lines = content
        .split("\n")
        .map((line) => line.trim())
        .filter(
          (line) =>
            line.length > 0 && !line.startsWith("{") && !line.startsWith("}")
        );

      suggestions = lines
        .slice(0, 3)
        .map((line) => line.replace(/^["'\d.\s-]*/, "").replace(/["']$/, ""));
    }

    while (suggestions.length < 3) {
      suggestions.push(
        [
          "Thanks for sharing!",
          "Interesting point.",
          "I see what you mean.",
          "Good to know!",
          "Let's discuss further.",
        ][Math.floor(Math.random() * 5)]
      );
    }

    return {
      suggestions: suggestions.slice(0, 3),
    };
  } catch (error) {
    console.error("Error generating suggestions:", error);
    return {
      suggestions: [
        "Thanks for your message!",
        "I appreciate your perspective.",
        "Could you tell me more about that?",
      ],
      error: error.message,
    };
  }
};
