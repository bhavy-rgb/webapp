// PM2 config for sandbox development.
// - chessify-server: Express API on :3001
// - chessify-client: Vite dev server on :3000 (proxies /api → :3001)
module.exports = {
  apps: [
    {
      name: "chessify-server",
      cwd: "/home/user/webapp/server",
      script: "npx",
      args: "tsx src/index.ts",
      env: {
        CHESSIFY_PORT: 3001,
        JWT_SECRET: "sandbox-dev-secret",
        // Bootstrap admin: the FIRST signup with this username gets isAdmin=true.
        ADMIN_USERNAME: "admin",
      },
      watch: false,
      instances: 1,
      exec_mode: "fork",
    },
    {
      name: "chessify-client",
      cwd: "/home/user/webapp/client",
      script: "npx",
      args: "vite --port 3000 --host 0.0.0.0",
      env: {},
      watch: false,
      instances: 1,
      exec_mode: "fork",
    },
  ],
};
