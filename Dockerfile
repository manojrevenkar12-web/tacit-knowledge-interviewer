# The memory service: interviews, the knowledge graph, the answer agent and the planner.
FROM node:22.23-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY config ./config
COPY db ./db
COPY demo ./demo
COPY knowledge ./knowledge
COPY prompts ./prompts
COPY reports ./reports
COPY src ./src
COPY tsconfig.json ./
USER node
EXPOSE 8795
CMD ["node", "--import", "tsx", "src/product/service/main.ts"]
