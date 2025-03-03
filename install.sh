#!/bin/bash

# Enhanced LLM Playground Installer Script
# This script automates the setup of the Enhanced LLM Playground application
# It creates all the necessary files and sets up the environment

# Define text styles
BOLD="\033[1m"
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
RESET="\033[0m"

# Make script exit on error
set -e

echo -e "${BOLD}${BLUE}Enhanced LLM Playground Installer${RESET}"
echo -e "This script will set up the Enhanced LLM Playground application.\n"

# Check for required commands
check_command() {
  if ! command -v $1 &> /dev/null; then
    echo -e "${RED}Error: $1 is required but not installed.${RESET}"
    echo -e "Please install $1 and try again."
    exit 1
  fi
}

check_command "node"
check_command "npm"

# Check Node.js version
NODE_VERSION=$(node -v | cut -d 'v' -f 2 | cut -d '.' -f 1)
if [ "$NODE_VERSION" -lt 16 ]; then
  echo -e "${RED}Error: Node.js version 16 or higher is required.${RESET}"
  echo -e "Current version: $(node -v)"
  echo -e "Please upgrade Node.js and try again."
  exit 1
fi

# Ask for Fireworks.ai API token
echo -e "${YELLOW}Please enter your Fireworks.ai API token:${RESET}"
read -r API_TOKEN

if [ -z "$API_TOKEN" ]; then
  echo -e "${RED}Error: API token is required.${RESET}"
  exit 1
fi

# Create project directory
echo -e "\n${BLUE}Creating project directory...${RESET}"
PROJECT_DIR="enhanced-llm-playground"
mkdir -p "$PROJECT_DIR"
cd "$PROJECT_DIR"

# Create public directory
mkdir -p public

# Create .env file
echo -e "${BLUE}Creating .env file...${RESET}"
cat > .env << EOL
# Fireworks.ai API token
FIREWORKS_API_TOKEN=$API_TOKEN

# Server port (default: 3000)
PORT=3000
EOL

# Create .env.example file
cat > .env.example << EOL
# Rename this file to .env and add your API token
# DO NOT commit the .env file to version control!

# Your Fireworks.ai API token
FIREWORKS_API_TOKEN=your_api_token_here

# Port for the server (default is 3000)
PORT=3000
EOL

# Create .gitignore
cat > .gitignore << EOL
# Environment variables
.env

# Node modules
node_modules/

# Logs
logs
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Runtime data
pids
*.pid
*.seed
*.pid.lock

# Dependency directories
.npm
.eslintcache

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variable files
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Mac files
.DS_Store

# Windows files
Thumbs.db
ehthumbs.db
Desktop.ini
EOL

# Create package.json
echo -e "${BLUE}Creating package.json...${RESET}"
cat > package.json << EOL
{
  "name": "enhanced-llm-playground",
  "version": "1.0.0",
  "description": "Enhanced LLM Playground with Chain of Thought and Chain of Draft",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "keywords": [
    "llm",
    "ai",
    "chain-of-thought",
    "chain-of-draft",
    "fireworks-ai"
  ],
  "author": "",
  "license": "MIT",
  "dependencies": {
    "cors": "^2.8.5",
    "dotenv": "^16.3.1",
    "express": "^4.18.2",
    "http-proxy-middleware": "^2.0.6"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  },
  "engines": {
    "node": ">=16.0.0"
  }
}
EOL

# Create server.js
echo -e "${BLUE}Creating server.js...${RESET}"
cat > server.js << 'EOL'
// server.js
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { createProxyMiddleware } = require('http-proxy-middleware');
const path = require('path');

// Load environment variables
dotenv.config();

// Check if API token is set
if (!process.env.FIREWORKS_API_TOKEN) {
  console.error('ERROR: FIREWORKS_API_TOKEN environment variable is not set!');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'public')));

// Proxy middleware for Fireworks.ai API
app.use('/api/fireworks', createProxyMiddleware({
  target: 'https://api.fireworks.ai',
  changeOrigin: true,
  pathRewrite: {
    '^/api/fireworks': '/inference/v1/chat/completions'
  },
  onProxyReq: (proxyReq, req, res) => {
    // Add the API token to the request
    proxyReq.setHeader('Authorization', `Bearer ${process.env.FIREWORKS_API_TOKEN}`);
    
    // If the body is needed
    if (req.body) {
      const bodyData = JSON.stringify(req.body);
      proxyReq.setHeader('Content-Type', 'application/json');
      proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
      proxyReq.write(bodyData);
    }
  },
  logLevel: 'silent' // Change to 'debug' for troubleshooting
}));

// Route for checking if the server is running
app.get('/api/status', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Handle SPA routing - always return index.html for any unknown routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Visit http://localhost:${PORT} to use the application`);
});
EOL

# Create index.html
echo -e "${BLUE}Creating index.html...${RESET}"
cat > public/index.html << 'EOL'
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Enhanced LLM Playground (Chain of Thought + Draft)</title>
  <!-- Google Fonts -->
  <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@400;500&display=swap" rel="stylesheet">
  <style>
    /* CSS styles from the original file - paste here */
    /* ... */
  </style>
</head>
<body>
  <!-- HTML content from the original file - paste here -->
  <!-- ... -->
</body>
</html>
EOL

# Now that we have the basic structure, download the full index.html content
echo -e "${BLUE}Downloading the full index.html content...${RESET}"
curl -s -o public/index.html "https://raw.githubusercontent.com/yourusername/enhanced-llm-playground/main/public/index.html" || {
  echo -e "${YELLOW}Could not download index.html from GitHub. You'll need to manually add the content.${RESET}"
}

# Install dependencies
echo -e "\n${BLUE}Installing dependencies...${RESET}"
npm install

echo -e "\n${GREEN}Installation complete!${RESET}"
echo -e "You can now start the Enhanced LLM Playground with:"
echo -e "${BOLD}cd $PROJECT_DIR${RESET}"
echo -e "${BOLD}npm start${RESET}"
echo -e "\nThe application will be available at http://localhost:3000"