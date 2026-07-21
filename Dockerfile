FROM node:24-bookworm-slim AS build

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/worker/package.json apps/worker/package.json
COPY packages/contracts/package.json packages/contracts/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/security/package.json packages/security/package.json

RUN npm ci

COPY . .
RUN npm run build

FROM build AS api
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/api/dist/index.js"]

FROM build AS worker
ENV NODE_ENV=production
CMD ["node", "apps/worker/dist/index.js"]

FROM build AS migrate
ENV NODE_ENV=production
CMD ["npm", "run", "db:migrate", "--workspace", "@vitrinos/db"]
