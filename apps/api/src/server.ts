import { app } from "./app.js";
import { config } from "./config.js";
import { expireStaleCalls } from "./modules/calls/calls.service.js";

app.listen(config.port, () => {
  console.log(`API running on http://localhost:${config.port}`);
});

// Unanswered call requests are closed automatically.
setInterval(() => {
  expireStaleCalls().catch((error) => console.error("expireStaleCalls failed", error));
}, 30_000).unref();
