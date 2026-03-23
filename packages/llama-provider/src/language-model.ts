import type {
  LanguageModelV3,
  LanguageModelV3CallOptions,
  LanguageModelV3GenerateResult,
  LanguageModelV3StreamResult,
  LanguageModelV3StreamPart,
  LanguageModelV3Content,
  LanguageModelV3Message,
  LanguageModelV3FinishReason,
  LanguageModelV3Usage,
  SharedV3Warning,
} from "@ai-sdk/provider";
import {
  LlamaChatSession,
  defineChatSessionFunction,
  type ChatHistoryItem,
  type ChatSessionModelFunctions,
  type LLamaChatPromptOptions,
} from "node-llama-cpp";
import type { ModelManager } from "@vxllm/inference";

/**
 * Convert AI SDK messages into node-llama-cpp ChatHistoryItem[] format.
 *
 * LlamaChatSession manages its own chat history internally, so we only need
 * to extract the latest user message for session.prompt(). However, we set
 * the full history on the session for multi-turn conversations.
 */
function convertMessages(messages: LanguageModelV3Message[]): {
  systemPrompt: string | undefined;
  history: ChatHistoryItem[];
  lastUserMessage: string;
} {
  let systemPrompt: string | undefined;
  const history: ChatHistoryItem[] = [];
  let lastUserMessage = "";

  for (const msg of messages) {
    switch (msg.role) {
      case "system":
        // Use the last system message as the system prompt
        systemPrompt = msg.content;
        break;
      case "user": {
        const text = msg.content
          .filter((p) => p.type === "text")
          .map((p) => p.text)
          .join("\n");
        lastUserMessage = text;
        history.push({ type: "user", text });
        break;
      }
      case "assistant": {
        const parts: string[] = [];
        for (const part of msg.content) {
          if (part.type === "text") {
            parts.push(part.text);
          }
        }
        if (parts.length > 0) {
          history.push({ type: "model", response: [parts.join("")] });
        }
        break;
      }
      case "tool": {
        // Tool results are typically already handled in the chat history
        // through function call results. We skip standalone tool messages
        // as node-llama-cpp manages tool results internally.
        break;
      }
    }
  }

  return { systemPrompt, history, lastUserMessage };
}

/**
 * Build node-llama-cpp chat session functions from AI SDK tool definitions.
 */
function buildFunctions(
  tools: LanguageModelV3CallOptions["tools"],
): ChatSessionModelFunctions | undefined {
  if (!tools || tools.length === 0) return undefined;

  const functions: Record<string, ReturnType<typeof defineChatSessionFunction>> = {};

  for (const tool of tools) {
    if (tool.type !== "function") continue;

    functions[tool.name] = defineChatSessionFunction({
      description: tool.description,
      params: tool.inputSchema as any,
      handler: () => {
        // We don't execute tools on the server side during generation.
        // The AI SDK handles tool execution. We return a placeholder
        // that signals the tool was called.
        return "[tool call captured]";
      },
    });
  }

  return Object.keys(functions).length > 0 ? functions : undefined;
}

/**
 * Map node-llama-cpp stop reasons to AI SDK finish reasons.
 */
function mapStopReason(
  stopReason: string | undefined,
): LanguageModelV3FinishReason {
  switch (stopReason) {
    case "eogToken":
    case "stopGenerationTrigger":
    case "customStopTrigger":
      return { unified: "stop", raw: stopReason };
    case "maxTokens":
      return { unified: "length", raw: stopReason };
    case "functionCalls":
      return { unified: "tool-calls", raw: stopReason };
    case "abort":
      return { unified: "other", raw: stopReason };
    default:
      return { unified: "stop", raw: stopReason };
  }
}

/**
 * AI SDK LanguageModelV3 adapter for node-llama-cpp.
 *
 * Bridges the Vercel AI SDK to local LLM inference via node-llama-cpp.
 * Supports text generation, streaming, structured output (JSON grammar),
 * and native tool calling via defineChatSessionFunction.
 */
export class NodeLlamaCppLanguageModel implements LanguageModelV3 {
  readonly specificationVersion = "v3" as const;
  readonly provider = "llama-cpp";
  readonly modelId: string;
  readonly supportedUrls: Record<string, RegExp[]> = {};

  private readonly modelManager: ModelManager;

  constructor(sessionId: string, modelManager: ModelManager) {
    this.modelId = sessionId;
    this.modelManager = modelManager;
  }

