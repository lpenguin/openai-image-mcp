#!/usr/bin/env node

/**
 * Integration test for the OpenAI Image Generation MCP server
 * This test verifies the server works correctly without requiring actual OpenAI API calls
 */

import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';
import { writeFileSync, mkdirSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

interface MCPRequest {
  jsonrpc: string;
  id: number;
  method: string;
  params?: Record<string, unknown>;
}

interface MCPResponse {
  jsonrpc: string;
  id: number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

// Test configuration
const TEST_OUTPUT_DIR = join(process.cwd(), 'test-outputs');
const MOCK_API_URL = process.env.OPENAI_API_URL || "http://localhost:5002/v1";
const FAKE_API_KEY = "test-api-key";

let requestId = 1;

function createMCPRequest(method: string, params?: Record<string, unknown>): MCPRequest {
  return {
    jsonrpc: "2.0",
    id: requestId++,
    method,
    params,
  };
}

async function sendMCPRequest(
  child: ChildProcess,
  request: MCPRequest
): Promise<MCPResponse> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Request timeout"));
    }, 30000);

    const handleData = (data: Buffer): void => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        if (line.trim()) {
          try {
            const response = JSON.parse(line) as MCPResponse;
            if (response.id === request.id) {
              clearTimeout(timeout);
              child.stdout?.off('data', handleData);
              resolve(response);
            }
          } catch (error) {
            // Ignore non-JSON lines (e.g., console.error output)
          }
        }
      }
    };

    child.stdout?.on('data', handleData);
    child.stdin?.write(JSON.stringify(request) + '\n');
  });
}

