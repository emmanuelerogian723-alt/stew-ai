declare module 'stew-ai' {
  export interface StewOptions {
    apiKey?: string;
    baseURL?: string;
    timeout?: number;
    maxRetries?: number;
  }

  export interface ChatOptions {
    webSearch?: boolean;
    fusionMode?: boolean;
    conversationId?: string;
    /** Model to use for streaming */
    model?: string;
    /** System prompt for streaming */
    system?: string;
    /** Previous messages for conversation context */
    history?: Array<{ role: string; content: string }>;
    /** Temperature (0-2) */
    temperature?: number;
    maxTokens?: number;
    /** Called for each token chunk during streaming */
    onToken?: (delta: string) => void;
    /** Called when streaming completes */
    onDone?: (fullText: string, data: any) => void;
  }

  export interface ChatResponse {
    response: string;
    web_grounded: boolean;
    sources: Array<{ title: string; url: string; snippet: string }>;
    provider: string;
    model: string;
    fusion_workers: string[] | null;
    conversation_id: string | null;
    success: boolean;
  }

  export interface SearchResponse {
    results: any;
    success: boolean;
  }

  export interface SkillsListResponse {
    total: number;
    categories: string[];
    skills: Array<{ name: string; description: string; category: string }>;
  }

  export interface SkillRunResponse {
    skill: string;
    result: any;
    success: boolean;
  }

  export interface DocumentResponse {
    success: boolean;
    download_url?: string;
    file_id?: string;
    [key: string]: any;
  }

  export interface FineTuneOptions {
    persona?: string;
    customInstructions?: string;
    personaName?: string;
    responseStyle?: 'concise' | 'balanced' | 'detailed';
    language?: string;
    preferredModel?: string;
    mistralApiKey?: string;
  }

  export interface HeartbeatResponse {
    status: string;
    version: string;
    timestamp: string;
    services: Record<string, string>;
  }

  export class StewError extends Error {
    code: string;
    suggestion: string;
  }

  export class Stew {
    constructor(options: StewOptions);
    chat: {
      send(message: string, options?: ChatOptions): Promise<ChatResponse>;
      /** Stream a chat response with real-time token callbacks */
      stream(message: string, options?: ChatOptions): Promise<string>;
      /** OpenAI-compatible chat completions */
      completion(
        messages: Array<{ role: string; content: string }>,
        options?: ChatOptions & { stream?: boolean }
      ): Promise<string>;
    };
    search: {
      query(query: string): Promise<SearchResponse>;
      browse(url: string, options?: { question?: string }): Promise<any>;
    };
    skills: {
      list(category?: string): Promise<SkillsListResponse>;
      run(skillName: string, params?: Record<string, any>): Promise<SkillRunResponse>;
    };
    documents: {
      pdf(content: string, title?: string): Promise<DocumentResponse>;
      docx(content: string, title?: string): Promise<DocumentResponse>;
      xlsx(data: Record<string, any>[], sheetName?: string, title?: string): Promise<DocumentResponse>;
      pptx(slides: Record<string, any>[], title?: string): Promise<DocumentResponse>;
      html(content: string, title?: string): Promise<DocumentResponse>;
    };
    finetune: {
      set(options: FineTuneOptions): Promise<any>;
      get(): Promise<any>;
    };
    heartbeat(): Promise<HeartbeatResponse>;
    register(fullName: string, email: string, password: string): Promise<any>;
    login(email: string, password: string): Promise<any>;
    me(): Promise<any>;
    usage(): Promise<any>;
    generateImage(prompt: string, options?: any): Promise<any>;
    runAgents(task: string, options?: any): Promise<any>;
    executeCode(code: string, options?: any): Promise<any>;
    ocr(imageData: string, options?: any): Promise<any>;
    baseURL: string;
    apiKey: string;
    static StewError: typeof StewError;
    static version: string;
  }

  export default Stew;
}
