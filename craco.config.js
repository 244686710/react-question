const path = require('path');

module.exports = {
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src') // 配置 '@' 别名指向 'src' 目录
    }
  }
};
