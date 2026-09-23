-- ═══════════════════════════════════════════════════════════════════════════
-- The 90 — scheduled death checks
--
-- Run AFTER schema.sql. Every hour, judge each member's finished local days so a
-- flame dies (and the clan sees it) even if its owner never opens the app.
-- The app also calls sync_me() on load, so this is the "no one opened it" path.
-- ═══════════════════════════════════════════════════════════════════════════

create extension if not exists pg_cron with schema pg_catalog;

-- Re-running replaces the job with the same name.
select cron.unschedule(jobid) from cron.job where jobname = 'the90-evaluate';
select cron.schedule('the90-evaluate', '5 * * * *', $$select private.evaluate_all()$$);
