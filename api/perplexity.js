// Vercel Edge Function for Perplexity API
export default async function handler(request, context) {
  // Log function invocation to help with debugging
  console.log("Perplexity API endpoint called:", new Date().toISOString());

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
    // Get the Perplexity API key from environment variables - add debug logging
    const apiKey = process.env.PERPLEXITY_API_KEY;
    console.log("Environment check: PERPLEXITY_API_KEY exists?", !!apiKey);
    
    if (!apiKey) {
      console.error("ERROR: Perplexity API key is missing in environment variables");
      return new Response(
        JSON.stringify({
          error: 'API key not configured',
          message: 'Please set PERPLEXITY_API_KEY in your Vercel environment variables'
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

    // Validate the query parameter
    if (!requestBody.query) {
      return new Response(
        JSON.stringify({ error: 'Missing required parameter: query' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }

    // Log the query (but truncate if very long)
    const truncatedQuery = requestBody.query.substring(0, 100) + 
                          (requestBody.query.length > 100 ? '...' : '');
    console.log(`Perplexity query: "${truncatedQuery}"`);
    
    // Create a fetch request with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
      console.log("Perplexity API request timed out after 25 seconds");
    }, 25000); // 25 seconds timeout
    
    try {
      // Forward the request to Perplexity API
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: "sonar-medium-online",
          messages: [
            { 
              role: "system", 
              content: "You are a helpful assistant that provides accurate information with online search capabilities." 
            },
            { 
              role: "user", 
              content: requestBody.query 
            }
          ],
          temperature: 0.7,
          max_tokens: 2048,
          stream: false
        }),
        signal: controller.signal
      });
      
      // Clear the timeout
      clearTimeout(timeoutId);
      
      // Check if response is ok
      if (!response.ok) {
        // Try to get detailed error info
        let errorDetails = `Status code: ${response.status}`;
        try {
          const errorText = await response.text();
          console.error(`Perplexity API error (${response.status}): ${errorText}`);
          errorDetails = errorText;
        } catch (e) {
          console.error(`Failed to read error response: ${e.message}`);
        }
        
        return new Response(
          JSON.stringify({ 
            error: `Perplexity API Error: ${response.statusText}`, 
            details: errorDetails
          }),
          {
            status: response.status,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }
      
      // Parse the response data
      const data = await response.json();
      console.log("Perplexity API response received successfully");
      
      // Extract the answer and any citations/sources
      let responseData = {
        answer: data.choices[0].message.content,
        sources: []
      };
      
      // Check if there are any tool calls for citations
      if (data.choices[0].message.tool_calls) {
        try {
          // Extract citations if they exist in the tool_calls
          const citations = data.choices[0].message.tool_calls.filter(
            tool => tool.function.name === "citation" || tool.function.name === "web_search"
          );
          
          if (citations.length > 0) {
            console.log(`Found ${citations.length} citations in response`);
            
            // Parse citation arguments and add to sources
            responseData.sources = citations.map(citation => {
              try {
                const args = JSON.parse(citation.function.arguments);
                return {
                  title: args.title || "Source",
                  url: args.url || "",
                  snippet: args.snippet || ""
                };
              } catch (e) {
                console.error("Error parsing citation arguments:", e);
                return { title: "Citation", url: "#" };
              }
            });
          }
        } catch (e) {
          console.warn("Error parsing citations:", e);
        }
      }
      
      // Return processed response
      return new Response(
        JSON.stringify(responseData),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-cache, no-store, must-revalidate'
          }
        }
      );
    } catch (fetchError) {
      // Clear the timeout to prevent memory leaks
      clearTimeout(timeoutId);
      
      // Check if this is an abort error (timeout)
      if (fetchError.name === 'AbortError') {
        return new Response(
          JSON.stringify({ 
            error: 'Gateway Timeout', 
            message: 'The request to the Perplexity API took too long to complete (>25 seconds).'
          }),
          {
            status: 504,
            headers: { 
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*'
            }
          }
        );
      }
      
      // Handle other fetch errors
      console.error("Fetch error:", fetchError);
      return new Response(
        JSON.stringify({ 
          error: 'Request Failed', 
          message: fetchError.message
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
  } catch (error) {
    console.error('Function error:', error.message, error.stack);
    return new Response(
      JSON.stringify({ 
        error: 'Internal Server Error', 
        message: error.message
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
