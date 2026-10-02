import { ImageResponse } from "next/og";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function OpengraphImage() {
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
          background: "linear-gradient(135deg, #1a1a2e 0%, #1a5c35 100%)",
          color: "#ffffff",
          padding: "80px",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: -180,
            right: -120,
            width: 480,
            height: 480,
            borderRadius: 9999,
            background: "rgba(111, 206, 151, 0.18)",
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            bottom: -220,
            left: -140,
            width: 520,
            height: 520,
            borderRadius: 9999,
            background: "rgba(111, 206, 151, 0.12)",
            display: "flex",
          }}
        />

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            marginBottom: 44,
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 16,
              background: "rgba(255, 255, 255, 0.15)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: "0 60% 0 60%",
                background: "#6fce97",
                transform: "rotate(45deg)",
                display: "flex",
              }}
            />
          </div>
          <div
            style={{
              display: "flex",
              fontSize: 30,
              fontWeight: 700,
              letterSpacing: 6,
              color: "#6fce97",
            }}
          >
            BIRDING.LIVE
          </div>
        </div>

        <div
          style={{
            display: "flex",
            fontSize: 76,
            fontWeight: 800,
            lineHeight: 1.15,
            textAlign: "center",
            maxWidth: 940,
          }}
        >
          Find birds &amp; birding spots near you
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 36,
            fontSize: 34,
            color: "rgba(255, 255, 255, 0.75)",
            textAlign: "center",
            maxWidth: 860,
          }}
        >
          Free live bird finder — parks, nature reserves and woodlands worldwide
        </div>
      </div>
    ),
    size
  );
}
