// Vercel/Netlify Function to handle Perplexity API requests
// @vercel/edge
exports.handler = async function(event, context) {
  // Load fetch at runtime
  const fetch = require('node-fetch');
  
  // Handle OPTIONS request for CORS
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Allow': 'POST'
      }
    };
  }

  try {
    // Get Perplexity API key from environment variable
    const API_KEY = process.env.PERPLEXITY_API_KEY;
    
    if (!API_KEY) {
      console.log("ERROR: Perplexity API key is missing");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: 'Perplexity API key not configured on server' }),
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }

    // Parse the request body
    let requestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (parseError) {
      return {
        statusCode: 400,
        body: JSON.stringify({ 
          error: 'Invalid JSON in request body', 
          message: parseError.message
        }),
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }

    // Validate the query parameter
    if (!requestBody.query) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required parameter: query' }),
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }

    console.log(`Perplexity query: "${requestBody.query.substring(0, 100)}${requestBody.query.length > 100 ? '...' : ''}"`);
    
    // Set a timeout for the request
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 25000); // 25 seconds timeout
    
    try {
      // Forward the request to Perplexity API
      const response = await fetch('https://api.perplexity.ai/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${API_KEY}`
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
        const errorText = await response.text();
        console.error(`Perplexity API error (${response.status}): ${errorText}`);
        return {
          statusCode: response.status,
          body: JSON.stringify({ 
            error: `Perplexity API Error: ${response.statusText}`, 
            details: errorText
          }),
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
      
      // Parse the response data
      const data = await response.json();
      
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
                return { title: "Citation", url: "#" };
              }
            });
          }
        } catch (e) {
          console.warn("Error parsing citations:", e);
        }
      }
      
      // Return processed response
      return {
        statusCode: 200,
        body: JSON.stringify(responseData),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        }
      };
    } catch (fetchError) {
      // Check if this is an abort error (timeout)
      if (fetchError.name === 'AbortError') {
        return {
          statusCode: 504,
          body: JSON.stringify({ 
            error: 'Gateway Timeout', 
            message: 'The request to the Perplexity API took too long to complete (>25 seconds).'
          }),
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        };
      }
      
      // Handle other fetch errors
      return {
        statusCode: 500,
        body: JSON.stringify({ 
          error: 'Request Failed', 
          message: fetchError.message
        }),
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      };
    }
  } catch (error) {
    console.error('Function error:', error.message, error.stack);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: 'Internal Server Error', 
        message: error.message
      }),
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    };
  }
};
