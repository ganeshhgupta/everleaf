# Optimized Dockerfile for Railway deployment
# Using a more efficient approach to avoid build timeouts
FROM node:20-slim

# Set environment variables to prevent interactive prompts
ENV DEBIAN_FRONTEND=noninteractive
ENV NODE_ENV=production
ENV TEXLIVE_INSTALL_NO_CONTEXT_CACHE=1

# Install system dependencies in smaller chunks to avoid timeouts
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    wget \
    ca-certificates \
    gnupg \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install TexLive in a more Railway-friendly way
# Using texlive-latex-recommended instead of texlive-full to reduce size
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-latex-base \
    texlive-latex-recommended \
    texlive-latex-extra \
    texlive-fonts-recommended \
    texlive-fonts-extra \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install additional TexLive packages if needed
RUN apt-get update && apt-get install -y --no-install-recommends \
    texlive-science \
    texlive-bibtex-extra \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Create app directory
WORKDIR /app

# Create non-root user for security
RUN groupadd -r appuser && useradd -r -g appuser appuser

# Copy package files first for better caching
COPY everleaf-backend/package*.json ./

# Install Node.js dependencies
RUN npm install --production --no-optional && npm cache clean --force

# Copy application code
COPY everleaf-backend/ ./

# Create necessary directories with proper permissions
RUN mkdir -p /tmp/latex /app/uploads && \
    chmod 755 /tmp/latex /app/uploads && \
    chown -R appuser:appuser /app /tmp/latex

# Switch to non-root user
USER appuser

# Expose port
EXPOSE 5000

# Add a basic health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:5000/api/latex/health || exit 1

# Start the application
CMD ["npm", "start"]