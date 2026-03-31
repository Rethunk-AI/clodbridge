/**
 * Shared mock MCP server implementation for tests.
 */

type Handler = (...args: unknown[]) => unknown;

export class MockMcpServer {
  private tools: Map<string, { description: string; handler: Handler }> = new Map();
  private resources: Map<string, { description?: object; handler: Handler }> = new Map();
  private prompts: Map<string, { description: string; handler: Handler }> = new Map();

  // Tool methods
  tool(name: string, description: string, _schema: object, handler: Handler) {
    this.tools.set(name, { description, handler });
  }

  async callTool(name: string, input?: object) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool ${name} not found`);
    return tool.handler(input || {});
  }

  getToolNames() {
    return Array.from(this.tools.keys());
  }

  // Resource methods
  resource(_name: string, uri: string, description?: object, handler?: Handler) {
    const actualHandler = handler || description;
    this.resources.set(uri, { description, handler: actualHandler as Handler });
  }

  async callResource(uriString: string, params?: Record<string, unknown>) {
    let handler: Function | undefined;
    let extractedParams: Record<string, unknown> = params || {};

    if (this.resources.has(uriString)) {
      handler = this.resources.get(uriString)?.handler;
    } else {
      for (const [resourceUri, resourceDef] of this.resources) {
        if (resourceUri.includes("{")) {
          const pattern = resourceUri
            .replace(/\{name\}/g, "([^/]+)")
            .replace(/\{type\}/g, "([^/]+)");
          const regex = new RegExp(`^${pattern}$`);
          const match = uriString.match(regex);

          if (match) {
            handler = resourceDef.handler;

            const paramNames = [];
            let paramMatch;
            const paramRegex = /\{(\w+)\}/g;
            while ((paramMatch = paramRegex.exec(resourceUri)) !== null) {
              paramNames.push(paramMatch[1]);
            }

            for (let i = 0; i < paramNames.length; i++) {
              extractedParams[paramNames[i]] = match[i + 1];
            }
            break;
          }
        }
      }
    }

    if (!handler) {
      throw new Error(`Resource ${uriString} not found`);
    }

    const mockUri = new MockUri(uriString);
    return handler(mockUri, extractedParams);
  }

  getResourceUris() {
    return Array.from(this.resources.keys());
  }

  // Prompt methods
  prompt(name: string, description: string, handler: Handler) {
    this.prompts.set(name, { description, handler });
  }

  async callPrompt(name: string) {
    const prompt = this.prompts.get(name);
    if (!prompt) throw new Error(`Prompt ${name} not found`);
    return prompt.handler();
  }

  getPromptNames() {
    return Array.from(this.prompts.keys());
  }
}

class MockUri {
  constructor(private uriString: string) {}
  toString() {
    return this.uriString;
  }
}
