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

export interface ImageGenerationResult {
  response: OpenAI.Images.ImagesResponse;
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
      
      // Build parameters based on model type
      let params: OpenAI.Images.ImageGenerateParams;
      
      if (model === "gpt-image-1" || model === "gpt-image-1-mini") {
        const gptOptions = options as GptImage1Options | GptImage1MiniOptions;
        params = {
          model: model,
          prompt: prompt,
          n: gptOptions.n,
          size: gptOptions.size,
          quality: gptOptions.quality,
          background: gptOptions.background,
          moderation: gptOptions.moderation,
          output_compression: gptOptions.output_compression,
          output_format: gptOptions.output_format,
          response_format: 'b64_json', // Always use base64 since we're saving to file
          user: gptOptions.user,
        } as OpenAI.Images.ImageGenerateParams;
      } else if (model === "dall-e-3") {
        const dalle3Options = options as DallE3Options;
        params = {
          model: 'dall-e-3',
          prompt: prompt,
          n: 1, // dall-e-3 only supports n=1
          size: dalle3Options.size,
          quality: dalle3Options.quality,
          style: dalle3Options.style,
          response_format: 'b64_json', // Always use base64 since we're saving to file
          user: dalle3Options.user,
        } as OpenAI.Images.ImageGenerateParams;
      } else {
        const dalle2Options = options as DallE2Options;
        params = {
          model: 'dall-e-2',
          prompt: prompt,
          n: dalle2Options.n,
          size: dalle2Options.size,
          response_format: 'b64_json', // Always use base64 since we're saving to file
          user: dalle2Options.user,
        } as OpenAI.Images.ImageGenerateParams;
      }
      
      const response = await this.client.images.generate(params);
      
      console.error('OpenAI Provider - Image generated successfully');
      
      // Save images to disk
      const savedFiles = await this.saveImages(response, outputPath, model);
      
      return { response, savedFiles };
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
      
      // All images are now base64 encoded
      if (imageData.b64_json) {
        console.error(`Decoding base64 image to ${filePath}`);
        const buffer = Buffer.from(imageData.b64_json, 'base64');
        fs.writeFileSync(filePath, buffer);
      } else {
        throw new Error('Image data missing b64_json');
      }
      
      savedFiles.push(filePath);
      console.error(`Image saved to: ${filePath}`);
    }
    
    return savedFiles;
  }
}
