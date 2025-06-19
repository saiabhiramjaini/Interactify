# Use Node.js LTS version as the base image
FROM node:20-slim

# Create app directory
WORKDIR /usr/src/app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# install typescript globally
RUN npm i -g typescript

# build the server
RUN npm run build

# Expose the port your app runs on
EXPOSE 8000

# Command to run the application
CMD ["node", "dist/index.js"] 