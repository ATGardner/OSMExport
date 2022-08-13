FROM node:14-alpine

LABEL maintainer="Noam \"Amtrak\" Gal"

ENV NODE_ENV development

RUN npm install -g nodemon

WORKDIR /app

EXPOSE 3000

CMD ["nodemon", "--delay", "1", "--legacy-watch", "--inspect=[::]:9229", "index.mjs"]
