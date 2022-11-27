FROM node:18

EXPOSE 3003

# Use latest version of npm
RUN npm install npm@latest -g

COPY package.json package-lock.json* ./

RUN npm install --no-optional && npm cache clean --force

WORKDIR /usr

COPY . .

CMD [ "npm", "run", "start"]
