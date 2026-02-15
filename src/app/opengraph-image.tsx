import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt =
  "icons0 — The fastest icon search for you and your AI agent";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Minimal SVG icon paths rendered as decorative elements.
 * Each is a simple geometric shape that suggests "icon library"
 * without requiring external assets.
 */
const glyphs = [
  // arrow-right
  "M5 12h14M12 5l7 7-7 7",
  // search
  "M11 3a8 8 0 1 0 0 16 8 8 0 0 0 0-16ZM21 21l-4.35-4.35",
  // star
  "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
  // heart
  "M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78z",
  // code
  "M16 18l6-6-6-6M8 6l-6 6 6 6",
  // terminal
  "M4 17l6-5-6-5M12 19h8",
  // grid
  "M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z",
  // zap
  "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  // box
  "M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z",
  // layers
  "M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  // circle
  "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z",
  // hexagon
  "M21 16.05V7.95a2 2 0 0 0-1-1.73l-7-4.03a2 2 0 0 0-2 0L4 6.22A2 2 0 0 0 3 7.95v8.1a2 2 0 0 0 1 1.73l7 4.03a2 2 0 0 0 2 0l7-4.03a2 2 0 0 0 1-1.73z",
  // triangle
  "M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z",
  // diamond
  "M12 2l9 9-9 9-9-9 9-9z",
  // command
  "M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z",
  // eye
  "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  // settings
  "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  // download
  "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3",
  // check
  "M20 6L9 17l-5-5",
  // plus
  "M12 5v14M5 12h14",
  // x
  "M18 6L6 18M6 6l12 12",
  // minus
  "M5 12h14",
  // chevron-right
  "M9 18l6-6-6-6",
  // menu
  "M3 12h18M3 6h18M3 18h18",
];

export default function OGImage() {
  // Build dot grid as individual dots for satori compatibility
  const dots: Array<{ x: number; y: number }> = [];
  const spacing = 8;
  for (let y = 0; y < 630; y += spacing) {
    for (let x = 0; x < 1200; x += spacing) {
      dots.push({ x, y });
    }
  }

  // Lay out icons in a scattered grid across the right/bottom portion
  const iconGrid: Array<{
    glyph: string;
    x: number;
    y: number;
    opacity: number;
  }> = [];
  const cols = 8;
  const rows = 5;
  const cellW = 56;
  const cellH = 56;
  const gridOffsetX = 560;
  const gridOffsetY = 100;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      if (idx >= glyphs.length) break;
      // Fade out towards edges for a vignette feel
      const distFromCenter =
        Math.sqrt(
          Math.pow((col - cols / 2) / (cols / 2), 2) +
            Math.pow((row - rows / 2) / (rows / 2), 2)
        ) / 1.4;
      const opacity = Math.max(0.04, 0.18 - distFromCenter * 0.14);
      iconGrid.push({
        glyph: glyphs[idx],
        x: gridOffsetX + col * cellW,
        y: gridOffsetY + row * cellH,
        opacity,
      });
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200,
          height: 630,
          display: "flex",
          position: "relative",
          backgroundColor: "#0a0a0a",
          overflow: "hidden",
        }}
      >
        {/* Dot grid background */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 1200,
            height: 630,
            display: "flex",
            flexWrap: "wrap",
          }}
        >
          {dots
            .filter((_, i) => i % 3 === 0)
            .map((dot, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: dot.x,
                  top: dot.y,
                  width: 1,
                  height: 1,
                  backgroundColor: "#e0e0e0",
                  opacity: 0.06,
                }}
              />
            ))}
        </div>

        {/* Decorative icon grid — background layer */}
        {iconGrid.map((icon, i) => (
          <div
            key={i}
            style={{
              position: "absolute",
              left: icon.x,
              top: icon.y,
              width: 44,
              height: 44,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "1px solid",
              borderColor: `rgba(224, 224, 224, ${icon.opacity * 0.4})`,
            }}
          >
            <svg
              width="22"
              height="22"
              viewBox="0 0 24 24"
              fill="none"
              stroke={`rgba(224, 224, 224, ${icon.opacity})`}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={icon.glyph} />
            </svg>
          </div>
        ))}

        {/* Subtle gradient overlay for depth — left side readable */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: 700,
            height: 630,
            display: "flex",
            background:
              "linear-gradient(to right, #0a0a0a 60%, transparent 100%)",
          }}
        />

        {/* Bottom fade */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            width: 1200,
            height: 200,
            display: "flex",
            background:
              "linear-gradient(to top, #0a0a0a 20%, transparent 100%)",
          }}
        />

        {/* Content */}
        <div
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            padding: "80px 80px",
            width: "100%",
            height: "100%",
          }}
        >
          {/* Terminal prompt decoration */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 32,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                backgroundColor: "#737373",
                display: "flex",
              }}
            />
            <div
              style={{
                width: 8,
                height: 8,
                backgroundColor: "#404040",
                display: "flex",
              }}
            />
            <div
              style={{
                width: 8,
                height: 8,
                backgroundColor: "#262626",
                display: "flex",
              }}
            />
          </div>

          {/* Brand */}
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              marginBottom: 20,
            }}
          >
            <span
              style={{
                fontSize: 72,
                fontFamily: "monospace",
                fontWeight: 700,
                color: "#e0e0e0",
                letterSpacing: "-0.03em",
                lineHeight: 1,
              }}
            >
              icons0
            </span>
            <span
              style={{
                fontSize: 36,
                fontFamily: "monospace",
                fontWeight: 400,
                color: "#404040",
                letterSpacing: "-0.02em",
                lineHeight: 1,
              }}
            >
              .dev
            </span>
          </div>

          {/* Tagline */}
          <div
            style={{
              fontSize: 22,
              fontFamily: "monospace",
              color: "#737373",
              lineHeight: 1.5,
              marginBottom: 24,
              display: "flex",
            }}
          >
            the fastest icon search — for you and your AI agent
          </div>

          {/* Stats */}
          <div
            style={{
              fontSize: 15,
              fontFamily: "monospace",
              color: "#525252",
              letterSpacing: "0.02em",
              display: "flex",
              gap: 12,
              alignItems: "center",
            }}
          >
            <span style={{ display: "flex" }}>200k+ icons</span>
            <span style={{ color: "#333", display: "flex" }}>·</span>
            <span style={{ display: "flex" }}>150+ collections</span>
            <span style={{ color: "#333", display: "flex" }}>·</span>
            <span style={{ display: "flex" }}>web UI + MCP server</span>
          </div>

          {/* Install command hint at bottom */}
          <div
            style={{
              position: "absolute",
              bottom: 60,
              left: 80,
              display: "flex",
              alignItems: "center",
              gap: 12,
              border: "1px solid #1f1f1f",
              padding: "12px 20px",
              backgroundColor: "rgba(20, 20, 20, 0.8)",
            }}
          >
            <span
              style={{
                fontSize: 14,
                fontFamily: "monospace",
                color: "#404040",
                display: "flex",
              }}
            >
              $
            </span>
            <span
              style={{
                fontSize: 14,
                fontFamily: "monospace",
                color: "#737373",
                display: "flex",
              }}
            >
              npx shadcn add @icons0/lucide
            </span>
          </div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
