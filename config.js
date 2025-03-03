/**
 * Configuration file for Enhanced LLM Playground
 * You can modify these default settings
 */

const config = {
    // Server configuration
    server: {
      port: process.env.PORT || 3000,
      host: process.env.HOST || '0.0.0.0',
      corsEnabled: true,
      logLevel: process.env.NODE_ENV === 'production' ? 'info' : 'debug'
    },
    
    // Fireworks.ai API configuration
    fireworks: {
      apiEndpoint: 'https://api.fireworks.ai/inference/v1/chat/completions',
      // The API token is loaded from environment variables
      // Default model configuration
      defaultModel: 'accounts/fireworks/models/llama-v2-70b-chat',
      // These are the parameters that will be used if not set in the UI
      defaultParams: {
        temperature: 0.5,
        top_p: 0.9,
        top_k: 55,
        max_tokens: 1112,
        presence_penalty: 0,
        frequency_penalty: 0.4
      }
    },
    
    // Security settings
    security: {
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
      },
      helmetEnabled: true // Enable Helmet security headers in production
    }
  };
  
  module.exports = config;