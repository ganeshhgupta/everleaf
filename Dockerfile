# Optimized Dockerfile for Render deployment
FROM node:20-slim

# Set environment variables
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV TEXLIVE_INSTALL_NO_CONTEXT_CACHE=1

# Install system dependencies efficiently
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    ca-certificates \
    gnupg \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    texlive-science \
    texlive-bibtex-extra \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create app directory
WORKDIR /app

# Copy package files first for better caching
COPY everleaf-backend/package*.json ./

# Install Node.js dependencies (using new syntax)
RUN npm ci --omit=dev --no-optional && npm cache clean --force

# Copy application code
COPY everleaf-backend/ ./

# Create necessary directories
RUN mkdir -p /tmp/latex /app/uploads && \
    chmod 755 /tmp/latex /app/uploads

# Expose port (Render will set PORT env var)
EXPOSE $PORT

# Health check endpoint
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:$PORT/health || exit 1

# Start the application
CMD ["npm", "start"]