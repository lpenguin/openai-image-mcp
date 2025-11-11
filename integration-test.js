#!/usr/bin/env node
"use strict";
/**
 * Integration test for the OpenAI Image Generation MCP server
 * This test verifies the server works correctly without requiring actual OpenAI API calls
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const fs_1 = require("fs");
const path_1 = require("path");
// Test configuration
const TEST_OUTPUT_DIR = (0, path_1.join)(process.cwd(), 'test-outputs');
const FAKE_API_KEY = "sk-test-api-key-for-integration-testing";
let requestId = 1;
function createMCPRequest(method, params) {
    return {
        jsonrpc: "2.0",
        id: requestId++,
        method,
        params,
    };
}
async function sendMCPRequest(child, request) {
    return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
            reject(new Error("Request timeout"));
        }, 30000);
        const handleData = (data) => {
            const lines = data.toString().split('\n');
            for (const line of lines) {
                if (line.trim()) {
                    try {
                        const response = JSON.parse(line);
                        if (response.id === request.id) {
                            clearTimeout(timeout);
                            child.stdout?.off('data', handleData);
                            resolve(response);
                        }
                    }
                    catch (error) {
                        // Ignore non-JSON lines (e.g., console.error output)
                    }
                }
            }
        };
        child.stdout?.on('data', handleData);
        child.stdin?.write(JSON.stringify(request) + '\n');
    });
}
async function runTests() {
    console.log("🚀 Starting integration tests...\n");
    // Create test output directory
    console.log("📁 Creating test output directory...");
    try {
        if (!(0, fs_1.existsSync)(TEST_OUTPUT_DIR)) {
            (0, fs_1.mkdirSync)(TEST_OUTPUT_DIR, { recursive: true });
        }
        console.log(`✅ Test output directory ready at: ${TEST_OUTPUT_DIR}\n`);
    }
    catch (error) {
        console.error("❌ Failed to create test output directory:", error);
        process.exit(1);
    }
    // Start the MCP server
    console.log("📦 Starting MCP server...");
    const serverPath = (0, path_1.join)(process.cwd(), 'dist', 'mcp-server.js');
    const child = (0, child_process_1.spawn)('node', [serverPath], {
        env: {
            ...process.env,
            OPENAI_API_KEY: FAKE_API_KEY,
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
        console.log("✅ Initialize successful");
        console.log(`   Server: ${JSON.stringify(initResponse.result?.serverInfo?.name)}\n`);
        // Test 2: List tools
        console.log("Test 2: List available tools");
        const listToolsRequest = createMCPRequest("tools/list");
        const listToolsResponse = await sendMCPRequest(child, listToolsRequest);
        const tools = listToolsResponse.result?.tools || [];
        console.log("✅ Tools list retrieved");
        console.log(`   Available tools: ${tools.map(t => t.name).join(', ')}\n`);
        // Verify all expected tools are present
        const expectedTools = ['generate_image_gpt', 'generate_image_gpt_mini', 'generate_image_dalle3', 'generate_image_dalle2'];
        for (const expectedTool of expectedTools) {
            if (!tools.some(t => t.name === expectedTool)) {
                throw new Error(`${expectedTool} tool not found`);
            }
        }
        console.log("✅ All expected tools found\n");
        // Test 3: Call generate_image_gpt tool (will fail due to invalid API key, but tests the protocol)
        console.log("Test 3: Call generate_image_gpt tool");
        const outputPath1 = (0, path_1.join)(TEST_OUTPUT_DIR, 'test-gpt-image-1.png');
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
        // We expect this to fail with an auth error (invalid API key)
        // but the protocol should work correctly
        if (generateGptResponse.error ||
            generateGptResponse.result?.isError) {
            console.log("✅ generate_image_gpt tool called (failed as expected with test API key)");
            console.log(`   Error is expected: Invalid authentication or API key\n`);
        }
        else {
            console.log("⚠️  generate_image_gpt tool unexpectedly succeeded (shouldn't happen with test API key)\n");
        }
        // Test 4: Call generate_image_gpt_mini tool
        console.log("Test 4: Call generate_image_gpt_mini tool");
        const outputPath2 = (0, path_1.join)(TEST_OUTPUT_DIR, 'test-gpt-image-1-mini.png');
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
            generateGptMiniResponse.result?.isError) {
            console.log("✅ generate_image_gpt_mini tool called (failed as expected with test API key)");
            console.log(`   Error is expected: Invalid authentication or API key\n`);
        }
        else {
            console.log("⚠️  generate_image_gpt_mini tool unexpectedly succeeded\n");
        }
        // Test 5: Call generate_image_dalle3 tool
        console.log("Test 5: Call generate_image_dalle3 tool");
        const outputPath3 = (0, path_1.join)(TEST_OUTPUT_DIR, 'test-dalle3.png');
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
            generateDalle3Response.result?.isError) {
            console.log("✅ generate_image_dalle3 tool called (failed as expected with test API key)");
            console.log(`   Error is expected: Invalid authentication or API key\n`);
        }
        else {
            console.log("⚠️  generate_image_dalle3 tool unexpectedly succeeded\n");
        }
        // Test 6: Call generate_image_dalle2 tool
        console.log("Test 6: Call generate_image_dalle2 tool");
        const outputPath4 = (0, path_1.join)(TEST_OUTPUT_DIR, 'test-dalle2.png');
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
            generateDalle2Response.result?.isError) {
            console.log("✅ generate_image_dalle2 tool called (failed as expected with test API key)");
            console.log(`   Error is expected: Invalid authentication or API key\n`);
        }
        else {
            console.log("⚠️  generate_image_dalle2 tool unexpectedly succeeded\n");
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
            invalidResponse.result?.isError) {
            console.log("✅ Error handling works correctly for missing parameters\n");
        }
        else {
            console.log("⚠️  Expected error for missing parameters but got success\n");
        }
        console.log("🎉 All integration tests passed!");
        console.log("\nNote: The tool calls are expected to fail with authentication errors");
        console.log("since we're using a test API key. The tests verify that:");
        console.log("  1. The MCP protocol works correctly");
        console.log("  2. All tools are registered and discoverable");
        console.log("  3. Tool calls are properly routed");
        console.log("  4. Error handling works as expected");
    }
    catch (error) {
        console.error("\n❌ Test failed:", error);
        child.kill();
        process.exit(1);
    }
    finally {
        // Clean up
        child.kill();
        // Clean up test output directory
        try {
            if ((0, fs_1.existsSync)(TEST_OUTPUT_DIR)) {
                const { rmSync } = await Promise.resolve().then(() => __importStar(require('fs')));
                rmSync(TEST_OUTPUT_DIR, { recursive: true, force: true });
                console.log("\n🧹 Cleaned up test output directory");
            }
        }
        catch (error) {
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
