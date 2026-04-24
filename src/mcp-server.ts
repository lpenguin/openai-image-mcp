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
import { OpenAiProvider, ImageGenerationOptions, ImageEditOptions } from './openai-provider.js';
import OpenAI from 'openai';

// Load environment variables
dotenv.config();

// Check for required environment variables
if (!process.env.OPENAI_API_KEY) {
  console.error('ERROR: OPENAI_API_KEY environment variable is required');
  console.error('Please provide your OpenAI API key in the .env file or in the MCP settings configuration.');
  process.exit(1);
}

// Validate API key format (basic check) - skip for test keys
if (!process.env.OPENAI_API_KEY.startsWith('sk-') && !process.env.OPENAI_API_KEY.includes('test')) {
  console.error('WARNING: The OPENAI_API_KEY does not appear to be in the expected format.');
  console.error('OpenAI API keys typically start with "sk-".');
}

// Optional: Use custom OpenAI API URL (useful for testing with mock servers)
const baseURL = process.env.OPENAI_API_URL;

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
    this.openAiProvider = new OpenAiProvider(process.env.OPENAI_API_KEY as string, baseURL);

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
          name: 'generate_image_gpt_mini',
          description: 'Generate an image using OpenAI\'s gpt-image-1-mini model and save it to a file. Cost-efficient alternative to gpt-image-1 with same features: transparency, custom output formats, and high-quality generation.',
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
          name: 'generate_image_gpt2',
          description: 'Generate an image using OpenAI\'s gpt-image-2 model (released Apr 21, 2026). Supports flexible resolutions up to 3840px per edge, batch of up to 10 images, multilingual text rendering, and high-quality generation.',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'A text description of the desired image',
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
                description: 'Size of the generated image. gpt-image-2 accepts any resolution where each edge is a multiple of 16, edges are <=3840px, aspect ratio <=3:1, and total pixels between 655,360 and 8,294,400. Popular sizes: 1024x1024, 1536x1024, 1024x1536, 2048x2048, 2048x1152, 3840x2160, 2160x3840, auto.',
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
                description: 'Background setting. Note: gpt-image-2 does not support transparent backgrounds at this time.',
                enum: ['opaque', 'auto'],
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
          name: 'generate_image_gpt2_thinking',
          description: 'Generate an image using OpenAI\'s gpt-image-2 model with reasoning-aware "thinking" mode enabled. Thinking mode trades latency for layout accuracy and is especially useful for infographics, diagrams, and text-heavy compositions. Accepts the same parameters as generate_image_gpt2 plus a thinking tier (low/medium/high).',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'A text description of the desired image',
              },
              output: {
                type: 'string',
                description: 'File path where the generated image should be saved (e.g., /path/to/image.png)',
              },
              thinking: {
                type: 'string',
                description: 'Thinking mode tier. Higher tiers use more reasoning tokens and take longer but produce better layout accuracy.',
                enum: ['low', 'medium', 'high'],
                default: 'medium',
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
                description: 'Size of the generated image. Same constraints as generate_image_gpt2.',
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
                description: 'Background setting. Note: gpt-image-2 does not support transparent backgrounds at this time.',
                enum: ['opaque', 'auto'],
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
          name: 'edit_image_dalle2',
          description: 'Edit or transform an existing image using DALL-E 2 (image-to-image). The source image must be a square RGBA or grayscale PNG, max 4MB. Optionally supply a mask PNG where transparent pixels mark the region to edit.',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'A text description of the desired edits (max 1000 characters)',
              },
              image: {
                type: 'string',
                description: 'Absolute file path to the source image. Must be a square RGBA or grayscale PNG, max 4MB.',
              },
              output: {
                type: 'string',
                description: 'File path where the edited image should be saved',
              },
              mask: {
                type: 'string',
                description: 'Absolute file path to an optional mask PNG. Transparent pixels indicate the region to edit; opaque pixels are preserved.',
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
                description: 'Size of the output image',
                enum: ['256x256', '512x512', '1024x1024'],
                default: '1024x1024',
              },
              user: {
                type: 'string',
                description: 'Unique identifier for your end-user (optional)',
              },
            },
            required: ['prompt', 'image', 'output'],
          },
        },
        {
          name: 'edit_image_gpt2',
          description: 'Edit or transform an existing image using OpenAI\'s gpt-image-2 model (image-to-image). Provide a source image and a prompt describing the desired changes. No mask required — the model infers edits from the prompt. Optionally supply a mask PNG to restrict edits to a specific region.',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'A text description of the desired edits or transformation',
              },
              image: {
                type: 'string',
                description: 'Absolute file path to the source image (PNG recommended)',
              },
              output: {
                type: 'string',
                description: 'File path where the edited image should be saved',
              },
              mask: {
                type: 'string',
                description: 'Optional mask PNG path. Transparent pixels mark the region to edit.',
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
                description: 'Size of the output image',
                enum: ['1024x1024', '1536x1024', '1024x1536', 'auto'],
                default: 'auto',
              },
              quality: {
                type: 'string',
                enum: ['low', 'medium', 'high', 'auto'],
                default: 'auto',
              },
              output_format: {
                type: 'string',
                enum: ['png', 'jpeg', 'webp'],
                default: 'png',
              },
              user: { type: 'string' },
            },
            required: ['prompt', 'image', 'output'],
          },
        },
        {
          name: 'edit_image_gpt',
          description: 'Edit or transform an existing image using OpenAI\'s gpt-image-1 model (image-to-image). Provide a source image and a prompt describing the desired changes. Optionally supply a mask PNG to restrict edits to a specific region.',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'A text description of the desired edits or transformation (max 32000 characters)',
              },
              image: {
                type: 'string',
                description: 'Absolute file path to the source image (PNG, JPEG, or WEBP)',
              },
              output: {
                type: 'string',
                description: 'File path where the edited image should be saved',
              },
              mask: {
                type: 'string',
                description: 'Absolute file path to an optional mask PNG. Transparent pixels indicate areas to edit; opaque pixels are preserved.',
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
                description: 'Size of the output image',
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
            required: ['prompt', 'image', 'output'],
          },
        },
        {
          name: 'edit_image_gpt_mini',
          description: 'Edit or transform an existing image using OpenAI\'s gpt-image-1-mini model (image-to-image). Cost-efficient alternative to edit_image_gpt with the same parameters.',
          inputSchema: {
            type: 'object',
            properties: {
              prompt: {
                type: 'string',
                description: 'A text description of the desired edits or transformation (max 32000 characters)',
              },
              image: {
                type: 'string',
                description: 'Absolute file path to the source image (PNG, JPEG, or WEBP)',
              },
              output: {
                type: 'string',
                description: 'File path where the edited image should be saved',
              },
              mask: {
                type: 'string',
                description: 'Absolute file path to an optional mask PNG. Transparent pixels indicate areas to edit; opaque pixels are preserved.',
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
                description: 'Size of the output image',
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
            required: ['prompt', 'image', 'output'],
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
      } else if (toolName === 'generate_image_gpt_mini') {
        return this.handleGptImageMiniGeneration(request.params.arguments);
      } else if (toolName === 'generate_image_gpt2') {
        return this.handleGptImage2Generation(request.params.arguments, false);
      } else if (toolName === 'generate_image_gpt2_thinking') {
        return this.handleGptImage2Generation(request.params.arguments, true);
      } else if (toolName === 'generate_image_dalle3') {
        return this.handleDalle3Generation(request.params.arguments);
      } else if (toolName === 'generate_image_dalle2') {
        return this.handleDalle2Generation(request.params.arguments);
      } else if (toolName === 'edit_image_dalle2') {
        return this.handleGptImageEdit(request.params.arguments, 'dall-e-2');
      } else if (toolName === 'edit_image_gpt2') {
        return this.handleGptImageEdit(request.params.arguments, 'gpt-image-2');
      } else if (toolName === 'edit_image_gpt') {
        return this.handleGptImageEdit(request.params.arguments, 'gpt-image-1');
      } else if (toolName === 'edit_image_gpt_mini') {
        return this.handleGptImageEdit(request.params.arguments, 'gpt-image-1-mini');
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

  private async handleGptImageMiniGeneration(args: any) {
    // Validate required parameters
    if (!args.prompt) {
      throw new McpError(ErrorCode.InvalidParams, 'Prompt is required');
    }
    if (!args.output) {
      throw new McpError(ErrorCode.InvalidParams, 'Output file path is required');
    }

    try {
      const options: ImageGenerationOptions = {
        model: 'gpt-image-1-mini',
        n: args.n,
        size: args.size as any,
        quality: args.quality as any,
        background: args.background,
        moderation: args.moderation,
        output_compression: args.output_compression,
        output_format: args.output_format,
        user: args.user,
      };

      console.error('Sending gpt-image-1-mini request to OpenAI');
      console.error('Prompt:', args.prompt);
      console.error('Output:', args.output);
      
      const result = await this.openAiProvider.generateImage(args.prompt, args.output, options);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              model: 'gpt-image-1-mini',
              savedFiles: result.savedFiles,
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

  private async handleGptImage2Generation(args: any, thinkingMode: boolean) {
    // Validate required parameters
    if (!args.prompt) {
      throw new McpError(ErrorCode.InvalidParams, 'Prompt is required');
    }
    if (!args.output) {
      throw new McpError(ErrorCode.InvalidParams, 'Output file path is required');
    }

    try {
      // For the thinking tool, default to 'medium' if not provided.
      // For the standard tool, do not pass `thinking` at all.
      const thinking = thinkingMode
        ? (args.thinking ?? 'medium')
        : undefined;

      const options: ImageGenerationOptions = {
        model: 'gpt-image-2',
        n: args.n,
        size: args.size as any,
        quality: args.quality as any,
        background: args.background,
        moderation: args.moderation,
        output_compression: args.output_compression,
        output_format: args.output_format,
        thinking: thinking as any,
        user: args.user,
      };

      const label = thinkingMode ? `gpt-image-2 (thinking=${thinking})` : 'gpt-image-2';
      console.error(`Sending ${label} request to OpenAI`);
      console.error('Prompt:', args.prompt);
      console.error('Output:', args.output);

      const result = await this.openAiProvider.generateImage(args.prompt, args.output, options);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              model: 'gpt-image-2',
              thinking: thinking ?? null,
              savedFiles: result.savedFiles,
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

  private async handleGptImageEdit(args: any, model: 'gpt-image-2' | 'dall-e-2' | 'gpt-image-1' | 'gpt-image-1-mini') {
    if (!args.prompt) {
      throw new McpError(ErrorCode.InvalidParams, 'Prompt is required');
    }
    if (!args.image) {
      throw new McpError(ErrorCode.InvalidParams, 'Image file path is required');
    }
    if (!args.output) {
      throw new McpError(ErrorCode.InvalidParams, 'Output file path is required');
    }

    try {
      const options: ImageEditOptions = {
        model,
        n: args.n,
        size: args.size as any,
        quality: args.quality as any,
        background: args.background,
        moderation: args.moderation,
        output_compression: args.output_compression,
        output_format: args.output_format,
        user: args.user,
      };

      console.error(`Sending ${model} edit request to OpenAI`);
      console.error('Prompt:', args.prompt);
      console.error('Image:', args.image);
      console.error('Output:', args.output);

      const result = await this.openAiProvider.editImage(args.prompt, args.image, args.output, options, args.mask);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              model,
              savedFiles: result.savedFiles,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      console.error('Error editing image:', error);
      return {
        content: [
          {
            type: 'text',
            text: `Error editing image: ${(error as Error).message || 'Unknown error'}`,
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
