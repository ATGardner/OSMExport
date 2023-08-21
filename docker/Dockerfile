FROM node:20-alpine

LABEL maintainer="Noam \"Amtrak\" Gal"

ENV NODE_ENV production

RUN npm install -g nodemon
RUN apk add --update --no-cache git

RUN addgroup -S osmexport && adduser  -S -G osmexport osmexport
USER osmexport:osmexport

COPY --chown=osmexport:osmexport index.mjs package.json package-lock.json /app/
RUN cd /app; npm ci --production

ADD --chown=osmexport:osmexport src /app/src/

WORKDIR /app

EXPOSE 3000

CMD ["nodemon", "--inspect=[::]:9229", "index.mjs"]
