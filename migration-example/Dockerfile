# 使用官方 Node.js 18 輕量版
FROM node:18-slim

# 設定工作目錄
WORKDIR /app

# 複製 package.json
COPY package*.json ./

# 安裝正式環境套件
RUN npm ci --only=production

# 複製程式碼
COPY . .

# 暴露 Port
EXPOSE 8080

# 設定環境變數
ENV NODE_ENV=production

# 啟動 (確認是 server.js)
CMD ["node", "server.js"] 
