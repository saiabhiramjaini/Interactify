# Use Node.js LTS version as the base image
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies (dev dependencies are needed for the TypeScript build)
RUN npm install

# Copy source code
COPY . .

# Build the server, then drop dev dependencies from the image
RUN npm run build && npm prune --omit=dev

# The port the server listens on inside the container; override with -e PORT=...
ENV PORT=8000
EXPOSE 8000

# Command to run the application
CMD ["node", "dist/index.js"]
