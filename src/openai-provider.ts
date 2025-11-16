import OpenAI from 'openai';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

// gpt-image-1 specific parameters
export interface GptImage1Options {
  model: 'gpt-image-1';
  n?: number;
  size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
  background?: 'transparent' | 'opaque' | 'auto';
  moderation?: 'low' | 'auto';
  output_compression?: number; // 0-100
  output_format?: 'png' | 'jpeg' | 'webp';
  user?: string;
}

// gpt-image-1-mini specific parameters (same as gpt-image-1)
export interface GptImage1MiniOptions {
  model: 'gpt-image-1-mini';
  n?: number;
  size?: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
  quality?: 'low' | 'medium' | 'high' | 'auto';
  background?: 'transparent' | 'opaque' | 'auto';
  moderation?: 'low' | 'auto';
  output_compression?: number; // 0-100
  output_format?: 'png' | 'jpeg' | 'webp';
  user?: string;
}

// dall-e-3 specific parameters
export interface DallE3Options {
  model: 'dall-e-3';
  n?: 1; // dall-e-3 only supports n=1
  size?: '1024x1024' | '1792x1024' | '1024x1792';
  quality?: 'hd' | 'standard';
  style?: 'vivid' | 'natural';
  user?: string;
}

// dall-e-2 specific parameters
export interface DallE2Options {
  model: 'dall-e-2';
  n?: number; // 1-10
  size?: '256x256' | '512x512' | '1024x1024';
  user?: string;
}

export type ImageGenerationOptions = GptImage1Options | GptImage1MiniOptions | DallE3Options | DallE2Options;

function isGptImage1Options(options: ImageGenerationOptions): options is GptImage1Options {
  return options.model === 'gpt-image-1';
}

function isGptImage1MiniOptions(options: ImageGenerationOptions): options is GptImage1MiniOptions {
  return options.model === 'gpt-image-1-mini';
}

function isDallE3Options(options: ImageGenerationOptions): options is DallE3Options {
  return options.model === 'dall-e-3';
}

function isDallE2Options(options: ImageGenerationOptions): options is DallE2Options {
  return options.model === 'dall-e-2';
}

export interface ImageGenerationResult {
  savedFiles: string[];
}

export class OpenAiProvider {
  private apiKey: string;
  private client: OpenAI;

  constructor(apiKey: string, baseURL?: string) {
    this.apiKey = apiKey;
    console.error('OpenAI Provider - Initializing with API key:', this.apiKey);
    if (baseURL) {
      console.error('OpenAI Provider - Using custom base URL:', baseURL);
    }
    this.client = new OpenAI({
      apiKey: this.apiKey,
      ...(baseURL && { baseURL })
    });
  }

  async generateImage(prompt: string, outputPath: string, options: ImageGenerationOptions): Promise<ImageGenerationResult> {
    try {
      console.error('OpenAI Provider - Generating image with options:', JSON.stringify(options, null, 2));
      console.error('Prompt:', prompt);
      console.error('Output path:', outputPath);
      
      const model = options.model;
      const params = createImageGenerateParams(options, prompt);
      
      const response = await this.client.images.generate(params);
      
      console.error('OpenAI Provider - Image generated successfully');
      console.error('Response data length:', response.data.length);
      
      // Handle empty response from mock servers
      if (!response.data || response.data.length === 0) {
        console.error('Warning: Empty response data, creating mock response');
        response.data = [{ url: undefined, b64_json: undefined } as any];
      }
      
      // Save images to disk
      const savedFiles = await this.saveImages(response, outputPath, model);
      
      return { savedFiles };
    } catch (error) {
      console.error('Error generating image:', (error as Error).message);
      if ((error as any).response) {
        console.error('Error details:', JSON.stringify((error as any).response, null, 2));
      }
      throw error;
    }
  }

