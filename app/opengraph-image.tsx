import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "배터리핏 - 내차에 딱 맞는 배터리 찾기";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #0a0e17 0%, #111827 50%, #0a0e17 100%)",
          position: "relative",
        }}
      >
        {/* Subtle grid pattern */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            opacity: 0.06,
            backgroundImage:
              "linear-gradient(rgba(59,130,246,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(59,130,246,0.5) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />

        {/* Glow effect behind battery */}
        <div
          style={{
            position: "absolute",
            width: 300,
            height: 300,
            borderRadius: "50%",
            background: "radial-gradient(circle, rgba(59,130,246,0.15) 0%, transparent 70%)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -60%)",
          }}
        />

        {/* Battery Icon */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginBottom: 24,
          }}
        >
          {/* Battery terminal */}
          <div
            style={{
              width: 48,
              height: 20,
              borderRadius: "6px 6px 0 0",
              background: "#3b82f6",
            }}
          />
          {/* Battery body */}
          <div
            style={{
              width: 108,
              height: 148,
              borderRadius: 14,
              border: "5px solid #3b82f6",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-end",
              padding: 8,
              gap: 4,
            }}
          >
            {/* Low charge bar */}
            <div
              style={{
                width: "100%",
                height: 28,
                borderRadius: 6,
                background: "rgba(59,130,246,0.35)",
              }}
            />
            {/* Mid charge bar */}
            <div
              style={{
                width: "100%",
                height: 28,
                borderRadius: 6,
                background: "rgba(59,130,246,0.6)",
              }}
            />
            {/* Full charge bar */}
            <div
              style={{
                width: "100%",
                height: 28,
                borderRadius: 6,
                background: "#3b82f6",
              }}
            />
          </div>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "-1px",
            marginTop: 8,
          }}
        >
          배터리핏
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 28,
            color: "rgba(255,255,255,0.6)",
            marginTop: 12,
            letterSpacing: "0.5px",
          }}
        >
          내 차에 딱 맞는 배터리 찾기
        </div>

        {/* Bottom accent line */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 4,
            background: "linear-gradient(90deg, transparent, #3b82f6, transparent)",
          }}
        />
      </div>
    ),
    { ...size }
  );
}
