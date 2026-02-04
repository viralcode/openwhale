import { z } from "zod";
import type { AgentTool, ToolCallContext, ToolResult } from "./base.js";

const ImageActionSchema = z.discriminatedUnion("action", [
    z.object({
        action: z.literal("generate"),
        prompt: z.string().describe("Description of the image to generate"),
        model: z.enum(["dall-e-3", "dall-e-2", "stable-diffusion"]).optional().default("dall-e-3"),
        size: z.enum(["256x256", "512x512", "1024x1024", "1792x1024", "1024x1792"]).optional().default("1024x1024"),
    }),
    z.object({
        action: z.literal("analyze"),
        imageUrl: z.string().describe("URL of the image to analyze"),
    }),
]);

type ImageAction = z.infer<typeof ImageActionSchema>;

// Placeholder - requires OPENAI_API_KEY or other provider
export const imageTool: AgentTool<ImageAction> = {
    name: "image",
    description: "Generate images from text prompts or analyze existing images.",
    category: "utility",
    parameters: ImageActionSchema,

    async execute(params: ImageAction, _context: ToolCallContext): Promise<ToolResult> {
        switch (params.action) {
            case "generate": {
                const openaiKey = process.env.OPENAI_API_KEY;
                if (!openaiKey) {
                    return {
                        success: false,
                        content: "",
                        error: "OPENAI_API_KEY not configured for image generation",
                    };
                }

                try {
                    const response = await fetch("https://api.openai.com/v1/images/generations", {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${openaiKey}`,
                            "Content-Type": "application/json",
                        },
                        body: JSON.stringify({
                            model: params.model === "dall-e-3" ? "dall-e-3" : "dall-e-2",
                            prompt: params.prompt,
                            n: 1,
                            size: params.size,
                            response_format: "url",
                        }),
                    });

                    if (!response.ok) {
                        const error = await response.text();
                        return { success: false, content: "", error: `Image generation failed: ${error}` };
                    }

                    const data = await response.json() as { data: Array<{ url: string }> };
                    const imageUrl = data.data[0]?.url;

                    return {
                        success: true,
                        content: `Generated image: ${imageUrl}`,
                        metadata: { imageUrl, prompt: params.prompt },
                    };
                } catch (err) {
                    const message = err instanceof Error ? err.message : String(err);
                    return { success: false, content: "", error: message };
                }
            }

            case "analyze": {
                // Vision analysis would go through the chat completions API with vision models
                return {
                    success: true,
                    content: `Image URL received: ${params.imageUrl}\nUse a vision-capable model to analyze this image.`,
                    metadata: { imageUrl: params.imageUrl },
                };
            }
        }
    },
};
