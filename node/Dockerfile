# 阶段1：安装依赖（使用pnpm）
FROM node:alpine AS deps
WORKDIR /usr/src/phonde
# 安装pnpm（可指定版本，如 pnpm@8）
RUN npm install -g pnpm
# 复制包管理文件
COPY package.json pnpm-lock.yaml* ./
# 如果项目原用npm，需先生成pnpm-lock.yaml（本地运行pnpm import后再构建）
RUN pnpm install --frozen-lockfile

# 阶段2：生产镜像
FROM node:alpine
WORKDIR /usr/src/phonde

# 安装puppeteer依赖（合并RUN减少层数）
RUN apk add --no-cache \
    chromium \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    && mkdir -p /usr/src/phonde/{logs,config} \
    && chown -R node:node /usr/src/phonde

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

# 从deps阶段复制node_modules和源码
COPY --from=deps --chown=node:node /usr/src/phonde/node_modules ./node_modules
COPY --chown=node:node . .

# 使用非root用户
USER node

EXPOSE 5888
CMD ["node", "emtrader.js"]

