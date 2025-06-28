# everleaf/Dockerfile
FROM ubuntu:22.04

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_VERSION=20

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    gnupg \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install TexLive (full installation)
RUN apt-get update && apt-get install -y \
    texlive-full \
    texlive-xetex \
    texlive-luatex \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy backend package files
COPY everleaf-backend/package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy backend source
COPY everleaf-backend/ ./

# Create temp directory for LaTeX compilation
RUN mkdir -p /tmp/latex && chmod 755 /tmp/latex

# Expose port
EXPOSE 5000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/api/latex/health || exit 1

# Start the application
CMD ["npm", "start"]