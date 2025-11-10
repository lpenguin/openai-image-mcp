# DALL-E Image Generator MCP Server

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
- VSCode: `~/.vscode-server/data/User/globalStorage/saoudrizwan.claude-dev/settings/cline_mcp_settings.json`
- Claude Desktop: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

### API Key Configuration

The MCP server requires an OpenAI API key to function. There are two ways to provide this key:

1. **Environment Variable**: If you're running the server directly with `npm start`, it will use the OPENAI_API_KEY from your `.env` file.

2. **MCP Settings**: When configuring the server in your MCP settings file, you need to provide the API key in the `env` section as shown above. This key will be passed to the server as an environment variable.

## Usage

Once the MCP server is configured in Claude, you can use the `generate_image` tool to create images based on text prompts.

## Parameters

The `generate_image` tool accepts the following parameters:

- `prompt` (required): A text description of the desired image
- `model` (optional): The model to use. Options: "gpt-image-1", "dall-e-3" or "dall-e-2". Default is "dall-e-3"
- `n` (optional): Number of images to generate (1-10). Default is 1
- `size` (optional): Image size. Options: "1024x1024", "1792x1024", "1024x1792", "512x512", or "256x256". Default is "1024x1024"
- `quality` (optional): Image quality. Options: "standard" or "hd". Default is "standard"
- `style` (optional): Image style. Options: "vivid" or "natural". Default is "vivid"
- `response_format` (optional): Format of the response. Options: "url" or "b64_json". Default is "url"
