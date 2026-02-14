import { type XmcpConfig } from "xmcp";

const config: XmcpConfig = {
  http: true,
  paths: {
    tools: "./src/tools",
    prompts: "./src/prompts",
    resources: "./src/resources",
  },
  bundler: (rspackConfig) => {
    const existing = rspackConfig.externals;
    rspackConfig.externals = [
      ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
      { '@libsql/client': 'commonjs @libsql/client' },
      { 'ai': 'commonjs ai' },
      { '@ai-sdk/google': 'commonjs @ai-sdk/google' },
    ];
    return rspackConfig;
  },
};

export default config;
