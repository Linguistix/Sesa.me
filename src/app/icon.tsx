import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

/** Generated at build time so the PWA install prompt has an icon with no asset pipeline. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(150deg, #6366F1, #C9A44C)",
          color: "#0B0B0F",
          fontSize: 300,
          fontWeight: 700,
        }}
      >
        S
      </div>
    ),
    size,
  );
}
