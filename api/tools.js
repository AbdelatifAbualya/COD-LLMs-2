// API handler for OpenAI Tools capabilities
const fetch = require('node-fetch');

module.exports = async (req, res) => {
  // Handle CORS for preflight requests
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Max-Age', '86400');
    res.status(204).end();
    return;
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  try {
    // Parse request body
    const requestBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    
    // This endpoint registers available tools with the frontend
    // It can be extended to handle actual tool execution if needed
    
    // Define available tools that GPT-4.1 can use
    const availableTools = [
      {
        type: "web_search_preview", // Built-in web search tool
        description: "A tool that enables the model to search the web for up-to-date information"
      },
      {
        type: "function",
        function: {
          name: "calculate_expression",
          description: "Calculate the result of a mathematical expression",
          parameters: {
            type: "object",
            properties: {
              expression: {
                type: "string",
                description: "The mathematical expression to calculate (e.g., '2+2', 'sin(30)', 'sqrt(144)')"
              }
            },
            required: ["expression"]
          }
        }
      },
      {
        type: "function",
        function: {
          name: "get_current_weather",
          description: "Get the current weather in a given location",
          parameters: {
            type: "object",
            properties: {
              location: {
                type: "string",
                description: "The city and state, e.g. San Francisco, CA"
              },
              unit: {
                type: "string",
                enum: ["celsius", "fahrenheit"],
                description: "The temperature unit to use. Default is celsius."
              }
            },
            required: ["location"]
          }
        }
      }
    ];
    
    // Return the available tools to the frontend
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({
      tools: availableTools,
      status: "success"
    });
  } catch (error) {
    console.error('Tools API error:', error.message, error.stack);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message
    });
  }
};
