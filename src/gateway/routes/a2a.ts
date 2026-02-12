/**
 * A2A Protocol Routes — HTTP endpoints for Agent2Agent Protocol
 * 
 * Implements:
 * - GET  /.well-known/agent.json  — Agent Card discovery (public)
 * - POST /a2a                     — JSON-RPC 2.0 endpoint
 */

import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { DrizzleDB } from "../../db/connection.js";
import type { OpenWhaleConfig } from "../../config/loader.js";
import {
    getAgentCard,
    processJsonRpcRequest,
    handleSendStreamingMessage,
} from "../../agents/a2a-server.js";
import type { JsonRpcRequest, SendMessageParams } from "../../agents/a2a-types.js";
import { A2AErrorCodes } from "../../agents/a2a-types.js";

export function createA2ARoutes(_db: DrizzleDB, _config: OpenWhaleConfig) {
    const a2a = new Hono();

    // ============== AGENT CARD DISCOVERY ==============
    // Public endpoint — no auth required
    a2a.get("/.well-known/agent.json", (c) => {
        const protocol = c.req.header("x-forwarded-proto") || "http";
        const host = c.req.header("host") || "localhost:7777";
        const baseUrl = `${protocol}://${host}`;

        const card = getAgentCard(baseUrl);
        return c.json(card, 200, {
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=3600",
        });
    });

    // ============== JSON-RPC ENDPOINT ==============
    a2a.post("/a2a", async (c) => {
        let body: JsonRpcRequest;

        try {
            body = await c.req.json<JsonRpcRequest>();
        } catch {
            return c.json({
                jsonrpc: "2.0",
                id: null,
                error: {
                    code: A2AErrorCodes.PARSE_ERROR,
                    message: "Invalid JSON in request body",
                },
            }, 400);
        }

        // Validate JSON-RPC envelope
        if (body.jsonrpc !== "2.0" || !body.method || body.id === undefined) {
            return c.json({
                jsonrpc: "2.0",
                id: body?.id ?? null,
                error: {
                    code: A2AErrorCodes.INVALID_REQUEST,
                    message: "Invalid JSON-RPC 2.0 request. Required: jsonrpc='2.0', method, id",
                },
            }, 400);
        }

        // Handle streaming separately (returns SSE)
        if (body.method === "SendStreamingMessage") {
            const params = body.params as unknown as SendMessageParams;
            if (!params?.message) {
                return c.json({
                    jsonrpc: "2.0",
                    id: body.id,
                    error: {
                        code: A2AErrorCodes.INVALID_PARAMS,
                        message: "Missing required parameter: message",
                    },
                }, 400);
            }

            return streamSSE(c, async (stream) => {
                for await (const event of handleSendStreamingMessage(params)) {
                    await stream.writeSSE({
                        data: JSON.stringify({
                            jsonrpc: "2.0",
                            id: body.id,
                            result: event.data,
                        }),
                        event: event.type,
                    });
                }
            });
        }

        // Dispatch to JSON-RPC handler
        const response = await processJsonRpcRequest(body);

        // Determine HTTP status from error code
        const status = response.error ? (
            response.error.code === A2AErrorCodes.METHOD_NOT_FOUND ? 404 :
                response.error.code === A2AErrorCodes.INVALID_PARAMS ? 400 :
                    response.error.code === A2AErrorCodes.TASK_NOT_FOUND ? 404 :
                        response.error.code === A2AErrorCodes.INTERNAL_ERROR ? 500 : 400
        ) : 200;

        return c.json(response, status);
    });

    return a2a;
}
