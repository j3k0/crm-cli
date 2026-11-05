# Node 24 LTS (maintained until 2028-04), pinned by digest: bump both together.
FROM node:24-bookworm-slim@sha256:c86ecead9e55a5210ac1727de38a4ca840bf03dcaf34dc9749addbf383b1920c

WORKDIR /app
COPY package.json package-lock.json /app/
RUN npm ci

COPY crm README.md tsconfig.json /app/
COPY templates /app/templates
COPY types /app/types
COPY src /app/src
# update apidoc (served under /doc)
RUN npm run doc
# build javascript
RUN npm run build
# drop build-only dependencies from the final image
RUN npm prune --omit=dev

# run as the unprivileged "node" user (binding port 80 relies on Docker's default
# net.ipv4.ip_unprivileged_port_start=0, Docker >= 20.10)
RUN mkdir -p /app/data && chown node:node /app/data
USER node

# SERVER_API_KEY is required at runtime: at least 16 random characters.
# Without it, the server generates a random key and prints it in the logs.
# ALLOW_RESET=1 enables full database resets through POST /reset.
# The server only speaks HTTP: expose it through a TLS-terminating reverse proxy.
ENV PORT=80
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:///app/data/crm.json
VOLUME /app/data

EXPOSE 80

CMD ["node", "--enable-source-maps", "build/crmApiServer"]
