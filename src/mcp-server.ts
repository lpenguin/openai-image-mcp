#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import * as dotenv from 'dotenv';
import { OpenAiProvider } from './openai-provider';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();

// Check for required environment variables
if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY environment variable is required');
  console.error('Please provide your OpenAI API key in the .env file or in the MCP settings configuration.');
  process.exit(1);
}

// Validate API key format (basic check)
if (!process.env.OPENAI_API_KEY.startsWith('sk-')) {
  console.error('WARNING: The OPENAI_API_KEY does not appear to be in the expected format.');
  console.error('OpenAI API keys typically start with "sk-".');
}

class ImageGenerationServer {
  private server: Server;
  private openAiProvider: OpenAiProvider;

  constructor() {
    this.server = new Server(
      {
        name: 'image-generation-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Initialize OpenAI provider
    this.openAiProvider = new OpenAiProvider(process.env.OPENAI_API_KEY as string);

    // Setup tool handlers
    this.setupToolHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error('[MCP Error]', error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'generate_image',
          description: 'Generate an image using OpenAI\'s DALL-E model',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'A text description of the desired image',
              },
              model: {
                type: 'string',
                description: 'The model to use for image generation',
                enum: ['gpt-image-1', 'dall-e-3', 'dall-e-2'],
                default: 'gpt-image-1',
              },
              n: {
                type: 'integer',
                description: 'Number of images to generate',
                minimum: 1,
                maximum: 10,
                default: 1,
              },
              size: {
                type: 'string',
                description: 'Size of the generated image',
                enum: ['1024x1024', '1792x1024', '1024x1792', '512x512', '256x256'],
                default: '1024x1024',
              },
              quality: {
                type: 'string',
                description: 'Quality of the generated image',
                enum: ['standard', 'hd'],
                default: 'standard',
              },
              style: {
                type: 'string',
                description: 'Style of the generated image',
                enum: ['vivid', 'natural'],
                default: 'vivid',
              },
              response_format: {
                type: 'string',
                description: 'Format of the response',
                enum: ['url', 'b64_json'],
                default: 'url',
              },
            },
            required: ['prompt'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (request.params.name !== 'generate_image') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      const args = request.params.arguments as {
        prompt: string;
        model?: string;
        n?: number;
        size?: string;
        quality?: string;
        style?: string;
        response_format?: string;
      };
      
      // Validate required parameters
      if (!args.prompt) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Prompt is required'
        );
      }

      try {
        const options: Partial<OpenAI.Images.ImageGenerateParams> = {
          model: args.model as OpenAI.Images.ImageGenerateParams['model'],
          n: args.n,
          size: args.size as OpenAI.Images.ImageGenerateParams['size'],
          quality: args.quality as OpenAI.Images.ImageGenerateParams['quality'],
          style: args.style as OpenAI.Images.ImageGenerateParams['style'],
          response_format: args.response_format as OpenAI.Images.ImageGenerateParams['response_format'],
        };

        console.error('Sending request to OpenAI with options:', JSON.stringify(options, null, 2));
        console.error('Prompt:', args.prompt);
        
        const result = await this.openAiProvider.generateImage(args.prompt, options);
        
        // Format the response for MCP
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        console.error('Error generating image:', error);
        
        return {
          content: [
            {
              type: 'text',
              text: `Error generating image: ${(error as Error).message || 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Image Generation MCP server running on stdio');
  }
}

const server = new ImageGenerationServer();
server.run().catch(console.error);
