FROM node:20

RUN mkdir -p /app/data
COPY package.json package-lock.json /app/
WORKDIR /app
RUN npm install

COPY crm README.md tsconfig.json /app/
COPY templates /app/templates
COPY types /app/types
COPY src /app/src
# update apidoc (served under /doc)
RUN npm run doc
# build javascript
RUN npm run build

ENV SERVER_API_KEY=change_me
ENV PORT=80
ENV HOSTNAME=0.0.0.0
ENV DATABASE_URL=file:///app/data/crm.json
VOLUME /app/data

EXPOSE 80

CMD node --enable-source-maps build/crmApiServer
