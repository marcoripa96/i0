import { type XmcpConfig } from "xmcp";

const config: XmcpConfig = {
  http: true,
  experimental: {
    adapter: "nextjs",
  },
  paths: {
    tools: "src/tools",
    prompts: "src/prompts",
    resources: "src/resources",
  },
  typescript: {
    skipTypeCheck: true,
  },
};

export default config;