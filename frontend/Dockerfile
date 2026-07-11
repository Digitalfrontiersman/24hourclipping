# Dev-oriented image: runs the CRACO dev server with hot reload.
FROM node:20-bookworm-slim

WORKDIR /app

# Install dependencies first for better layer caching.
COPY package.json yarn.lock* ./
RUN yarn install --frozen-lockfile || yarn install

COPY . .

EXPOSE 3000
CMD ["yarn", "start"]
