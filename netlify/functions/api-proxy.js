const fetch = require('node-fetch');
const { AbortController } = require('abort-controller');

// Get environment variables
const API_KEY = process.env.GROQ_API_KEY;
const API_ENDPOINT = 'https://api.groq.com/openai/v1/chat/completions';

// Validate environment variables
if (!API_KEY) {
  console.error('GROQ_API_KEY not found in environment variables');
}

exports.handler = async function(event, context) {
  // Set CORS headers for all responses
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Method Not Allowed' })
    };
  }

  try {
    // Validate API key
    if (!API_KEY) {
      return {
        statusCode: 500,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'API key not configured',
          message: 'Please set GROQ_API_KEY in your Netlify environment variables'
        })
      };
    }

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers: corsHeaders,
        body: JSON.stringify({
          error: 'Invalid JSON',
          message: 'Request body must be valid JSON'
        })
      };
    }

    // Set default values and validate parameters
    const params = {
      model: requestBody.model || 'deepseek-r1-distill-qwen-32b',
      messages: requestBody.messages,
      max_tokens: Math.min(requestBody.max_tokens || 8192, 32000),
      temperature: requestBody.temperature || 0.7,
      top_p: requestBody.top_p,
      n: requestBody.n,
      stream: requestBody.stream,
      stop: requestBody.stop,
      presence_penalty: requestBody.presence_penalty,
      frequency_penalty: requestBody.frequency_penalty
    };

    // Remove null/undefined values
    Object.keys(params).forEach(key => 
      params[key] === null || params[key] === undefined ? delete params[key] : {}
    );

    // Implement retry logic with exponential backoff
    let retries = 3;
    let lastError;
    
    while (retries > 0) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 180000);

        const response = await fetch(API_ENDPOINT, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
          },
          body: JSON.stringify(params),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (response.ok) {
          const data = await response.json();
          return {
            statusCode: 200,
            headers: corsHeaders,
            body: JSON.stringify(data)
          };
        }

        // Handle specific error cases
        if (response.status === 401) {
          return {
            statusCode: 401,
            headers: corsHeaders,
            body: JSON.stringify({
              error: 'Authentication failed',
              message: 'Invalid API key. Please check your GROQ_API_KEY.'
            })
          };
        }

        if (response.status === 404) {
          return {
            statusCode: 404,
            headers: corsHeaders,
            body: JSON.stringify({
              error: 'Model not found',
              message: `The model "${params.model}" is not available.`
            })
          };
        }

        // For other errors, try to get error details
        const errorData = await response.text();
        let errorMessage;
        try {
          const parsedError = JSON.parse(errorData);
          errorMessage = parsedError.error?.message || 'Unknown API error';
        } catch {
          errorMessage = errorData || `Error ${response.status}`;
        }

        lastError = new Error(errorMessage);
        retries--;
        
        // Wait before retrying (exponential backoff)
        await new Promise(resolve => 
          setTimeout(resolve, (3 - retries) * 3000)
        );

      } catch (error) {
        lastError = error;
        retries--;
        if (retries > 0) {
          await new Promise(resolve => 
            setTimeout(resolve, (3 - retries) * 3000)
          );
        }
      }
    }

    // If we've exhausted retries, return the last error
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Request failed',
        message: lastError.message,
        details: {
          suggestions: [
            'Check your API key is valid',
            'Verify the model name is correct',
            'Try reducing max_tokens if you\'re getting timeout errors',
            'Ensure your Groq API subscription is active'
          ]
        }
      })
    };

  } catch (error) {
    console.error('Function error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Internal server error',
        message: error.message
      })
    };
  }
}; 
