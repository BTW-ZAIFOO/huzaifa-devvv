import { OpenAI } from "openai";
import { config } from "dotenv";

config({ path: "./config.env" });

const openai = new OpenAI({
    apiKey: "sk-abcdef1234567890abcdef1234567890abcdef12",
});

export const moderateContent = async (text) => {
    try {
        const response = await openai.moderations.create({
            input: text,
        });

        return response.results[0];
    } catch (error) {
        console.error("OpenAI moderation error:", error);
        return {
            flagged: false,
            categories: {},
            category_scores: {},
            error: error.message,
        };
    }
};

export const transcribeAudio = async (audioBuffer) => {
    try {
        const response = await openai.audio.transcriptions.create({
            file: audioBuffer,
            model: "whisper-1",
        });

        return response.text;
    } catch (error) {
        console.error("OpenAI transcription error:", error);
        throw new Error(`Failed to transcribe audio: ${error.message}`);
    }
};

export const getSuggestion = async (conversationContext) => {
    try {
        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are a helpful assistant that suggests short, friendly replies in a chat conversation. Keep your suggestions under 100 characters.",
                },
                {
                    role: "user",
                    content: `Based on this conversation, suggest a brief, natural reply: ${conversationContext}`,
                },
            ],
            max_tokens: 60,
            temperature: 0.7,
        });

        return response.choices[0].message.content.trim();
    } catch (error) {
        console.error("OpenAI suggestion error:", error);
        return "I'm not sure how to respond to that.";
    }
};