async function runTests(): Promise<void> {
  console.log("🚀 Starting integration tests...\n");

  let failedTests = 0;
  let passedTests = 0;

  // Create test output directory
  console.log("📁 Creating test output directory...");
  try {
    if (!existsSync(TEST_OUTPUT_DIR)) {
      mkdirSync(TEST_OUTPUT_DIR, { recursive: true });
    }
    console.log(`✅ Test output directory ready at: ${TEST_OUTPUT_DIR}\n`);
  } catch (error) {
    console.error("❌ Failed to create test output directory:", error);
    process.exit(1);
  }

  // Start the MCP server
  console.log("📦 Starting MCP server with mock OpenAI API...");
  const serverPath = join(process.cwd(), 'dist', 'mcp-server.js');
  
  const child = spawn('node', [serverPath], {
    env: {
      ...process.env,
      OPENAI_API_KEY: FAKE_API_KEY,
      OPENAI_API_URL: MOCK_API_URL,
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  if (child.exitCode !== null) {
    console.error("❌ Server failed to start");
    process.exit(1);
  }

  console.log("✅ Server started\n");

  try {
    // Test 1: Initialize
    console.log("Test 1: Initialize connection");
    const initRequest = createMCPRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: {
        name: "integration-test",
        version: "1.0.0",
      },
    });
    const initResponse = await sendMCPRequest(child, initRequest);
    if (initResponse.result) {
      console.log("✅ Initialize successful");
      console.log(`   Server: ${JSON.stringify((initResponse.result as { serverInfo?: { name?: string } })?.serverInfo?.name)}\n`);
      passedTests++;
    } else {
      console.log("❌ Initialize failed\n");
      failedTests++;
    }

    // Test 2: List tools
    console.log("Test 2: List available tools");
    const listToolsRequest = createMCPRequest("tools/list");
    const listToolsResponse = await sendMCPRequest(child, listToolsRequest);
    const tools = (listToolsResponse.result as { tools?: Array<{ name: string }> })?.tools || [];
    console.log("✅ Tools list retrieved");
    console.log(`   Available tools: ${tools.map(t => t.name).join(', ')}\n`);
    passedTests++;

    // Verify all expected tools are present
    const expectedTools = ['generate_image_gpt', 'generate_image_gpt_mini', 'generate_image_gpt2', 'generate_image_gpt2_thinking', 'generate_image_dalle3', 'generate_image_dalle2'];
    for (const expectedTool of expectedTools) {
      if (!tools.some(t => t.name === expectedTool)) {
        console.log(`❌ Missing tool: ${expectedTool}\n`);
        failedTests++;
        throw new Error(`${expectedTool} tool not found`);
      }
    }
    console.log("✅ All expected tools found\n");
    passedTests++;

    // Test 3: Call generate_image_gpt tool
    console.log("Test 3: Call generate_image_gpt tool");
    const outputPath1 = join(TEST_OUTPUT_DIR, 'test-gpt-image-1.png');
    const generateGptRequest = createMCPRequest("tools/call", {
      name: "generate_image_gpt",
      arguments: {
        prompt: "A simple geometric shape",
        output: outputPath1,
        size: "1024x1024",
        quality: "low",
      },
    });
    const generateGptResponse = await sendMCPRequest(child, generateGptRequest);
    
    // With mock API, this should succeed
    if (generateGptResponse.error || 
        (generateGptResponse.result as { isError?: boolean })?.isError) {
      console.log("❌ generate_image_gpt tool failed");
      const content = (generateGptResponse.result as { content?: Array<{ text?: string }> })?.content;
      if (content && content[0]?.text) {
        console.log(`   Error: ${content[0].text.substring(0, 200)}\n`);
      }
      failedTests++;
    } else {
      console.log("✅ generate_image_gpt tool called successfully\n");
      passedTests++;
    }

    // Test 4: Call generate_image_gpt_mini tool
    console.log("Test 4: Call generate_image_gpt_mini tool");
    const outputPath2 = join(TEST_OUTPUT_DIR, 'test-gpt-image-1-mini.png');
    const generateGptMiniRequest = createMCPRequest("tools/call", {
      name: "generate_image_gpt_mini",
      arguments: {
        prompt: "A simple geometric shape",
        output: outputPath2,
        size: "1024x1024",
        quality: "low",
      },
    });
    const generateGptMiniResponse = await sendMCPRequest(child, generateGptMiniRequest);
    
    if (generateGptMiniResponse.error || 
        (generateGptMiniResponse.result as { isError?: boolean })?.isError) {
      console.log("❌ generate_image_gpt_mini tool failed\n");
      failedTests++;
    } else {
      console.log("✅ generate_image_gpt_mini tool called successfully\n");
      passedTests++;
    }

    // Test 5: Call generate_image_dalle3 tool
    console.log("Test 5: Call generate_image_dalle3 tool");
    const outputPath3 = join(TEST_OUTPUT_DIR, 'test-dalle3.png');
    const generateDalle3Request = createMCPRequest("tools/call", {
      name: "generate_image_dalle3",
      arguments: {
        prompt: "A simple geometric shape",
        output: outputPath3,
        size: "1024x1024",
        quality: "standard",
      },
    });
    const generateDalle3Response = await sendMCPRequest(child, generateDalle3Request);
    
    if (generateDalle3Response.error || 
        (generateDalle3Response.result as { isError?: boolean })?.isError) {
      console.log("❌ generate_image_dalle3 tool failed\n");
      failedTests++;
    } else {
      console.log("✅ generate_image_dalle3 tool called successfully\n");
      passedTests++;
    }

    // Test 6: Call generate_image_dalle2 tool
    console.log("Test 6: Call generate_image_dalle2 tool");
    const outputPath4 = join(TEST_OUTPUT_DIR, 'test-dalle2.png');
    const generateDalle2Request = createMCPRequest("tools/call", {
      name: "generate_image_dalle2",
      arguments: {
        prompt: "A simple geometric shape",
        output: outputPath4,
        size: "1024x1024",
      },
    });
    const generateDalle2Response = await sendMCPRequest(child, generateDalle2Request);
    
    if (generateDalle2Response.error || 
        (generateDalle2Response.result as { isError?: boolean })?.isError) {
      console.log("❌ generate_image_dalle2 tool failed\n");
      failedTests++;
    } else {
      console.log("✅ generate_image_dalle2 tool called successfully\n");
      passedTests++;
    }

    // Test 7: Test error handling with missing required parameters
    console.log("Test 7: Test error handling with missing parameters");
    const invalidRequest = createMCPRequest("tools/call", {
      name: "generate_image_gpt",
      arguments: {
        // Missing prompt and output
      },
    });
    const invalidResponse = await sendMCPRequest(child, invalidRequest);
    
    if (invalidResponse.error || 
        (invalidResponse.result as { isError?: boolean })?.isError) {
      console.log("✅ Error handling works correctly for missing parameters\n");
      passedTests++;
    } else {
      console.log("❌ Expected error for missing parameters but got success\n");
      failedTests++;
    }

    console.log("\n" + "=".repeat(50));
    console.log(`Test Results: ${passedTests} passed, ${failedTests} failed`);
    console.log("=".repeat(50) + "\n");

    if (failedTests > 0) {
      console.log("❌ Some tests failed!");
      child.kill();
      process.exit(1);
    }

    console.log("🎉 All integration tests passed!");
    console.log("\nThe tests verify that:");
    console.log("  1. The MCP protocol works correctly");
    console.log("  2. All tools are registered and discoverable");
    console.log("  3. Tool calls are properly routed");
    console.log("  4. Error handling works as expected");
    console.log("  5. Mock API integration works (when OPENAI_API_URL is set)");
    
  } catch (error) {
    console.error("\n❌ Test failed:", error);
    child.kill();
    process.exit(1);
  } finally {
    // Clean up
    child.kill();
    
    // Clean up test output directory
    try {
      if (existsSync(TEST_OUTPUT_DIR)) {
        const { rmSync } = await import('fs');
        rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
        console.log("\n🧹 Cleaned up test output directory");
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  }

  process.exit(0);
}

// Run tests
runTests().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
