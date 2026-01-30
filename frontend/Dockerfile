# Build Stage
FROM node:18-alpine as build
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production Stage (Nginx)
FROM nginx:stable-alpine
COPY --from=build /app/build /usr/share/nginx/html
# Add a custom nginx config if you have routing issues, 
# but for this app, the default is usually fine.
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]