// Vercel Edge Function for streaming API responses
export default async function handler(request, context) {
  // Log function invocation
  console.log("Streaming API called:", new Date().toISOString());

  // Handle CORS for preflight requests
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method Not Allowed' }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Allow': 'POST'
        }
      }
    );
  }

  try {
    // Get the Fireworks API key from environment variables
    const apiKey = process.env.FIREWORKS_API_KEY;
    console.log("Environment check: FIREWORKS_API_KEY exists?", !!apiKey);
    
    if (!apiKey) {
      console.error("ERROR: Fireworks API key is missing in environment variables");
      return new Response(
        JSON.stringify({
          error: 'API key not configured',
          message: 'Please set FIREWORKS_API_KEY in your Vercel environment variables'
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Parse request body
    let requestBody;
    try {
      requestBody = await request.json();
    } catch (parseError) {
      console.error("Failed to parse request body:", parseError);
      return new Response(
        JSON.stringify({
          error: 'Invalid JSON in request body',
          message: parseError.message
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Log request information
    const modelName = requestBody.model || 'unknown';
    console.log('Streaming request received for model:', modelName);
    
    // Enable streaming if not explicitly set
    if (requestBody.stream === undefined) {
      requestBody.stream = true;
    }
    
    // Prepare request for Fireworks API
    const apiEndpoint = 'https://api.fireworks.ai/inference/v1/chat/completions';
    
    // Validate max_tokens (Fireworks models accept different limits based on model)
    const originalMaxTokens = requestBody.max_tokens || 4096;
    const validatedMaxTokens = Math.min(Math.max(1, originalMaxTokens), 8192);
    
    if (originalMaxTokens !== validatedMaxTokens) {
      console.log(`Adjusted max_tokens from ${originalMaxTokens} to ${validatedMaxTokens}`);
    }
    
    const cleanedParams = {
      model: requestBody.model,
      messages: requestBody.messages,
      max_tokens: validatedMaxTokens,
      temperature: requestBody.temperature,
      top_p: requestBody.top_p,
      stream: true  // Force streaming mode
    };

    // Remove undefined or null values
    Object.keys(cleanedParams).forEach(key => {
      if (cleanedParams[key] === undefined || cleanedParams[key] === null) {
        delete cleanedParams[key];
      }
    });
    
    // Set up the Fireworks API request
    const apiRequestOptions = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify(cleanedParams)
    };
    
    // Create a transformer for the streamed response
    const transformStream = new TransformStream();
    const writer = transformStream.writable.getWriter();
    
    // Create a response with the appropriate headers
    const response = new Response(transformStream.readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
      }
    });
    
    // Call the Fireworks API and process the streaming response
    fetch(apiEndpoint, apiRequestOptions)
      .then(apiResponse => {
        if (!apiResponse.ok) {
          throw new Error(`API Error: ${apiResponse.status} ${apiResponse.statusText}`);
        }
        
        return apiResponse.body;
      })
      .then(stream => {
        const reader = stream.getReader();
        
        // Function to process each chunk from the stream
        function processStreamChunk() {
          reader.read().then(({ done, value }) => {
            if (done) {
              writer.write(new TextEncoder().encode('data: [DONE]\n\n'));
              writer.close();
              return;
            }
            
            // Forward the chunk directly
            writer.write(value);
            
            // Process the next chunk
            processStreamChunk();
          }).catch(error => {
            console.error('Stream reading error:', error);
            writer.write(new TextEncoder().encode(`data: ${JSON.stringify({error: true, message: error.message})}\n\n`));
            writer.close();
          });
        }
        
        // Start processing the stream
        processStreamChunk();
      })
      .catch(error => {
        console.error('API request error:', error);
        writer.write(new TextEncoder().encode(`data: ${JSON.stringify({error: true, message: error.message})}\n\n`));
        writer.write(new TextEncoder().encode('data: [DONE]\n\n'));
        writer.close();
      });
    
    return response;
    
  } catch (error) {
    console.error('Edge function error:', error.name, error.message);
    
    return new Response(
      JSON.stringify({
        error: error.message || 'Unknown error',
        details: {
          name: error.name,
          message: error.message
        }
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}
