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
import { OpenAiProvider, ImageGenerationOptions } from './openai-provider.js';
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
          name: 'generate_image_gpt',
          description: 'Generate an image using OpenAI\'s gpt-image-1 model and save it to a file. Supports transparency, custom output formats, and high-quality generation.',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'A text description of the desired image (max 32000 characters)',
              },
              output: {
                type: 'string',
                description: 'File path where the generated image should be saved (e.g., /path/to/image.png)',
              },
              n: {
                type: 'integer',
                description: 'Number of images to generate (1-10)',
                minimum: 1,
                maximum: 10,
                default: 1,
              },
              size: {
                type: 'string',
                description: 'Size of the generated image',
                enum: ['1024x1024', '1536x1024', '1024x1536', 'auto'],
                default: 'auto',
              },
              quality: {
                type: 'string',
                description: 'Quality of the generated image',
                enum: ['low', 'medium', 'high', 'auto'],
                default: 'auto',
              },
              background: {
                type: 'string',
                description: 'Background transparency setting',
                enum: ['transparent', 'opaque', 'auto'],
                default: 'auto',
              },
              moderation: {
                type: 'string',
                description: 'Content moderation level',
                enum: ['low', 'auto'],
                default: 'auto',
              },
              output_compression: {
                type: 'integer',
                description: 'Compression level (0-100) for webp/jpeg formats',
                minimum: 0,
                maximum: 100,
                default: 100,
              },
              output_format: {
                type: 'string',
                description: 'Output image format',
                enum: ['png', 'jpeg', 'webp'],
                default: 'png',
              },
              user: {
                type: 'string',
                description: 'Unique identifier for your end-user (optional)',
              },
            },
            required: ['prompt', 'output'],
          },
        },
        {
          name: 'generate_image_dalle3',
          description: 'Generate an image using OpenAI\'s DALL-E 3 model and save it to a file. Best quality and most advanced model with style control.',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'A text description of the desired image (max 4000 characters)',
              },
              output: {
                type: 'string',
                description: 'File path where the generated image should be saved (e.g., /path/to/image.png)',
              },
              size: {
                type: 'string',
                description: 'Size of the generated image',
                enum: ['1024x1024', '1792x1024', '1024x1792'],
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
                description: 'Style of the generated image. Vivid creates hyper-real and dramatic images. Natural creates more natural, less hyper-real images.',
                enum: ['vivid', 'natural'],
                default: 'vivid',
              },
              user: {
                type: 'string',
                description: 'Unique identifier for your end-user (optional)',
              },
            },
            required: ['prompt', 'output'],
          },
        },
        {
          name: 'generate_image_dalle2',
          description: 'Generate an image using OpenAI\'s DALL-E 2 model and save it to a file. Fast and cost-effective option.',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'A text description of the desired image (max 1000 characters)',
              },
              output: {
                type: 'string',
                description: 'File path where the generated image should be saved (e.g., /path/to/image.png)',
              },
              n: {
                type: 'integer',
                description: 'Number of images to generate (1-10)',
                minimum: 1,
                maximum: 10,
                default: 1,
              },
              size: {
                type: 'string',
                description: 'Size of the generated image',
                enum: ['256x256', '512x512', '1024x1024'],
                default: '1024x1024',
              },
              user: {
                type: 'string',
                description: 'Unique identifier for your end-user (optional)',
              },
            },
            required: ['prompt', 'output'],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      
      // Route to appropriate handler based on tool name
      if (toolName === 'generate_image_gpt') {
        return this.handleGptImageGeneration(request.params.arguments);
      } else if (toolName === 'generate_image_dalle3') {
        return this.handleDalle3Generation(request.params.arguments);
      } else if (toolName === 'generate_image_dalle2') {
        return this.handleDalle2Generation(request.params.arguments);
      } else {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${toolName}`
        );
      }
    });
  }

  private async handleGptImageGeneration(args: any) {
    // Validate required parameters
    if (!args.prompt) {
      throw new McpError(ErrorCode.InvalidParams, 'Prompt is required');
    }
    if (!args.output) {
      throw new McpError(ErrorCode.InvalidParams, 'Output file path is required');
    }

    try {
      const options: ImageGenerationOptions = {
        model: 'gpt-image-1',
        n: args.n,
        size: args.size as any,
        quality: args.quality as any,
        background: args.background,
        moderation: args.moderation,
        output_compression: args.output_compression,
        output_format: args.output_format,
        user: args.user,
      };

      console.error('Sending gpt-image-1 request to OpenAI');
      console.error('Prompt:', args.prompt);
      console.error('Output:', args.output);
      
      const result = await this.openAiProvider.generateImage(args.prompt, args.output, options);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              model: 'gpt-image-1',
              savedFiles: result.savedFiles,
              response: result.response,
            }, null, 2),
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
  }

  private async handleDalle3Generation(args: any) {
    // Validate required parameters
    if (!args.prompt) {
      throw new McpError(ErrorCode.InvalidParams, 'Prompt is required');
    }
    if (!args.output) {
      throw new McpError(ErrorCode.InvalidParams, 'Output file path is required');
    }

    try {
      const options: ImageGenerationOptions = {
        model: 'dall-e-3',
        n: 1, // dall-e-3 only supports n=1
        size: args.size as any,
        quality: args.quality as any,
        style: args.style,
        user: args.user,
      };

      console.error('Sending dall-e-3 request to OpenAI');
      console.error('Prompt:', args.prompt);
      console.error('Output:', args.output);
      
      const result = await this.openAiProvider.generateImage(args.prompt, args.output, options);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              model: 'dall-e-3',
              savedFiles: result.savedFiles,
              response: result.response,
            }, null, 2),
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
  }

  private async handleDalle2Generation(args: any) {
    // Validate required parameters
    if (!args.prompt) {
      throw new McpError(ErrorCode.InvalidParams, 'Prompt is required');
    }
    if (!args.output) {
      throw new McpError(ErrorCode.InvalidParams, 'Output file path is required');
    }

    try {
      const options: ImageGenerationOptions = {
        model: 'dall-e-2',
        n: args.n,
        size: args.size as any,
        user: args.user,
      };

      console.error('Sending dall-e-2 request to OpenAI');
      console.error('Prompt:', args.prompt);
      console.error('Output:', args.output);
      
      const result = await this.openAiProvider.generateImage(args.prompt, args.output, options);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              model: 'dall-e-2',
              savedFiles: result.savedFiles,
              response: result.response,
            }, null, 2),
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
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Image Generation MCP server running on stdio');
  }
}

const server = new ImageGenerationServer();
server.run().catch(console.error);
