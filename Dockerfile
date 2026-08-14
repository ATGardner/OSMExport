FROM node:24-alpine

LABEL maintainer="Noam \"Amtrak\" Gal"

ENV NODE_ENV production

# The `gpx` dependency is installed straight from GitHub, so npm needs git.
RUN apk add --update --no-cache git

# Pinned rather than auto-allocated: the chart's `podSecurityContext.fsGroup`
# has to name this GID to make a mounted PersistentVolume writable, and it
# cannot do that if the number shifts when the base image adds a system user.
RUN addgroup -S -g 10001 osmexport && adduser -S -u 10001 -G osmexport osmexport
USER osmexport:osmexport

COPY --chown=osmexport:osmexport index.ts package.json package-lock.json /app/
RUN cd /app; npm ci --production

ADD --chown=osmexport:osmexport src /app/src/

WORKDIR /app

EXPOSE 3000

# Node 24 strips the types natively; types/ is compile-time only and never copied.
CMD ["node", "index.ts"]
