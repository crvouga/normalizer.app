FROM oven/bun:1-alpine

RUN apk add --no-cache curl netcat-openbsd

WORKDIR /app

COPY package.json bun.lock bunfig.toml ./

RUN bun install --frozen-lockfile

COPY . .

ARG NODE_ENV=production
ARG PORT=5000

ENV NODE_ENV=${NODE_ENV}
ENV PORT=${PORT}

EXPOSE ${PORT}

CMD ["bun", "run", "src/server.tsx"]
