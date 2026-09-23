"use client";
// Invite link + QR + copy + native share (S11, S26).

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useApp } from "./AppProvider";
import { Icon } from "./Icon";
import { inviteUrl } from "@/lib/api";
import { t } from "@/lib/i18n";
import type { Clan } from "@/lib/types";

export function Invite({ clan, qr = true }: { clan: Pick<Clan, "name" | "challenge_name" | "length_days" | "invite_code">; qr?: boolean }) {
  const { toast } = useApp();
  const [svg, setSvg] = useState("");
  const url = inviteUrl(clan.invite_code);

  useEffect(() => {
    if (!qr) return;
    // Our own generated SVG from a URL we built; safe to inline.
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M" }).then(setSvg).catch(() => setSvg(""));
  }, [url, qr]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      toast(t("create.copied"), "success");
    } catch {
      /* clipboard blocked: the link stays visible to copy by hand */
    }
  }
  const text = t("create.shareText", { clan: clan.name, challenge: clan.challenge_name, days: clan.length_days, url });
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  return (
    <div className="invite">
      {qr && svg && (
        <figure className="invite__qr">
          <div dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label="Invite QR code" />
          <figcaption className="small">{t("create.qrNote")}</figcaption>
        </figure>
      )}
      <div className="invite__link">
        <input className="input" readOnly value={url} aria-label="Invite link" onFocus={(e) => e.currentTarget.select()} />
        <button className="icon-btn" onClick={copy} aria-label={t("create.copy")}><Icon name="copy" /></button>
      </div>
      {canShare && (
        <button className="btn btn--primary" onClick={() => navigator.share({ title: clan.name, text, url }).catch(() => {})}>
          <Icon name="share" /> {t("create.shareInvite")}
        </button>
      )}
    </div>
  );
}
