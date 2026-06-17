"use client";
// 현재 동시 접속자 수 — 15초마다 heartbeat 핑 + 카운트 갱신
import { useEffect, useState } from "react";

export function LiveVisitors() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let id = sessionStorage.getItem("ulm_sid");
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : String(Math.random()).slice(2);
      sessionStorage.setItem("ulm_sid", id);
    }
    const ping = async () => {
      try {
        const r = await fetch(`/api/presence?id=${id}`, { cache: "no-store" });
        const d = await r.json();
        setCount(typeof d.count === "number" ? d.count : null);
      } catch {
        /* 무시 */
      }
    };
    ping();
    const t = setInterval(ping, 15000);
    return () => clearInterval(t);
  }, []);

  if (count == null) return null;
  return (
    <span className="live-visitors">
      <span className="live-dot" /> 지금 <b>{count.toLocaleString()}</b>명이 보고 있어요
    </span>
  );
}
