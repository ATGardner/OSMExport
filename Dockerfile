FROM node:24-alpine

LABEL maintainer="Noam \"Amtrak\" Gal"

ENV NODE_ENV production

# The `gpx` dependency is installed straight from GitHub, so npm needs git.
RUN apk add --update --no-cache git

RUN addgroup -S osmexport && adduser  -S -G osmexport osmexport
USER osmexport:osmexport

COPY --chown=osmexport:osmexport index.ts package.json package-lock.json /app/
RUN cd /app; npm ci --production

ADD --chown=osmexport:osmexport src /app/src/

WORKDIR /app

EXPOSE 3000

# Node 24 strips the types natively; types/ is compile-time only and never copied.
CMD ["node", "index.ts"]
