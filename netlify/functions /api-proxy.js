// netlify/functions/api-proxy.js
// Make sure these dependencies are installed:
// npm install node-fetch@2 abort-controller
const fetch = require('node-fetch');
const { AbortController } = require('abort-controller');

exports.handler = async function(event, context) {
  // Set CORS headers for preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    console.log('Method not allowed:', event.httpMethod);
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }

  try {
    // Check both possible API key environment variable names
    const apiKey = process.env.GROQ_API_KEY || process.env.QROQ_API_KEY;
    
    // Debug logging for API key (safely shows just the first 4 characters)
    console.log('API Key configured:', apiKey ? `Yes (first 4 chars: ${apiKey.substring(0, 4)})` : 'No');
    
    if (!apiKey) {
      console.error('No API key found in environment variables');
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'API key not configured',
          message: 'Please set GROQ_API_KEY in your Netlify environment variables'
        }),
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }

    // Parse the request body
    const requestBody = JSON.parse(event.body);
    console.log('Request received for model:', requestBody.model);
    
    // Define models that match exactly with your HTML interface
    const INTERFACE_MODELS = [
      'qwen-2.5-coder-32b',
      'llama-3.3-70b-versatile',
      'mixtral-8x7b-32768',
      'qwen-qwq-32b',
      'llama-3.2-90b-vision-preview'
    ];
    
    // Check if we need to map the model name for Groq API
    const MODEL_MAP = {
      'qwen-2.5-coder-32b': 'llama-3-70b-chat', // Fallback mapping
      'llama-3.3-70b-versatile': 'llama-3-70b-chat',
      'mixtral-8x7b-32768': 'mixtral-8x7b-32768',
      'qwen-qwq-32b': 'llama-3-70b-chat',  // Fallback mapping
      'llama-3.2-90b-vision-preview': 'llama-3-70b-chat'  // Fallback mapping
    };
    
    // If model is in our interface but needs mapping to actual Groq model
    if (INTERFACE_MODELS.includes(requestBody.model) && MODEL_MAP[requestBody.model]) {
      console.log(`Mapping interface model "${requestBody.model}" to Groq API model "${MODEL_MAP[requestBody.model]}"`);
      requestBody.model = MODEL_MAP[requestBody.model];
    }
    
    // Check token limit settings
    if (requestBody.max_tokens && requestBody.max_tokens > 32000) {
      console.log(`Warning: Using a high token limit of ${requestBody.max_tokens}. Reducing to 32000 for better compatibility.`);
      requestBody.max_tokens = 32000;
    }
    
    // Set reasonable default max tokens if not specified
    if (!requestBody.max_tokens) {
      requestBody.max_tokens = 4096;
      console.log('Setting default max_tokens to 4096');
    }
    
    // Groq API endpoint
    const apiEndpoint = 'https://api.groq.com/openai/v1/chat/completions';
    console.log(`Using Groq API endpoint: ${apiEndpoint}`);
    
    // Implement retry logic
    let retries = 3;
    let response;
    
    while (retries > 0) {
      try {
        // Set up abort controller with reasonable timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 60000); // 60-second timeout
        
        // Log the full request for debugging
        console.log('Full request payload:', JSON.stringify({
          ...requestBody,
          messages: requestBody.messages?.length ? `[${requestBody.messages.length} messages]` : requestBody.messages
        }));
        
        // Make request to the Groq API
        console.log(`Sending request to Groq API (attempts remaining: ${retries})`);
        response = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal
        });
        
        // Clear timeout
        clearTimeout(timeoutId);
        
        // Log response status for debugging
        console.log(`Groq API response status: ${response.status}`);
        
        // If we get a 502/504, retry; otherwise, break the loop
        if (response.status === 502 || response.status === 504) {
          console.log(`Received ${response.status} from Groq API, retrying...`);
          retries--;
          await new Promise(resolve => setTimeout(resolve, (3 - retries) * 3000));
        } else {
          break;
        }
      } catch (fetchError) {
        console.error('Fetch error:', fetchError);
        retries--;
        if (retries === 0) throw fetchError;
        await new Promise(resolve => setTimeout(resolve, (3 - retries) * 3000));
      }
    }

    // If we exhausted retries and still don't have a response
    if (!response) {
      throw new Error('Failed to get response from Groq API after multiple attempts');
    }

    // Handle response errors
    if (!response.ok) {
      const errorData = await response.text();
      console.error(`Groq API error: ${response.status}`, errorData);
      
      let errorMessage = '';
      let errorDetails = {};
      
      try {
        // Try to parse error as JSON
        const parsedError = JSON.parse(errorData);
        errorMessage = parsedError.error?.message || 'Unknown API error';
        errorDetails = parsedError;
        
        if (errorMessage.includes('token') && errorMessage.includes('limit')) {
          errorMessage = `Token limit exceeded. Try reducing the max_tokens value or using a different model.`;
        }
      } catch {
        // If parsing fails, use the raw text
        errorMessage = errorData || `Error ${response.status}`;
      }
      
      // Special error messages for common status codes
      if (response.status === 401) {
        errorMessage = "Authentication failed. Please check your API key in Netlify environment variables.";
      } else if (response.status === 404) {
        errorMessage = `Model not found. The model "${requestBody.model}" may not be available. Try one of the Groq supported models like "llama-3-70b-chat".`;
      } else if (response.status === 429) {
        errorMessage = "Rate limit exceeded. Please try again later.";
      } else if (response.status === 504) {
        errorMessage = "Request timed out. Try reducing the max_tokens value.";
      }
      
      return {
        statusCode: response.status,
        body: JSON.stringify({ 
          error: `Groq API error: ${response.status}`,
          message: errorMessage,
          details: {
            original_model: requestBody.original_model || requestBody.model,
            mapped_model: requestBody.original_model ? requestBody.model : null,
            possible_fixes: [
              "Verify the API key is correct in Netlify",
              "Try using an officially supported Groq model like llama-3-70b-chat"
            ]
          }
        }),
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }

    // Parse and return the response
    const data = await response.json();
    console.log('Received successful response from Groq API');
    
    // Log token usage if available
    if (data.usage) {
      console.log(`Token usage: prompt=${data.usage.prompt_tokens}, completion=${data.usage.completion_tokens}, total=${data.usage.total_tokens}`);
    }

    return {
      statusCode: 200,
      body: JSON.stringify(data),
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  } catch (error) {
    console.error('Function error:', error);
    
    // Special error message for abort errors (timeouts)
    let errorMessage = error.message || 'Unknown error occurred';
    if (error.name === 'AbortError' || errorMessage.includes('abort')) {
      errorMessage = "Request timed out. Try reducing the max_tokens value.";
    }
    
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: errorMessage,
        details: {
          name: error.name,
          stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
          suggestions: [
            "Verify GROQ_API_KEY is set correctly in Netlify environment variables",
            "Try using 'llama-3-70b-chat' as your model - it's officially supported by Groq",
            "Reduce max_tokens to 4096 for initial testing"
          ]
        }
      }),
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
};
