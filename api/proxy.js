// OpenAI API Proxy for GPT-4.1 Reasoning Studio
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

  // Flag to track if response has been sent
  let responseSent = false;

  try {
    // Get API key from environment variable
    const apiKey = process.env.OPENAI_API_KEY;
    console.log("Environment check: OPENAI_API_KEY exists?", !!apiKey);
    
    if (!apiKey) {
      console.error("ERROR: OpenAI API key is missing in environment variables");
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(500).json({
        error: 'API key not configured',
        message: 'Please set OPENAI_API_KEY in your Vercel environment variables'
      });
      responseSent = true;
      return;
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(400).json({
        error: 'Invalid JSON in request body',
        message: parseError.message
      });
      responseSent = true;
      return;
    }

    // Log request info (non-sensitive)
    console.log(`Request received for model: gpt-4.1`);
    
    // Extract reasoning method for metrics
    let reasoningMethod = 'Standard';
    if (requestBody.messages && requestBody.messages[0] && requestBody.messages[0].content) {
      const systemPrompt = requestBody.messages[0].content;
      if (systemPrompt.includes('Chain of Draft')) {
        reasoningMethod = 'CoD';
      } else if (systemPrompt.includes('Chain of Thought')) {
        reasoningMethod = 'CoT';
      }
    }
    
    console.log(`Using reasoning method: ${reasoningMethod}`);
    console.log(`Request complexity: ${JSON.stringify({
      messages_count: requestBody.messages ? requestBody.messages.length : 0,
      max_tokens: requestBody.max_tokens || 'default'
    })}`);
    
    // Check if this is a streaming request
    const isStreaming = requestBody.stream === true;
    console.log(`Stream mode: ${isStreaming ? 'enabled' : 'disabled'}`);
    
    // Validate max_tokens
    const originalMaxTokens = requestBody.max_tokens || 4096;
    const validatedMaxTokens = Math.min(Math.max(1, originalMaxTokens), 4096);
    
    if (originalMaxTokens !== validatedMaxTokens) {
      console.log(`Adjusted max_tokens from ${originalMaxTokens} to ${validatedMaxTokens} to meet API requirements`);
    }
    
    const startTime = Date.now();
    
    // Forward the request to OpenAI with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.log("Request is taking too long, aborting...");
    }, 120000); // 120 seconds timeout (Vercel's maximum)
    
    try {
      // Prepare the OpenAI API request
      const openaiPayload = {
        model: "gpt-4.1", // Fixed to GPT-4.1
        messages: requestBody.messages,
        max_tokens: validatedMaxTokens,
        temperature: requestBody.temperature || 0.7,
        top_p: requestBody.top_p || 1,
        stream: requestBody.stream || false,
        presence_penalty: requestBody.presence_penalty || 0,
        frequency_penalty: requestBody.frequency_penalty || 0
      };
      
      // Include tools if provided
      if (requestBody.tools && Array.isArray(requestBody.tools) && requestBody.tools.length > 0) {
        openaiPayload.tools = requestBody.tools;
      }
      
      // Include tool_choice if provided
      if (requestBody.tool_choice) {
        openaiPayload.tool_choice = requestBody.tool_choice;
      }
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(openaiPayload),
        signal: controller.signal
      });
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      const endTime = Date.now();
      const responseTime = endTime - startTime;
      console.log(`OpenAI API response status: ${response.status}, time: ${responseTime}ms, method: ${reasoningMethod}`);
      
      // Check if response is ok
      if (!response.ok) {
        // Try to get detailed error info
        let errorDetails = `Status code: ${response.status}`;
        try {
          const errorText = await response.text();
          console.error(`API error (${response.status}): ${errorText}`);
          errorDetails = errorText;
        } catch (e) {
          console.error(`Failed to read error response: ${e.message}`);
        }
        
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(response.status).json({ 
          error: `API Error: ${response.statusText}`, 
          details: errorDetails
        });
        responseSent = true;
        return;
      }
      
      // Handle streaming response
      if (isStreaming) {
        // Set appropriate headers for streaming
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');
        res.setHeader('Access-Control-Allow-Origin', '*');
        
        // Use pipe for Node.js environment
        response.body.pipe(res);
        responseSent = true;
        
        // Handle stream completion
        response.body.on('end', () => {
          console.log('Stream ended');
        });
        
        // Handle stream errors
        response.body.on('error', (streamError) => {
          console.error('Error while streaming:', streamError);
        });
        
        return;
      }
      
      // For non-streaming responses, parse as JSON and return normally
      const data = await response.json();
      
      // Add performance metrics to response
      if (data && !data.error) {
        data.performance = {
          response_time_ms: responseTime,
          reasoning_method: reasoningMethod
        };
      }
      
      // Return the response from OpenAI
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.status(200).json(data);
      responseSent = true;
      return;
      
    } catch (fetchError) {
      // Clear the timeout to prevent memory leaks
      clearTimeout(timeoutId);
      
      // Don't try to send response if one was already sent
      if (responseSent) {
        console.error("Error occurred, but response already sent:", fetchError);
        return;
      }
      
      // Check if this is an abort error (timeout)
      if (fetchError.name === 'AbortError') {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.status(504).json({ 
          error: 'Gateway Timeout', 
          message: 'The request to the OpenAI API took too long to complete (>120 seconds). Try reducing complexity or using fewer tokens.'
        });
        return;
      }
      
      // Handle other fetch errors
      console.error("Fetch error:", fetchError);
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(500).json({ 
        error: 'Request Failed', 
        message: fetchError.message
      });
    }
  } catch (error) {
    // Don't try to send response if one was already sent
    if (responseSent) {
      console.error("Error occurred, but response already sent:", error);
      return;
    }
    
    console.error('Function error:', error.message, error.stack);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ 
      error: 'Internal Server Error', 
      message: error.message
    });
  }
};
