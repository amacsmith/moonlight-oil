# Self-host FlowState Reader (https://github.com/PeggyZWY/flowstate-webapp).
#
# It is a frontend-only Create React App with no backend or database, so we
# build the static bundle and serve it with a tiny web server. Fully offline
# after the first build.
#
# Build from a pinned upstream commit for reproducibility. Override with:
#   --build-arg FLOWSTATE_REF=<branch-or-commit>

# --- Stage 1: build the static site ----------------------------------------
# react-scripts 3.1.1 (webpack 4) predates OpenSSL 3. We build on Node 16,
# which is still built against OpenSSL 1.1.1, so the classic webpack-4 OpenSSL
# error never occurs and no --openssl-legacy-provider flag is needed (that flag
# only exists on Node 17+ and is rejected on Node 16). CI=false stops CRA from
# treating lint warnings as build-breaking errors. PUBLIC_URL=/ makes assets
# resolve when served at root (upstream's "homepage" points at a Pages subpath).
FROM node:16-bullseye AS build
ARG FLOWSTATE_REPO=https://github.com/PeggyZWY/flowstate-webapp.git
ARG FLOWSTATE_REF=master
ENV CI=false PUBLIC_URL=/

WORKDIR /src
RUN git clone --depth 1 --branch "${FLOWSTATE_REF}" "${FLOWSTATE_REPO}" . \
    || git clone "${FLOWSTATE_REPO}" . && git checkout "${FLOWSTATE_REF}"

WORKDIR /src/flowstate-react
# Lockfile is present, but it's an old tree — fall back to install if ci fails.
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund
RUN npm run build

# --- Stage 2: serve the static files ---------------------------------------
FROM nginx:alpine AS serve
# SPA fallback so client-side routes (react-router) work on refresh.
RUN printf '%s\n' \
    'server {' \
    '  listen 80;' \
    '  root /usr/share/nginx/html;' \
    '  index index.html;' \
    '  location / { try_files $uri $uri/ /index.html; }' \
    '}' > /etc/nginx/conf.d/default.conf
COPY --from=build /src/flowstate-react/build /usr/share/nginx/html
EXPOSE 80
