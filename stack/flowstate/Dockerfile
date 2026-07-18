# Self-host FlowState Reader (https://github.com/PeggyZWY/flowstate-webapp).
#
# It is a frontend-only Create React App with no backend or database, so we
# build the static bundle and serve it with a tiny web server. Fully offline
# after the first build.
#
# The default FLOWSTATE_REF is the moving "master" branch (latest upstream).
# For a reproducible build, pin it to a specific commit:
#   --build-arg FLOWSTATE_REF=<commit-sha>

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
# Force the official npm registry: upstream's lockfile pins the long-dead
# registry.npm.taobao.org mirror, whose TLS cert has expired (CERT_HAS_EXPIRED).
ENV CI=false PUBLIC_URL=/ NPM_CONFIG_REGISTRY=https://registry.npmjs.org/

WORKDIR /src
# node:16-bullseye (the full Debian image, not -slim) is buildpack-deps based
# and already ships git; install it defensively in case the base ever changes.
RUN git --version >/dev/null 2>&1 || (apt-get update && apt-get install -y --no-install-recommends git && rm -rf /var/lib/apt/lists/*)
RUN git clone --depth 1 --branch "${FLOWSTATE_REF}" "${FLOWSTATE_REPO}" . \
    || git clone "${FLOWSTATE_REPO}" . && git checkout "${FLOWSTATE_REF}"

WORKDIR /src/flowstate-react
# Drop the stale lockfile/.npmrc (they point at the dead taobao mirror) and
# resolve fresh from the official registry pinned via NPM_CONFIG_REGISTRY.
RUN rm -f package-lock.json yarn.lock .npmrc
RUN npm install --no-audit --no-fund
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
