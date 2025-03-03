# Download and Deploy Guide

This guide explains how to download all the project files and deploy them as a complete application.

## Option 1: Download from GitHub Repository (Recommended)

If the project is available on GitHub, you can download everything at once:

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/enhanced-llm-playground.git
   cd enhanced-llm-playground
   ```

2. Create the .env file with your API token:
   ```bash
   cp .env.example .env
   # Edit the .env file with your text editor to add your Fireworks.ai API token
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the server:
   ```bash
   node server.js
   ```

## Option 2: Download Files Manually

If you need to download the files individually or create them:

1. Create a project folder:
   ```bash
   mkdir enhanced-llm-playground
   cd enhanced-llm-playground
   ```

2. Create the required files with their content:
   - Create `server.js`
   - Create `package.json`
   - Create `.env.example`
   - Create `public/index.html`
   - And all other files as needed

3. Create a `.env` file:
   ```bash
   # Create .env file with your API token
   echo "FIREWORKS_API_TOKEN=your_api_token_here" > .env
   echo "PORT=3000" >> .env
   ```

4. Initialize the project and install dependencies:
   ```bash
   npm init -y                  # Create a package.json if missing
   npm install express cors dotenv http-proxy-middleware
   ```

5. Start the server:
   ```bash
   node server.js
   ```

## Option 3: Automate File Download with a Script

You can use a script to download all files automatically:

1. Create a download script file called `download-files.sh`:
   ```bash
   #!/bin/bash
   
   # Create the project directory
   mkdir -p enhanced-llm-playground/public
   cd enhanced-llm-playground
   
   # Define files to download with their URLs
   # Replace these URLs with actual URLs where files are hosted
   files=(
     "server.js:https://yourserver.com/path/to/server.js"
     "package.json:https://yourserver.com/path/to/package.json"
     ".env.example:https://yourserver.com/path/to/.env.example"
     "public/index.html:https://yourserver.com/path/to/index.html"
     # Add all other files here
   )
   
   # Download each file
   for file in "${files[@]}"; do
     # Split the entry into file path and URL
     filepath=$(echo $file | cut -d':' -f1)
     url=$(echo $file | cut -d':' -f2-)
     
     # Create directory if needed
     dir=$(dirname "$filepath")
     mkdir -p "$dir"
     
     # Download the file
     echo "Downloading $filepath..."
     curl -s -o "$filepath" "$url"
   done
   
   # Create .env file
   echo "Creating .env file template..."
   cp .env.example .env
   echo "Please edit .env file to add your Fireworks.ai API token"
   
   # Install dependencies
   echo "Installing dependencies..."
   npm install
   
   echo "Download complete! Navigate to the enhanced-llm-playground directory and edit the .env file."
   ```

2. Make it executable and run it:
   ```bash
   chmod +x download-files.sh
   ./download-files.sh
   ```

## Option 4: Use a Deployment Package

If available, you can download a ready-made deployment package:

1. Download the deployment zip file
2. Extract it:
   ```bash
   unzip enhanced-llm-playground.zip
   cd enhanced-llm-playground
   ```

3. Create the .env file:
   ```bash
   cp .env.example .env
   # Edit .env file to add your API token
   ```

4. Install dependencies and start the server:
   ```bash
   npm install
   node server.js
   ```

## Deployment Checklist

Regardless of how you download the files, make sure to:

1. ✅ Create a `.env` file with your Fireworks.ai API token
2. ✅ Install all dependencies with `npm install`
3. ✅ Configure any deployment-specific settings (port, domain, etc.)
4. ✅ Start the server in the appropriate mode for your environment

## Deployment Options

After downloading all files, you can deploy using any of the methods described in the `DEPLOYMENT.md` file:

- Local development server
- VPS/dedicated server
- Docker container
- Cloud platforms (Render, Heroku, etc.)

See `DEPLOYMENT.md` for detailed instructions on each deployment method.
