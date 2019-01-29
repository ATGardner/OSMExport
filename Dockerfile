FROM node:alpine

LABEL maintainer="Noam \"Amtrak\" Gal"

RUN npm install -g nodemon
RUN apk add --update --no-cache git

RUN addgroup -S osmexport && adduser  -S -G osmexport osmexport
USER osmexport:osmexport

COPY --chown=osmexport:osmexport index.js package.json package-lock.json /server/
RUN cd /server; npm ci --production

ADD --chown=osmexport:osmexport src /server/src/

WORKDIR /server

EXPOSE 3000

CMD ["nodemon", "-L", "--inspect=[::]:9229", "index.js"]
