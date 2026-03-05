"use client";

import { useEffect, useRef } from "react";

type Props = {
  pageType: "BRAND_HUB" | "MODEL_LANDING";
  pagePath: string;
  source?: string;
  brandId?: string;
  brandSlug?: string;
  brandName?: string;
  modelId?: string;
  modelName?: string;
};

const SESSION_KEY = "batteryfit-marketing-session-id";

function getSessionId() {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = window.localStorage.getItem(SESSION_KEY);
  if (existing) {
    return existing;
  }

  const generated =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(SESSION_KEY, generated);
  return generated;
}

export default function MarketingPageViewTracker(props: Props) {
  const sentRef = useRef(false);

  useEffect(() => {
    if (sentRef.current) {
      return;
    }
    sentRef.current = true;

    const payload = {
      eventType: "PAGE_VIEW",
      pageType: props.pageType,
      pagePath: props.pagePath,
      source: props.source ?? "page",
      brandId: props.brandId,
      brandSlug: props.brandSlug,
      brandName: props.brandName,
      modelId: props.modelId,
      modelName: props.modelName,
      sessionId: getSessionId(),
    };

    const body = JSON.stringify(payload);

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      try {
        const blob = new Blob([body], { type: "application/json" });
        navigator.sendBeacon("/api/track/marketing", blob);
        return;
      } catch {
        // fall through to fetch
      }
    }

    void fetch("/api/track/marketing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    });
  }, [props]);

  return null;
}
