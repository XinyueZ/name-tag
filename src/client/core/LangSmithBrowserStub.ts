/**
 * LangSmithBrowserStub: Pure-browser no-op replacement for Node-only langsmith
 * tracing imports inside @langchain/core/vectorstores.
 */
export class Client {
  public constructor(_config?: Record<string, unknown>) {}
  public async createRun(): Promise<void> {}
  public async updateRun(): Promise<void> {}
}

export class RunTree {
  public constructor(_config?: Record<string, unknown>) {}
  public static getCurrentRunTree(): undefined {
    return undefined
  }
  public static isRunTree(_x?: unknown): boolean {
    return false
  }
  public static convertToDottedOrderFormat(startTime?: number, runId = ''): string {
    return String(startTime ?? '') + runId
  }
  public createChild(): RunTree {
    return new RunTree()
  }
}

export class LangSmithTraceableStub {
  public static getCurrentRunTree(): undefined {
    return undefined
  }
  public static isTraceableFunction(_fn?: unknown): boolean {
    return false
  }
}

export const getCurrentRunTree = LangSmithTraceableStub.getCurrentRunTree
export const isTraceableFunction = LangSmithTraceableStub.isTraceableFunction
export const isRunTree = RunTree.isRunTree
export const convertToDottedOrderFormat = RunTree.convertToDottedOrderFormat
