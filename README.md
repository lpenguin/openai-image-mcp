# OpenAI Image Generation MCP Server

A TypeScript-based Model Context Protocol (MCP) server for generating images using OpenAI's image generation models (gpt-image-1, DALL-E 3, and DALL-E 2).

## Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Create a `.env` file based on `.env.example` and add your OpenAI API key:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```
4. Build the TypeScript code:
   ```
   npm run build
   ```

## Running the MCP Server

Start the MCP server:
```
npm start
```

## Development

For development with automatic compilation:
```
npm run dev
```

## Testing

Run the test client:
```
npm test
```

## MCP Server Configuration

To use this as an MCP server with Claude, you need to add it to your MCP settings configuration file. The `mcp-config.json` file in this repository provides a template:

```json
{
  "mcpServers": {
    "image-generation": {
      "command": "node",
      "args": ["dist/mcp-server.js"],
      "env": {
        "OPENAI_API_KEY": "your_openai_api_key_here"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

**Important**: Replace `"your_openai_api_key_here"` with your actual OpenAI API key. The MCP server will use this key to authenticate with the OpenAI API.

Copy this configuration to your MCP settings file, typically located at:

### VS Code

VS Code has native MCP support. Add the configuration to your workspace or user settings:

**Location**: `.vscode/mcp.json` (in your workspace root)

Configuration format:

```json
{
  "mcpServers": {
    "image-generation": {
      "command": "node",
      "args": ["/absolute/path/to/openai-image-mcp/dist/mcp-server.js"],
      "env": {
        "OPENAI_API_KEY": "your_openai_api_key_here"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

**Important**: 
- Replace `/absolute/path/to/openai-image-mcp` with the actual absolute path to your cloned repository
- Replace `"your_openai_api_key_here"` with your actual OpenAI API key

### Claude Desktop

**Location**: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

### API Key Configuration

The MCP server requires an OpenAI API key to function. There are two ways to provide this key:

1. **Environment Variable**: If you're running the server directly with `npm start`, it will use the OPENAI_API_KEY from your `.env` file.

2. **MCP Settings**: When configuring the server in your MCP settings file, you need to provide the API key in the `env` section as shown above. This key will be passed to the server as an environment variable.

## Usage

Once the MCP server is configured in Claude, you can use one of the three image generation tools to create images based on text prompts. Each tool is optimized for a specific OpenAI model.

## Available Tools

### 1. `generate_image_gpt` - GPT-Image-1 Model

Generate images using OpenAI's gpt-image-1 model with advanced features like transparency and custom output formats.

**Parameters:**
- `prompt` (required): A text description of the desired image (max 32,000 characters)
- `output` (required): File path where the generated image should be saved (e.g., `/path/to/image.png`)
- `size` (optional): Image size. Options: "1024x1024", "1536x1024", "1024x1536", "auto". Default: "auto"
- `quality` (optional): Image quality. Options: "low", "medium", "high", "auto". Default: "auto"
- `background` (optional): Background transparency. Options: "transparent", "opaque", "auto". Default: "auto"
- `output_format` (optional): Output image format. Options: "png", "jpeg", "webp". Default: "png"
- `output_compression` (optional): Compression level (0-100) for webp/jpeg formats. Default: 100
- `moderation` (optional): Content moderation level. Options: "low", "auto". Default: "auto"
- `n` (optional): Number of images to generate (1-10). Default: 1

### 2. `generate_image_dalle3` - DALL-E 3 Model

Generate high-quality images using OpenAI's DALL-E 3 model with style control.

**Parameters:**
- `prompt` (required): A text description of the desired image (max 4,000 characters)
- `output` (required): File path where the generated image should be saved
- `size` (optional): Image size. Options: "1024x1024", "1792x1024", "1024x1792". Default: "1024x1024"
- `quality` (optional): Image quality. Options: "standard", "hd". Default: "standard"
- `style` (optional): Image style. Options: "vivid" (hyper-real and dramatic), "natural" (more natural, less hyper-real). Default: "vivid"

**Note:** DALL-E 3 can only generate 1 image at a time (n is always 1).

### 3. `generate_image_dalle2` - DALL-E 2 Model

Generate images using OpenAI's DALL-E 2 model. Fast and cost-effective option.

**Parameters:**
- `prompt` (required): A text description of the desired image (max 1,000 characters)
- `output` (required): File path where the generated image should be saved
- `size` (optional): Image size. Options: "256x256", "512x512", "1024x1024". Default: "1024x1024"
- `n` (optional): Number of images to generate (1-10). Default: 1

## Examples

### Generate a logo with transparency (GPT-Image-1)
```
generate_image_gpt(
  prompt="A minimalist geometric logo with circles and triangles",
  output="/path/to/logo.png",
  background="transparent",
  output_format="png",
  quality="high"
)
```

### Generate a high-quality artistic image (DALL-E 3)
```
generate_image_dalle3(
  prompt="A peaceful zen garden with raked sand and carefully placed stones",
  output="/path/to/zen_garden.png",
  quality="hd",
  style="natural"
)
```

### Generate multiple variations (DALL-E 2)
```
generate_image_dalle2(
  prompt="A vintage robot reading a newspaper",
  output="/path/to/robot.png",
  n=3,
  size="512x512"
)
```
