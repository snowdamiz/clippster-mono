# Dockerfile for Clippster Server
# Multi-stage build with Elixir + Node.js for Solana blockchain operations

# ==============================================================================
# Stage 1: Build stage
# ==============================================================================
ARG ELIXIR_VERSION=1.15.7
ARG OTP_VERSION=26.2.1
ARG DEBIAN_VERSION=bookworm-20231009-slim

ARG BUILDER_IMAGE="hexpm/elixir:${ELIXIR_VERSION}-erlang-${OTP_VERSION}-debian-${DEBIAN_VERSION}"
ARG RUNNER_IMAGE="debian:${DEBIAN_VERSION}"

FROM ${BUILDER_IMAGE} as builder

# Install build dependencies including Node.js
RUN apt-get update -y && apt-get install -y \
    build-essential \
    git \
    curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -f /var/lib/apt/lists/*_*

# Set build environment
ENV MIX_ENV="prod"

# Install hex + rebar
RUN mix local.hex --force && \
    mix local.rebar --force

# Create app directory
WORKDIR /app

# Install mix dependencies
COPY mix.exs mix.lock ./
RUN mix deps.get --only $MIX_ENV
RUN mkdir config

# Copy config files
COPY config/config.exs config/${MIX_ENV}.exs config/
RUN mix deps.compile

# Copy priv and lib directories
COPY priv priv
COPY lib lib

# Install Node.js dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy JS scripts to priv/js for release
RUN mkdir -p priv/js
COPY sig_verify.js payment_verify.js fetch_metadata.js priv/js/

# Copy runtime config
COPY config/runtime.exs config/

# Copy release overlay (env.sh.eex for dynamic node naming)
COPY rel rel

# Compile the release
RUN mix compile

# Build the release
RUN mix release

# ==============================================================================
# Stage 2: Runtime stage
# ==============================================================================
FROM ${RUNNER_IMAGE}

# Install runtime dependencies including Node.js
RUN apt-get update -y && apt-get install -y \
    libstdc++6 \
    openssl \
    libncurses5 \
    locales \
    curl \
    ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -f /var/lib/apt/lists/*_*

# Set the locale
RUN sed -i '/en_US.UTF-8/s/^# //g' /etc/locale.gen && locale-gen

ENV LANG en_US.UTF-8
ENV LANGUAGE en_US:en
ENV LC_ALL en_US.UTF-8

# Set runtime environment
ENV MIX_ENV="prod"
ENV PHX_SERVER="true"

WORKDIR /app

# Create a non-root user for security
RUN groupadd --gid 1000 elixir && \
    useradd --uid 1000 --gid elixir --shell /bin/bash --create-home elixir

# Copy the release from builder
COPY --from=builder --chown=elixir:elixir /app/_build/${MIX_ENV}/rel/clippster_server ./

# Copy node_modules for JS scripts
COPY --from=builder --chown=elixir:elixir /app/node_modules ./node_modules

# Switch to non-root user
USER elixir

# Expose the port
EXPOSE 4000

# Set the entrypoint
CMD ["/app/bin/clippster_server", "start"]
