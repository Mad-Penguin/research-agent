export type Paper = {
    id: string;
    title: string;
    authors: string[];
    year?: number;
    url?: string;
    abstract?: string;
    addedAt: string;
};
export declare class ProjectStore {
    name: string;
    baseDir: string;
    metaPath: string;
    papers: Paper[];
    constructor(name: string);
    save(): void;
    upsert(p: Paper): void;
    find(id: string): Paper | null;
}
//# sourceMappingURL=store.d.ts.map