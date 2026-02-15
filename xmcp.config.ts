import { type XmcpConfig } from "xmcp";

const config: XmcpConfig = {
  http: true,
  experimental: {
    adapter: "nextjs",
  },
  paths: {
    tools: "src/tools",
    prompts: "src/prompts",
    resources: false,
  },
  typescript: {
    skipTypeCheck: true,
  },
};

export default config;