module.exports = {
  apps: [
    {
      name: "michaelgpt",
      cwd: "/var/www/michaelgpt/server",
      script: "server.js",
      interpreter: "node",
      env: {
        NODE_ENV: "production",
        PORT: 5000,
        OLLAMA_BASE_URL: "http://127.0.0.1:11434",
        OLLAMA_MODEL: "qwen2.5:0.5b",
        OLLAMA_LOW_MEMORY_MODEL: "qwen2.5:0.5b",
        OLLAMA_LOW_MEMORY_MODE: "true",
        OLLAMA_KEEP_ALIVE: "2m",
        OLLAMA_NUM_CTX: "1536",
        OLLAMA_MAX_HISTORY_MESSAGES: "8",
        OLLAMA_MAX_HISTORY_CHARS: "9000",
      },
    },
  ],
};
