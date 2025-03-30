FROM node:slim AS deps
WORKDIR /usr/src/phonde
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

FROM puppeteer:22.13.0
WORKDIR /usr/src/phonde

# 切换到root进行配置
USER root

# 确保使用node用户(继承自puppeteer镜像)
RUN mkdir -p /usr/src/phonde/logs /usr/src/phonde/config && \
    chown -R node:node /usr/src/phonde && \
    chmod -R 775 /usr/src/phonde/logs

RUN apt-get update && apt-get install -y \
    fonts-wqy-zenhei \
    && rm -rf /var/lib/apt/lists/*

COPY --from=deps --chown=node:node /usr/src/phonde/node_modules ./node_modules
COPY --chown=node:node . .

USER node

# 环境变量
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome

EXPOSE 5888
CMD ["node", "emtrader.js"]
