# PayBridge webapp — production image.
#
# IMPORTANT: this image is built with the *repository root* as the Docker
# build context (see ../docker-compose.yml), not webapp/. Several webapp
# source files import ../../../backend/src/types.ts directly for shared Zod
# schemas (see webapp/vite.config.ts's comment on the same thing for Vercel),
# so backend/src/types.ts must exist at that relative path when `vite build`
# runs. It only imports "zod", so nothing else from backend/ is needed.
FROM node:20-bookworm-slim AS build
WORKDIR /repo

COPY backend/src/types.ts backend/src/types.ts

COPY webapp/package*.json webapp/
RUN npm ci --prefix webapp

COPY webapp/ webapp/
RUN npm run build --prefix webapp

FROM nginx:1.27-alpine
COPY --from=build /repo/webapp/dist /usr/share/nginx/html
# The base image ships its own default.conf (a generic welcome/proxy config)
# in this same directory — templates/app.conf.template above renders to
# conf.d/app.conf alongside it, and having both loaded is what silently
# served requests from the wrong config. Only ours should exist.
RUN rm -f /etc/nginx/conf.d/default.conf
COPY deploy/nginx/app.conf.template /etc/nginx/templates/app.conf.template
EXPOSE 80 443
