"use client";
// Ranks (S28–S29): clans vs clans by average days alive. Clan names only, never people.

import { useEffect, useState } from "react";
import Link from "next/link";
import { useApp, useGate } from "@/components/AppProvider";
import { AppScreen, Loading } from "@/components/Shell";
import { Icon } from "@/components/Icon";
import { leaderboard } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { LeaderboardRow } from "@/lib/types";

const MEDALS = ["gold", "silver", "bronze"] as const;

export default function Ranks() {
  const ready = useGate("clan");
  const { active, toast } = useApp();
  const [rows, setRows] = useState<LeaderboardRow[] | null>(null);

  useEffect(() => {
    if (!ready) return;
    leaderboard().then(setRows).catch((e: Error) => { setRows([]); toast(e.message, "error"); });
  }, [ready, toast]);

  if (!ready) return <Loading />;

  return (
    <AppScreen>
      <header className="stack-sm">
        <h1>{t("ranks.title")}</h1>
        <p className="muted">{t("ranks.subtitle")}</p>
      </header>

      {rows === null ? (
        <div className="stack-sm">{[0, 1, 2].map((i) => <div key={i} className="skel" style={{ height: 72 }} />)}</div>
      ) : rows.length === 0 ? (
        <div className="card center-flow stack-sm">
          <Icon name="ranks" size={40} />
          <h2>{t("ranks.emptyTitle")}</h2>
          <p className="muted">{t("ranks.emptyBody", { clan: active?.clan.name ?? "" })}</p>
          <Link className="btn btn--primary" href="/clan">{t("ranks.emptyCta", { clan: active?.clan.name ?? "" })}</Link>
        </div>
      ) : (
        <>
          <ol className="podium" aria-label="Top 3">
            {rows.slice(0, 3).map((r, i) => (
              <li key={r.clan_id} className={`podium__step podium__step--${MEDALS[i]}${r.is_mine ? " is-mine" : ""}`}>
                <span className="clan-badge clan-badge--lg" aria-hidden>{r.name.slice(0, 1).toUpperCase()}</span>
                <strong className="podium__name">{r.name}</strong>
                <span className="podium__score num">{r.avg_run}</span>
                <span className="small">{t("ranks.avgDays")}</span>
                <span className="podium__block num" aria-label={`Rank ${i + 1}`}>{i + 1}</span>
              </li>
            ))}
          </ol>
          <ol className="list" start={4}>
            {rows.slice(3).map((r, i) => (
              <li key={r.clan_id} className={`row card${r.is_mine ? " is-mine" : ""}`}>
                <span className="rank num">{i + 4}</span>
                <span className="clan-badge" aria-hidden>{r.name.slice(0, 1).toUpperCase()}</span>
                <span className="row__main">
                  <strong>{r.name} {r.is_mine && <span className="tag tag--clan">{t("ranks.yourClan")}</span>}</strong>
                  <span className="small">{t("ranks.row", { challenge: r.challenge_name, members: r.members, alive: r.alive_today })}</span>
                </span>
                <span className="score"><strong className="num">{r.avg_run}</strong><span className="small">{t("ranks.avg")}</span></span>
              </li>
            ))}
          </ol>
        </>
      )}
    </AppScreen>
  );
}
