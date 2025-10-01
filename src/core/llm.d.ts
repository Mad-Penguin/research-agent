export type ChatMsg = {
    role: "system" | "user" | "assistant";
    content: string;
};
export interface LLM {
    chat(messages: ChatMsg[], opts?: {
        temperature?: number;
    }): Promise<string>;
}
//# sourceMappingURL=llm.d.ts.map