/** @type {import('next').NextConfig} */
const { version } = require('./package.json');
const path = require('path');

const withPWA = require("next-pwa")({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  reloadOnOnline: false,
  runtimeCaching: [
    {
      urlPattern: /^https?.*/,
      handler: 'NetworkOnly',
    },
  ],
  reloadOnOnline: false,
});

module.exports = withPWA({
  output: "standalone",
  outputFileTracingRoot: __dirname,
  env: {
    VERSION: version,
  },
});
