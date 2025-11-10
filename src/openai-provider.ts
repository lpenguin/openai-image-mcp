import OpenAI from 'openai';

export class OpenAiProvider {
  private apiKey: string;
  private client: OpenAI;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    console.error('OpenAI Provider - Initializing with API key:', this.apiKey);
    this.client = new OpenAI({
      apiKey: this.apiKey
    });
  }

  async generateImage(prompt: string, options: Partial<OpenAI.Images.ImageGenerateParams> = {}): Promise<OpenAI.Images.ImagesResponse> {
    try {
      console.error('OpenAI Provider - Generating image with options:', JSON.stringify(options, null, 2));
      console.error('Prompt:', prompt);
      
      const params: OpenAI.Images.ImageGenerateParams = {
        model: options.model || "gpt-image-1",
        prompt: prompt,
        n: options.n || 1,
        size: options.size || "1024x1024",
        quality: options.quality || "standard",
        response_format: options.response_format || "url",
        ...(options.style && { style: options.style }),
      };
      
      const response = await this.client.images.generate(params);
      
      console.error('OpenAI Provider - Image generated successfully');
      return response;
    } catch (error) {
      console.error('Error generating image:', (error as Error).message);
      if ((error as any).response) {
        console.error('Error details:', JSON.stringify((error as any).response, null, 2));
      }
      throw error;
    }
  }
}
