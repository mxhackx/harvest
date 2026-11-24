import type { FastifyBaseLogger } from "fastify";
import { purgeOldAudit } from "./audit/record.js";
import { purgeExpiredTrash } from "./leads/trash.js";
import { sendDueReminders } from "./reminders/send.js";
import { runDelayedAutomations } from "./automations/run.js";

type Job = { name: string; everyMs: number; run: () => Promise<unknown> };

/** Tâches de fond, lancées par le serveur (jamais pendant les tests). Une erreur est journalisée, jamais fatale. */
const JOBS: Job[] = [
  { name: "purge de la corbeille", everyMs: 6 * 3_600_000, run: purgeExpiredTrash },
  { name: "purge du journal d'audit", everyMs: 24 * 3_600_000, run: purgeOldAudit },
  { name: "automatisations (relances)", everyMs: 15 * 60_000, run: runDelayedAutomations },
  { name: "rappels", everyMs: 5 * 60_000, run: sendDueReminders },
];

export function startJobs(log: FastifyBaseLogger, jobs: Job[] = JOBS) {
  const timers = jobs.map((job) => {
    const tick = () => job.run().then((r) => log.info({ job: job.name, result: r }, "job done"), (err) => log.error({ err, job: job.name }, "job failed"));
    void tick();
    return setInterval(tick, job.everyMs);
  });
  return () => timers.forEach(clearInterval);
}
