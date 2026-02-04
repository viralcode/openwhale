// Export all tools and register them
import { toolRegistry } from "./base.js";
import { execTool } from "./exec.js";
import { browserTool } from "./browser.js";
import { webFetchTool } from "./web-fetch.js";
import { imageTool } from "./image.js";
import { cronTool } from "./cron.js";
import { ttsTool } from "./tts.js";
import { fileTool } from "./file.js";
import { canvasTool } from "./canvas.js";
import { nodesTool } from "./nodes.js";
import { memoryTool } from "./memory.js";
import { codeExecTool } from "./code-exec.js";
import { screenshotTool } from "./screenshot.js";

// Register all tools
toolRegistry.register(execTool);
toolRegistry.register(browserTool);
toolRegistry.register(webFetchTool);
toolRegistry.register(imageTool);
toolRegistry.register(cronTool);
toolRegistry.register(ttsTool);
toolRegistry.register(fileTool);
toolRegistry.register(canvasTool);
toolRegistry.register(nodesTool);
toolRegistry.register(memoryTool);
toolRegistry.register(codeExecTool);
toolRegistry.register(screenshotTool);

export { toolRegistry } from "./base.js";
export type { AgentTool, ToolCallContext, ToolResult, ToolRegistry } from "./base.js";
export { execTool } from "./exec.js";
export { browserTool } from "./browser.js";
export { webFetchTool } from "./web-fetch.js";
export { imageTool } from "./image.js";
export { cronTool } from "./cron.js";
export { ttsTool } from "./tts.js";
export { fileTool } from "./file.js";
export { canvasTool } from "./canvas.js";
export { nodesTool } from "./nodes.js";
export { memoryTool } from "./memory.js";
export { codeExecTool } from "./code-exec.js";
export { screenshotTool } from "./screenshot.js";
