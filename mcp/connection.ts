import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { findOrCreatePr } from "./tools/github";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool as McpTool,
} from "@modelcontextprotocol/sdk/types.js";

export const createConnection = () => {
  const server = new Server(
    {
      name: "example-server",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  const tools = [
    {
      schema: {
        name: "github/findOrCreatePr",
        title: "PR 자동 생성",
        description:
          "현재 브랜치 변경사항을 요약하고 GitHub PR을 생성하거나 업데이트합니다.",
        inputSchema: {
          type: "object",
          properties: {
            issueId: {
              type: "string",
              description: "이슈 ID",
            },
            base: {
              type: "string",
              description: "기준 브랜치",
            },
          },
          required: ["issueId"],
        },
        type: "core" as const,
      },
      async run(args: { issueId: string; base?: string }) {
        const result = await findOrCreatePr(args);
        return {
          content: [
            {
              type: "text",
              text: `[${result.status}] ${result.url || result.message}`,
            },
          ],
        };
      },
    },
  ];

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: tools.map((tool) => ({
        name: tool.schema.name,
        description: tool.schema.description,
        inputSchema: tool.schema.inputSchema,
        annotations: {
          title: tool.schema.title,
          openWorldHint: true,
        },
      })) as McpTool[],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const tool = tools.find((tool) => tool.schema.name === request.params.name);
    if (!tool) {
      return {
        content: [
          { type: "text", text: `Tool "${request.params.name}" not found.` },
        ],
        isError: true,
      };
    }
    if (
      !request?.params?.arguments?.issueId ||
      !request?.params?.arguments?.base
    )
      throw new Error("issueId and base are required");
    return await tool.run(
      request.params.arguments as { issueId: string; base?: string }
    );
  });

  const transport = new StdioServerTransport();
  server.connect(transport);
};
