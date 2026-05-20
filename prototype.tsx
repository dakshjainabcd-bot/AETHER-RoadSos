```jsx
import { useState, useEffect, useRef } from "react";

/* ─── DESIGN TOKENS ──────────────────────────────────────────── */
const T = {
  bg:          "#F7F5F0",
  surface:     "#FFFFFF",
  surfaceRaised:"#FDFCF9",
  border:      "#E5E2D9",
  borderFaint: "#EDEAE3",

  ink:         "#141210",
  inkSec:      "#706D65",
  inkMute:     "#ADAAA2",
  inkFaint:    "#D0CEC7",

  red:         "#EF3E28",
  redDeep:     "#C82F1C",
  redSoft:     "#FEF1EE",
  redBorder:   "#F4C5BE",

  green:       "#0E8C56",
  greenSoft:   "#E8F6EF",
  greenBorder: "#96D4B4",

  blue:        "#1648D0",
  blueSoft:    "#EBF0FC",
  blueBorder:  "#A8BEE8",

  amber:       "#C05C0A",
  amberSoft:   "#FEF4E6",
  amberBorder: "#E8C088",
};

/* ─── CSS ────────────────────────────────────────────────────── */
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&family=Big+Shoulders+Display:wght@400;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: #ECEAE4;
    font-family: 'Bricolage Grotesque', sans-serif;
    -webkit-font-smoothing: antialiased;
  }

  .phone {
    width: 375px;
    height: 812px;
    background: #F7F5F0;
    border-radius: 52px;
    border: 1.5px solid #D4D1C8;
    overflow: hidden;
    position: relative;
    box-shadow:
      inset 0 1px 0 rgba(255,255,255,0.8),
      0 2px 0 #B8B5AE,
      0 28px 72px rgba(20,18,16,0.18),
      0 8px 24px rgba(20,18,16,0.08);
  }

  .notch {
    position: absolute;
    top: 13px; left: 50%;
    transform: translateX(-50%);
    width: 112px; height: 32px;
    background: #0A0908;
    border-radius: 18px;
    z-index: 100;
  }

  .scr {
    position:
<truncated 23436 bytes>
nkSec, marginTop: 4,
            letterSpacing: "-.01em" }}>Hold for 3 seconds to activate</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6,
          background: T.greenSoft, border: `1px solid ${T.greenBorder}`,
          borderRadius: 8, padding: "5px 10px" }}>
          <span className="blink" style={{ width: 6, height: 6, borderRadius: "50%",
            background: T.green, display: "block" }} />
          <span style={{ fontSize: 10, fontWeight: 700, color: T.green,
            letterSpacing: ".06em" }}>MONITORING</span>
        </div>
      </div>

      {/* Central hold button */}
      <div style={{ flex: 1, display: "flex", alignItems: "center",
        justifyContent: "center", flexDirection: "column" }}>

        <div style={{ position: "relative", marginBottom: 32 }}
          onMouseDown={startHold} onMouseUp={endHold} onMouseLeave={endHold}
          onTouchStart={startHold} onTouchEnd={endHold}>

          {/* SVG ring */}
          <svg width={R*2+24} height={R*2+24}
            viewBox={`0 0 ${R*2+24} ${R*2+24}`}
            style={{ position: "absolute", inset: 0,
              transform: "rotate(-90deg)" }}>
            <circle cx={R+12} cy={R+12} r={R}
              fill="none" stroke={T.borderFaint} strokeWidth="2" />
            {held > 0 && (
              <circle cx={R+12} cy={R+12} r={R}
                fill="none" stroke={T.red} strokeWidth="3"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - held / 100)}
                style={{ transition: "stroke-dashoffset .06s linear" }} />
            )}
          </svg>

          {/* Button face */}
          <div style={{
            width: R*2, height: R*2, borderRadius: "50%",
            marginTop: 12, marginLeft: 12,
            background: held > 0 ? T.red : T.surface,
            border: held > 0 ? `2px solid ${T.red}` : `1.5px solid ${T.border}`,
            display: "flex", flexDirection: "column",
            alignItems: "center