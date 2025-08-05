# syntax = docker/dockerfile:1
ARG NODE_VERSION=18.16.0
FROM node:${NODE_VERSION}-slim AS base

LABEL fly_launch_runtime="NodeJS"
WORKDIR /app
ENV NODE_ENV=production
EXPOSE 8080

FROM base AS build
RUN apt-get update -qq && \
    apt-get install -y python-is-python3 pkg-config build-essential && \
    rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

FROM base
COPY --from=build /app /app
CMD ["npm", "run", "start"]
