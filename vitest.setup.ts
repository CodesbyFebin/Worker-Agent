process.env.NODE_ENV ??= "test";
process.env.DATABASE_URL ??= "mysql://root:@127.0.0.1:3306/worker_agent_cloud";
process.env.REDIS_URL ??= "redis://127.0.0.1:6380";
process.env.LLM_PROVIDER ??= "auto";
