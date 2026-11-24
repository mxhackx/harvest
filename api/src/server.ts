import { buildApp } from "./app.js";
import { config } from "./config.js";
import { startJobs } from "./jobs.js";

const app = await buildApp();
await app.listen({ port: config.port, host: "0.0.0.0" });
startJobs(app.log);
