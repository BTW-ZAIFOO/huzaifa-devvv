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
  let suggestions = [];

  try {
    const data = null;

    if (data?.choices?.[0]?.message?.content) {
      try {
        const parsed = JSON.parse(data.choices[0].message.content);
        if (Array.isArray(parsed.suggestions)) {
          suggestions = parsed.suggestions.slice(0, 3);
        } else {
          throw new Error("Invalid JSON structure");
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