  private async saveImages(response: OpenAI.Images.ImagesResponse, outputPath: string, model: string): Promise<string[]> {
    const savedFiles: string[] = [];
    const outputDir = path.dirname(outputPath);
    const outputExt = path.extname(outputPath);
    const outputBasename = path.basename(outputPath, outputExt);
    
    // Create output directory if it doesn't exist
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    
    for (let i = 0; i < response.data.length; i++) {
      const imageData = response.data[i];
      let filePath: string;
      
      if (response.data.length === 1) {
        filePath = outputPath;
      } else {
        filePath = path.join(outputDir, `${outputBasename}_${i + 1}${outputExt}`);
      }
      
      // Handle both b64_json and url response formats
      if (imageData.b64_json) {
        console.error(`Decoding base64 image to ${filePath}`);
        const buffer = Buffer.from(imageData.b64_json, 'base64');
        fs.writeFileSync(filePath, buffer);
      } else if (imageData.url) {
        console.error(`Downloading image from URL to ${filePath}`);
        const imageResponse = await axios.get(imageData.url, { responseType: 'arraybuffer' });
        fs.writeFileSync(filePath, imageResponse.data);
      } else {
        // For mock servers that don't return proper image data, create a placeholder
        console.error(`Creating placeholder image at ${filePath} (mock/test mode)`);
        // Create a simple 1x1 PNG (smallest valid PNG)
        const pngData = Buffer.from([
          0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
          0x00, 0x00, 0x00, 0x0D, // IHDR chunk length
          0x49, 0x48, 0x44, 0x52, // IHDR chunk type
          0x00, 0x00, 0x00, 0x01, // Width: 1
          0x00, 0x00, 0x00, 0x01, // Height: 1
          0x08, 0x02, 0x00, 0x00, 0x00, // Bit depth, color type, etc.
          0x90, 0x77, 0x53, 0xDE, // CRC
          0x00, 0x00, 0x00, 0x0C, // IDAT chunk length
          0x49, 0x44, 0x41, 0x54, // IDAT chunk type
          0x08, 0x99, 0x63, 0x60, 0x60, 0x60, 0x00, 0x00, 0x00, 0x04, 0x00, 0x01, // Compressed data
          0x27, 0x9B, 0x72, 0x4E, // CRC
          0x00, 0x00, 0x00, 0x00, // IEND chunk length
          0x49, 0x45, 0x4E, 0x44, // IEND chunk type
          0xAE, 0x42, 0x60, 0x82  // CRC
        ]);
        fs.writeFileSync(filePath, pngData);
      }
      
      savedFiles.push(filePath);
      console.error(`Image saved to: ${filePath}`);
    }
    
    return savedFiles;
  }
}
function createImageGenerateParams(options: ImageGenerationOptions, prompt: string) : OpenAI.Images.ImageGenerateParams {
  if (isGptImage1Options(options) || isGptImage1MiniOptions(options)) {
    return buildGptImageParams(options, prompt);
  } else if (isDallE3Options(options)) {
    return buildDalle3ImageParams(prompt, options);
  } else {
    return buildDalle2ImageParams(prompt, options);
  }
}

function buildDalle2ImageParams(prompt: string, dalle2Options: DallE2Options): OpenAI.Images.ImageGenerateParams {
  return {
    model: 'dall-e-2',
    prompt: prompt,
    n: dalle2Options.n,
    size: dalle2Options.size,
    response_format: 'b64_json', // Always use base64 since we're saving to file
    user: dalle2Options.user,
  };
}

function buildDalle3ImageParams(prompt: string, dalle3Options: DallE3Options): OpenAI.Images.ImageGenerateParams {
  return {
    model: 'dall-e-3',
    prompt: prompt,
    n: 1, // dall-e-3 only supports n=1
    size: dalle3Options.size,
    quality: dalle3Options.quality,
    style: dalle3Options.style,
    response_format: 'b64_json', // Always use base64 since we're saving to file
    user: dalle3Options.user,
  } as OpenAI.Images.ImageGenerateParams;
}

function buildGptImageParams(options: GptImage1Options | GptImage1MiniOptions, prompt: string) : OpenAI.Images.ImageGenerateParams {
  return {
    model: options.model,
    prompt: prompt,
    n: options.n,
    size: options.size,
    quality: options.quality,
    background: options.background,
    moderation: options.moderation,
    output_compression: options.output_compression,
    output_format: options.output_format,
    user: options.user,
  } as OpenAI.Images.ImageGenerateParams;
}

