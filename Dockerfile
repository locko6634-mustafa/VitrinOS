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

FROM nginx:alpine AS frontend
COPY --from=build /app/index.html /app/login.html /app/dashboard.html /app/admin.html /app/mfa-challenge.html /app/mfa-setup.html /app/set-password.html /app/sitemap.xml /app/robots.txt /app/favicon.ico /usr/share/nginx/html/
COPY --from=build /app/css /usr/share/nginx/html/css
COPY --from=build /app/js /usr/share/nginx/html/js
COPY --from=build /app/assets /usr/share/nginx/html/assets
EXPOSE 80

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