  private getEntry() {
    const entry = this.modelManager.getModelEntry(this.modelId);
    if (!entry) {
      throw new Error(
        `No model loaded with session ID "${this.modelId}". Load a model first via ModelManager.load().`,
      );
    }
    return entry;
  }

  async doGenerate(
    options: LanguageModelV3CallOptions,
  ): Promise<LanguageModelV3GenerateResult> {
    const entry = this.getEntry();
    const { systemPrompt, history, lastUserMessage } = convertMessages(
      options.prompt,
    );
    const warnings: SharedV3Warning[] = [];

    // Create a context sequence and chat session
    const sequence = entry.context.getSequence();
    const session = new LlamaChatSession({
      contextSequence: sequence,
      systemPrompt,
    });

    try {
      // Build prompt options
      const promptOptions: LLamaChatPromptOptions = {
        maxTokens: options.maxOutputTokens,
        temperature: options.temperature,
        topP: options.topP,
        topK: options.topK,
        signal: options.abortSignal,
        stopOnAbortSignal: true,
      };

      // Handle stop sequences
      if (options.stopSequences && options.stopSequences.length > 0) {
        promptOptions.customStopTriggers = options.stopSequences;
      }

      // Handle structured output via JSON grammar
      if (
        options.responseFormat?.type === "json" &&
        options.responseFormat.schema
      ) {
        const llama = this.modelManager.getLlama();
        if (llama) {
          const grammar = await llama.createGrammarForJsonSchema(
            options.responseFormat.schema as any,
          );
          (promptOptions as any).grammar = grammar;
        }
      }

      // Handle tool calling
      const functions = buildFunctions(options.tools);
      if (functions) {
        (promptOptions as any).functions = functions;
        (promptOptions as any).documentFunctionParams = true;
      }

      // Set prior conversation history (excluding the last user message)
      if (history.length > 1) {
        const priorHistory = history.slice(0, -1);
        if (systemPrompt) {
          session.setChatHistory([
            { type: "system", text: systemPrompt },
            ...priorHistory,
          ]);
        } else {
          session.setChatHistory(priorHistory);
        }
      }

      // Count input tokens
      const inputText = options.prompt
        .map((m) => {
          if (m.role === "system") return m.content;
          if (m.role === "user")
            return m.content
              .filter((p) => p.type === "text")
              .map((p) => p.text)
              .join("");
          if (m.role === "assistant")
            return m.content
              .filter((p): p is { type: "text"; text: string } => p.type === "text")
              .map((p) => p.text)
              .join("");
          return "";
        })
        .join("");
      const inputTokens = entry.model.tokenize(inputText).length;

      // Generate
      const result = await session.promptWithMeta(
        lastUserMessage,
        promptOptions as any,
      );

      const responseText = result.responseText;
      const outputTokens = entry.model.tokenize(responseText).length;

      // Build content array
      const content: LanguageModelV3Content[] = [];

      // Check for function calls in the response
      let hasToolCalls = false;
      for (const item of result.response) {
        if (typeof item === "object" && "type" in item && item.type === "functionCall") {
          hasToolCalls = true;
          content.push({
            type: "tool-call",
            toolCallId: `call_${crypto.randomUUID().slice(0, 8)}`,
            toolName: item.name,
            input: JSON.stringify(item.params),
          });
        }
      }

      // Add text content if present
      if (responseText) {
        content.push({ type: "text", text: responseText });
      }

      const finishReason = mapStopReason(result.stopReason);
      const usage: LanguageModelV3Usage = {
        inputTokens: {
          total: inputTokens,
          noCache: inputTokens,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: {
          total: outputTokens,
          text: hasToolCalls ? undefined : outputTokens,
          reasoning: undefined,
        },
      };

      return {
        content,
        finishReason,
        usage,
        warnings,
      };
    } finally {
      session.dispose();
      sequence.dispose();
    }
  }

  async doStream(
    options: LanguageModelV3CallOptions,
  ): Promise<LanguageModelV3StreamResult> {
    const entry = this.getEntry();
    const { systemPrompt, history, lastUserMessage } = convertMessages(
      options.prompt,
    );
    const warnings: SharedV3Warning[] = [];

    // Create a context sequence and chat session
    const sequence = entry.context.getSequence();
    const session = new LlamaChatSession({
      contextSequence: sequence,
      systemPrompt,
    });

    // Set prior conversation history
    if (history.length > 1) {
      const priorHistory = history.slice(0, -1);
      if (systemPrompt) {
        session.setChatHistory([
          { type: "system", text: systemPrompt },
          ...priorHistory,
        ]);
      } else {
        session.setChatHistory(priorHistory);
      }
    }

    // Count input tokens
    const inputText = options.prompt
      .map((m) => {
        if (m.role === "system") return m.content;
        if (m.role === "user")
          return m.content
            .filter((p) => p.type === "text")
            .map((p) => p.text)
            .join("");
        if (m.role === "assistant")
          return m.content
            .filter((p): p is { type: "text"; text: string } => p.type === "text")
            .map((p) => p.text)
            .join("");
        return "";
      })
      .join("");
    const inputTokens = entry.model.tokenize(inputText).length;

    const textId = `text_${crypto.randomUUID().slice(0, 8)}`;
    let outputTokenCount = 0;

    // Track cleanup so it only runs once
    let cleaned = false;
    const cleanup = () => {
      if (cleaned) return;
      cleaned = true;
      session.dispose();
      sequence.dispose();
    };

    const stream = new ReadableStream<LanguageModelV3StreamPart>({
      start: async (controller) => {
        try {
          // Emit stream-start
          controller.enqueue({ type: "stream-start", warnings });

          // Emit text-start
          controller.enqueue({ type: "text-start", id: textId });

          // Build prompt options with streaming via onTextChunk
          const promptOptions: LLamaChatPromptOptions = {
            maxTokens: options.maxOutputTokens,
            temperature: options.temperature,
            topP: options.topP,
            topK: options.topK,
            signal: options.abortSignal,
            stopOnAbortSignal: true,
            onTextChunk: (text: string) => {
              outputTokenCount += entry.model.tokenize(text).length;
              controller.enqueue({
                type: "text-delta",
                id: textId,
                delta: text,
              });
            },
          };

          // Handle stop sequences
          if (options.stopSequences && options.stopSequences.length > 0) {
            promptOptions.customStopTriggers = options.stopSequences;
          }

          // Handle structured output via JSON grammar
          if (
            options.responseFormat?.type === "json" &&
            options.responseFormat.schema
          ) {
            const llama = this.modelManager.getLlama();
            if (llama) {
              const grammar = await llama.createGrammarForJsonSchema(
                options.responseFormat.schema as any,
              );
              (promptOptions as any).grammar = grammar;
            }
          }

          // Handle tool calling
          const functions = buildFunctions(options.tools);
          if (functions) {
            (promptOptions as any).functions = functions;
            (promptOptions as any).documentFunctionParams = true;
          }

          // Run the prompt
          const result = await session.promptWithMeta(
            lastUserMessage,
            promptOptions as any,
          );

          // Emit tool calls if any
          for (const item of result.response) {
            if (
              typeof item === "object" &&
              "type" in item &&
              item.type === "functionCall"
            ) {
              const toolCallId = `call_${crypto.randomUUID().slice(0, 8)}`;
              const inputStr = JSON.stringify(item.params);
              controller.enqueue({
                type: "tool-input-start",
                id: toolCallId,
                toolName: item.name,
              });
              controller.enqueue({
                type: "tool-input-delta",
                id: toolCallId,
                delta: inputStr,
              });
              controller.enqueue({
                type: "tool-input-end",
                id: toolCallId,
              });
              controller.enqueue({
                type: "tool-call",
                toolCallId,
                toolName: item.name,
                input: inputStr,
              });
            }
          }

          // Emit text-end
          controller.enqueue({ type: "text-end", id: textId });

          // Emit finish
          const finishReason = mapStopReason(result.stopReason);
          const usage: LanguageModelV3Usage = {
            inputTokens: {
              total: inputTokens,
              noCache: inputTokens,
              cacheRead: undefined,
              cacheWrite: undefined,
            },
            outputTokens: {
              total: outputTokenCount,
              text: outputTokenCount,
              reasoning: undefined,
            },
          };

          controller.enqueue({ type: "finish", usage, finishReason });
          controller.close();

          // Delay cleanup to allow the stream to flush to the network.
          // controller.close() signals no more chunks but doesn't wait for
          // the HTTP response body to be fully sent to the client.
          setTimeout(cleanup, 100);
        } catch (err) {
          controller.enqueue({
            type: "error",
            error: err,
          });
          controller.close();
          cleanup();
        }
      },
      cancel: () => {
        // Stream was cancelled by the client (e.g. abort)
        cleanup();
      },
    });

    return { stream };
  }
}
