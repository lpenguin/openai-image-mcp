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
          name: 'generate_image',
          description: 'Generate an image using OpenAI\'s image generation models (DALL-E or GPT-Image) and save it to a file',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'A text description of the desired image. Max length: 32000 chars (gpt-image-1), 4000 chars (dall-e-3), 1000 chars (dall-e-2)',
              },
              output: {
                type: 'string',
                description: 'File path where the generated image should be saved (e.g., /path/to/image.png)',
              },
              model: {
                type: 'string',
                description: 'The model to use for image generation',
                enum: ['gpt-image-1', 'dall-e-3', 'dall-e-2'],
                default: 'dall-e-2',
              },
              // Common parameters
              n: {
                type: 'integer',
                description: 'Number of images to generate (1-10 for dall-e-2/gpt-image-1, only 1 for dall-e-3)',
                minimum: 1,
                maximum: 10,
                default: 1,
              },
              size: {
                type: 'string',
                description: 'Size: gpt-image-1(1024x1024,1536x1024,1024x1536,auto), dall-e-3(1024x1024,1792x1024,1024x1792), dall-e-2(256x256,512x512,1024x1024)',
              },
              quality: {
                type: 'string',
                description: 'Quality: gpt-image-1(low,medium,high,auto), dall-e-3(standard,hd)',
              },
              // dall-e-3 specific
              style: {
                type: 'string',
                description: 'Style for dall-e-3 only: vivid or natural',
                enum: ['vivid', 'natural'],
              },
              // dall-e-2 and dall-e-3 specific
              response_format: {
                type: 'string',
                description: 'Response format for dall-e-2/dall-e-3 only (not supported by gpt-image-1)',
                enum: ['url', 'b64_json'],
              },
              // gpt-image-1 specific parameters
              background: {
                type: 'string',
                description: 'Background transparency for gpt-image-1 only',
                enum: ['transparent', 'opaque', 'auto'],
              },
              moderation: {
                type: 'string',
                description: 'Content moderation level for gpt-image-1 only',
                enum: ['low', 'auto'],
              },
              output_compression: {
                type: 'integer',
                description: 'Compression level (0-100) for gpt-image-1 with webp/jpeg format',
                minimum: 0,
                maximum: 100,
              },
              output_format: {
                type: 'string',
                description: 'Output format for gpt-image-1 only',
                enum: ['png', 'jpeg', 'webp'],
              },
              partial_images: {
                type: 'integer',
                description: 'Number of partial images (0-3) for streaming with gpt-image-1',
                minimum: 0,
                maximum: 3,
              },
              stream: {
                type: 'boolean',
                description: 'Enable streaming mode for gpt-image-1 only',
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
      if (request.params.name !== 'generate_image') {
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
      }

      const args = request.params.arguments as {
        prompt: string;
        output: string;
        model?: 'gpt-image-1' | 'dall-e-3' | 'dall-e-2';
        n?: number;
        size?: string;
        quality?: string;
        style?: 'vivid' | 'natural';
        response_format?: 'url' | 'b64_json';
        // gpt-image-1 specific
        background?: 'transparent' | 'opaque' | 'auto';
        moderation?: 'low' | 'auto';
        output_compression?: number;
        output_format?: 'png' | 'jpeg' | 'webp';
        partial_images?: number;
        stream?: boolean;
        user?: string;
      };
      
      // Validate required parameters
      if (!args.prompt) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Prompt is required'
        );
      }
      
      if (!args.output) {
        throw new McpError(
          ErrorCode.InvalidParams,
          'Output file path is required'
        );
      }

      try {
        const model = args.model || 'dall-e-2';
        
        // Build options based on model type
        let options: ImageGenerationOptions;
        
        if (model === 'gpt-image-1') {
          options = {
            model: 'gpt-image-1',
            n: args.n,
            size: args.size as any,
            quality: args.quality as any,
            background: args.background,
            moderation: args.moderation,
            output_compression: args.output_compression,
            output_format: args.output_format,
            partial_images: args.partial_images,
            stream: args.stream,
            user: args.user,
          };
        } else if (model === 'dall-e-3') {
          options = {
            model: 'dall-e-3',
            n: 1, // dall-e-3 only supports n=1
            size: args.size as any,
            quality: args.quality as any,
            style: args.style,
            response_format: args.response_format,
            user: args.user,
          };
        } else {
          options = {
            model: 'dall-e-2',
            n: args.n,
            size: args.size as any,
            response_format: args.response_format,
            user: args.user,
          };
        }

        console.error('Sending request to OpenAI with options:', JSON.stringify(options, null, 2));
        console.error('Prompt:', args.prompt);
        console.error('Output:', args.output);
        
        const result = await this.openAiProvider.generateImage(args.prompt, args.output, options);
        
        // Format the response for MCP
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
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
