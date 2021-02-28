const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/maps',
    createProxyMiddleware({
      target: 'https://dreamland.rocks',
      changeOrigin: true,
    })
  );
  app.use(
    '/help',
    createProxyMiddleware({
      target: 'https://dreamland.rocks',
      changeOrigin: true,
    })
  );
};
