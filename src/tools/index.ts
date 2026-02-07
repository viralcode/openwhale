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
import { cameraTools } from "./camera.js";
import { extendTool } from "./extend.js";
import { planningTool } from "./planning-tool.js";
import { pdfTool } from "./pdf.js";
import { imessageTool } from "./imessage.js";

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
toolRegistry.register(extendTool);
toolRegistry.register(pdfTool);
toolRegistry.register(planningTool);
toolRegistry.register(imessageTool as any);

// Register camera tools
for (const tool of cameraTools) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    toolRegistry.register(tool as any);
}

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
export { cameraTools } from "./camera.js";
export { extendTool } from "./extend.js";
export { pdfTool } from "./pdf.js";
export { planningTool } from "./planning-tool.js";
export { imessageTool } from "./imessage.js";
