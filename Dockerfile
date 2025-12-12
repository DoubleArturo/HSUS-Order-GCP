# 使用官方 Node.js 輕量版作為基底
FROM node:18-slim

# 設定工作目錄
WORKDIR /app

# 1. 複製 package.json (利用 Docker 快取加速安裝)
COPY package*.json ./

# 2. 安裝正式環境套件 (跳過開發用套件)
RUN npm ci --only=production

# 3. 複製所有程式碼
COPY . .

# Cloud Run 預設會用 8080 Port
EXPOSE 8080

# 設定環境變數
ENV NODE_ENV=production

# 4. 啟動命令 (請確認你的主程式檔名是 server.js)
CMD ["node", "server.js"]
