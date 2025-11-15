FROM oven/bun:1-alpine

RUN apk add --no-cache curl

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./

RUN bun install --frozen-lockfile

COPY . .

ARG NODE_ENV=production

ENV NODE_ENV=${NODE_ENV}

CMD ["bun", "run", "src/worker.tsx"]

