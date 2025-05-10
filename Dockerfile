FROM oven/bun:1
WORKDIR /usr/src/app

COPY . .
RUN bun install
RUN bun fbuild

ENV NODE_ENV=production
EXPOSE 3000

CMD ["bun", "start"]