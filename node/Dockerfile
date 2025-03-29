# 阶段1：安装依赖
FROM node:18-alpine AS deps
WORKDIR /usr/src/phonde
COPY package*.json ./
RUN npm ci

# 阶段2：生产镜像
FROM node:18-alpine
WORKDIR /usr/src/phonde

# 安装puppeteer依赖
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 从deps阶段复制node_modules
COPY --from=deps /usr/src/phonde/node_modules ./node_modules
COPY . .

# 创建日志目录并设置权限
RUN mkdir -p /usr/src/phonde/logs \
    && chown -R node:node /usr/src/phonde/logs
RUN mkdir -p /usr/src/phonde/config \
    && chown -R node:node /usr/src/phonde/config


# 使用非root用户
USER node

EXPOSE 5888
CMD ["node", "emtrader.js"]
