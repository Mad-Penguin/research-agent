import type { LLM, ChatMsg } from "./llm.js";
export declare class GeminiLLM implements LLM {
    private model;
    constructor(model?: string);
    chat(messages: ChatMsg[], opts?: {
        temperature?: number;
    }): Promise<string>;
}
//# sourceMappingURL=gemini.d.ts.map