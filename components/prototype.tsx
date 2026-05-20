import { useState, useEffect, useRef } from "react";

/* ─── DESIGN TOKENS ──────────────────────────────────────────── */
const T = {
    bg: "#F7F5F0",
    surface: "#FFFFFF",
    surfaceRaised: "#FDFCF9",
    border: "#E5E2D9",
    borderFaint: "#EDEAE3",

    ink: "#141210",
    inkSec: "#706D65",
    inkMute: "#ADAAA2",
    inkFaint: "#D0CEC7",

    red: "#EF3E28",
    redDeep: "#C82F1C",
    redSoft: "#FEF1EE",
    redBorder: "#F4C5BE",

    green: "#0E8C56",
    greenSoft: "#E8F6EF",
    greenBorder: "#96D4B4",

    blue: "#1648D0",
    blueSoft: "#EBF0FC",
    blueBorder: "#A8BEE8",

    amber: "#C05C0A",
    amberSoft: "#FEF4E6",
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
    position: absolute; inset: 0;
    display: flex; flex-direction: column;
    background: #F7F5F0;
    transition: opacity .22s ease, transform .22s ease;
  }
  .scr.off { opacity: 0; pointer-events: none; transform: translateY(10px); }

  .sb { padding: 56px 22px 0; display: flex; justify-content: space-between; align-items: center; }

  .body { flex: 1; overflow-y: auto; scrollbar-width: none; padding-bottom: 90px; }
  .body::-webkit-scrollbar { display: none; }

  /* ── NAV ── */
  .nav {
    position: absolute; bottom: 0; left: 0; right: 0;
    height: 82px;
    background: #FFFFFF;
    border-top: 1px solid #E5E2D9;
    display: flex; align-items: center; justify-content: space-around;
    padding-bottom: 14px;
    z-index: 50;
  }
  .ni { display: flex; flex-direction: column; align-items: center; gap: 5px; cursor: pointer; }
  .ni-lbl {
    font-size: 9px; font-weight: 700;
    letter-spacing: .1em; text-transform: uppercase;
    color: #D0CEC7; transition: color .15s;
  }
  .ni.on .ni-lbl { color: #EF3E28; }
  .ni-icon { opacity: .3; transition: opacity .15s; }
  .ni.on .ni-icon { opacity: 1; }

  .sosbtn {
    width: 60px; height: 60px; border-radius: 50%;
    background: #EF3E28;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer;
    margin-top: -22px;
    box-shadow:
      0 0 0 5px #F7F5F0,
      0 0 0 6.5px #E5E2D9,
      0 6px 18px rgba(239,62,40,0.40);
    transition: transform .1s, box-shadow .1s;
    position: relative;
  }
  .sosbtn::before {
    content: '';
    position: absolute; inset: -10px;
    border-radius: 50%;
    border: 1.5px solid rgba(239,62,40,0.22);
    animation: sosRing 2.4s ease-out infinite;
  }
  .sosbtn:active { transform: scale(.91); }
  .sosbtn-lbl {
    font-size: 10px; font-weight: 800;
    color: #fff; letter-spacing: .14em;
  }

  /* ── ATOMS ── */
  .tag {
    display: inline-flex; align-items: center; gap: 4px;
    padding: 3px 9px; border-radius: 6px;
    font-size: 10px; font-weight: 600; letter-spacing: .04em;
  }
  .tg { background: #E8F6EF; color: #0E8C56; border: 1px solid #96D4B4; }
  .tr { background: #FEF1EE; color: #EF3E28; border: 1px solid #F4C5BE; }
  .tm { background: #EDEAE3; color: #706D65; border: 1px solid #E5E2D9; }
  .tb { background: #EBF0FC; color: #1648D0; border: 1px solid #A8BEE8; }

  .lbl {
    font-size: 10px; font-weight: 700;
    letter-spacing: .14em; text-transform: uppercase;
    color: #ADAAA2;
  }

  @keyframes blink { 0%,100%{opacity:1} 50%{opacity:.18} }
  @keyframes slideUp { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
  @keyframes sosRing { 0%{transform:scale(1);opacity:.7} 70%,100%{transform:scale(1.55);opacity:0} }
  @keyframes pulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }

  .blink { animation: blink 1.8s ease-in-out infinite; }
  .swIn { animation: slideUp .3s ease forwards; }

  button { cursor: pointer; font-family: 'Bricolage Grotesque', sans-serif; border: none; background: none; }
  input { font-family: 'Bricolage Grotesque', sans-serif; }
`;

/* ─── ICONS ───────────────────────────────────────────────────── */
const I = {
    home: "M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z M9 22V12h6v10",
    grid: "M3 3h7v7H3z M14 3h7v7h-7z M14 14h7v7h-7z M3 14h7v7H3z",
    map: "M1 6l7-4 8 4 7-4v16l-7 4-8-4-7 4V6z M8 2v16 M16 6v16",
    shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
    phone: "M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z",
    arrow: "M5 12h14 M12 5l7 7-7 7",
    chevron: "M9 18l6-6-6-6",
    settings: "M12 15a3 3 0 100-6 3 3 0 000 6z M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06-.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z",
    bell: "M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9 M13.73 21a2 2 0 01-3.46 0",
    star: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z",
    wifi: "M5 12.55a11 11 0 0114.08 0 M1.42 9a16 16 0 0121.16 0 M8.53 16.11a6 6 0 016.95 0 M12 20h.01",
    x: "M18 6L6 18 M6 6l12 12",
    check: "M20 6L9 17l-5-5",
    brain: "M9.5 2A2.5 2.5 0 017 4.5v0A2.5 2.5 0 014.5 7H4a2 2 0 00-2 2v0a2 2 0 002 2h.5A2.5 2.5 0 017 13.5v0A2.5 2.5 0 019.5 16H10v4h4v-4h.5A2.5 2.5 0 0117 13.5v0A2.5 2.5 0 0119.5 11H20a2 2 0 002-2v0a2 2 0 00-2-2h-.5A2.5 2.5 0 0117 4.5v0A2.5 2.5 0 0114.5 2H9.5z",
    heart: "M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z",
    fire: "M8.5 14.5A2.5 2.5 0 0011 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 01-7 7 7 7 0 01-7-7c0-1.507.333-2.078 1.5-3.5a2.5 2.5 0 001 2.5",
    spine: "M12 2v20 M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6",
    child: "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2 M12 11a4 4 0 100-8 4 4 0 000 8z",
    band: "M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8",
};

function Ic({ d, s = 20, c = "#706D65", w = 1.65 }: { d: string; s?: number; c?: string; w?: number }) {
    return (
        <svg width={s} height={s} viewBox="0 0 24 24" fill="none"
            stroke={c} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round">
            {d.split(" M").map((seg, i) => (
                <path key={i} d={i === 0 ? seg : "M" + seg} />
            ))}
        </svg>
    );
}

/* ─── STATUS BAR ──────────────────────────────────────────────── */
function SBar({ time = "10:22", light = false }) {
    const ink = light ? "rgba(247,245,240,.8)" : T.ink;
    const inkSec = light ? "rgba(247,245,240,.5)" : T.inkSec;
    return (
        <div className="sb">
            <span style={{ fontSize: 15, fontWeight: 600, color: ink, letterSpacing: "-.01em" }}>{time}</span>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <svg width="17" height="12" viewBox="0 0 17 12" fill={ink}>
                    <rect x=".5" y="5" width="3" height="7" rx="1" />
                    <rect x="5" y="3" width="3" height="9" rx="1" />
                    <rect x="9.5" y="1" width="3" height="11" rx="1" />
                    <rect x="14" y="0" width="2.5" height="12" rx="1" opacity=".2" />
                </svg>
                <svg width="15" height="12" viewBox="0 0 15 12" fill="none"
                    stroke={inkSec} strokeWidth="1.5" strokeLinecap="round">
                    <path d="M1 4.5a9 9 0 0113 0 M3.5 7a6 6 0 018 0 M6 9.5a3 3 0 013 0 M7.5 11.5h.01" />
                </svg>
                <div style={{
                    width: 25, height: 13, border: `1.5px solid ${inkSec}`, borderRadius: 3,
                    display: "flex", alignItems: "center", padding: "1.5px 2px"
                }}>
                    <div style={{
                        width: "68%", height: "100%", borderRadius: 1.5,
                        background: light ? "rgba(247,245,240,0.7)" : T.green
                    }} />
                </div>
            </div>
        </div>
    );
}

/* ─── NAV ─────────────────────────────────────────────────────── */
function Nav({ sc, set }: { sc: string; set: (s: string) => void }) {
    const items = [
        { id: "home", l: "Home", d: I.home },
        { id: "services", l: "Services", d: I.grid },
        null,
        { id: "map", l: "Map", d: I.map },
        { id: "rakshak", l: "Rakshak", d: I.shield },
    ];
    return (
        <div className="nav">
            {items.map((x, i) =>
                x === null ? (
                    <div key="sos" className="sosbtn" onClick={() => set("sos")}>
                        <span className="sosbtn-lbl">SOS</span>
                    </div>
                ) : (
                    <div key={x.id} className={`ni ${sc === x.id ? "on" : ""}`}
                        onClick={() => set(x.id)}>
                        <span className="ni-icon">
                            <Ic d={x.d} c={sc === x.id ? T.red : T.inkMute} s={22} />
                        </span>
                        <span className="ni-lbl">{x.l}</span>
                    </div>
                )
            )}
        </div>
    );
}

/* ─── HOME ────────────────────────────────────────────────────── */
function Home() {
    return (
        <div className="scr swIn">
            <SBar />

            {/* ── Header ── */}
            <div style={{
                padding: "16px 22px 0", display: "flex",
                justifyContent: "space-between", alignItems: "center"
            }}>
                <div>
                    <div style={{
                        fontSize: 30, fontWeight: 800, color: T.ink,
                        letterSpacing: "-.04em", lineHeight: 1
                    }}>AETHER</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                        <span className="blink" style={{
                            width: 7, height: 7, borderRadius: "50%",
                            background: T.green, display: "block", flexShrink: 0
                        }} />
                        <span style={{
                            fontSize: 12, fontWeight: 500, color: T.inkSec,
                            letterSpacing: "-.01em"
                        }}>
                            India &nbsp;·&nbsp; Detection active &nbsp;·&nbsp; ±11m
                        </span>
                    </div>
                </div>
                <button style={{
                    width: 40, height: 40, borderRadius: 13,
                    background: T.surface, border: `1px solid ${T.border}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    boxShadow: "0 1px 3px rgba(20,18,16,0.06)"
                }}>
                    <Ic d={I.settings} c={T.inkSec} s={18} />
                </button>
            </div>

            <div className="body" style={{ padding: "18px 22px 0" }}>

                {/* ── 108 Hero Card ── */}
                <div style={{
                    background: T.red, borderRadius: 26, padding: "0 0 0 24px",
                    marginBottom: 10, position: "relative", overflow: "hidden",
                    display: "flex", alignItems: "stretch", cursor: "pointer",
                    boxShadow: "0 4px 0 #C82F1C, 0 8px 28px rgba(239,62,40,0.22)"
                }}>

                    {/* Decorative rings — right side */}
                    <div style={{
                        position: "absolute", right: -48, top: "50%",
                        transform: "translateY(-50%)", width: 220, height: 220,
                        borderRadius: "50%", border: "1px solid rgba(255,255,255,0.08)",
                        pointerEvents: "none"
                    }} />
                    <div style={{
                        position: "absolute", right: 0, top: "50%",
                        transform: "translateY(-50%)", width: 140, height: 140,
                        borderRadius: "50%", border: "1px solid rgba(255,255,255,0.06)",
                        pointerEvents: "none"
                    }} />

                    {/* Left: text */}
                    <div style={{ flex: 1, paddingTop: 22, paddingBottom: 22 }}>
                        <div style={{
                            fontSize: 10, fontWeight: 700,
                            color: "rgba(255,255,255,0.45)", letterSpacing: ".18em",
                            textTransform: "uppercase", marginBottom: 2
                        }}>Ambulance</div>
                        <div style={{
                            fontFamily: "'Big Shoulders Display', sans-serif",
                            fontSize: 78, fontWeight: 800, color: "#fff",
                            lineHeight: 0.9, letterSpacing: ".04em", marginBottom: 18
                        }}>
                            108
                        </div>
                        <button style={{
                            display: "inline-flex", alignItems: "center", gap: 7,
                            background: "rgba(255,255,255,0.16)",
                            border: "1px solid rgba(255,255,255,0.24)",
                            borderRadius: 10, padding: "8px 16px",
                            color: "#fff", fontSize: 13, fontWeight: 600,
                            letterSpacing: "-.01em"
                        }}>
                            <Ic d={I.phone} s={14} c="#fff" w={2.2} /> Call Now
                        </button>
                    </div>

                    {/* Right: mesh offline badge */}
                    <div style={{
                        display: "flex", flexDirection: "column",
                        justifyContent: "flex-end", padding: "0 16px 16px 0"
                    }}>
                        <div style={{
                            background: "rgba(0,0,0,0.18)",
                            borderRadius: 8, padding: "4px 8px",
                            fontSize: 9, fontWeight: 700,
                            color: "rgba(255,255,255,0.6)", letterSpacing: ".1em"
                        }}>
                            MESH&nbsp;OFFLINE
                        </div>
                    </div>
                </div>

                {/* ── Secondary Numbers ── */}
                <div style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                    gap: 8, marginBottom: 26
                }}>
                    {[
                        { n: "100", l: "Police", c: T.blue, bg: T.blueSoft, bo: T.blueBorder },
                        { n: "101", l: "Fire", c: T.amber, bg: T.amberSoft, bo: T.amberBorder },
                        { n: "112", l: "Universal", c: T.inkSec, bg: T.surface, bo: T.border },
                    ].map(e => (
                        <div key={e.n} style={{
                            background: e.bg, border: `1px solid ${e.bo}`,
                            borderRadius: 20, padding: "14px 14px 13px", cursor: "pointer"
                        }}>
                            <div style={{
                                fontFamily: "'Big Shoulders Display', sans-serif",
                                fontSize: 42, fontWeight: 900, color: e.c,
                                lineHeight: 1, marginBottom: 5, letterSpacing: "-.01em"
                            }}>
                                {e.n}
                            </div>
                            <div style={{ fontSize: 11, color: T.inkSec, fontWeight: 500 }}>{e.l}</div>
                        </div>
                    ))}
                </div>

                {/* ── Nearest header ── */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <span className="lbl">Nearest to you</span>
                    <div style={{ flex: 1, height: 1, background: T.border }} />
                </div>

                {/* ── Service rows ── */}
                {[
                    {
                        name: "BGS Gleneagles Global Hospital",
                        dist: "2.5 km", ph: "080-26730000",
                        caps: ["Neurosurgery", "Cath Lab", "CT"],
                        dot: T.red, dotBg: T.redSoft, dotBo: T.redBorder
                    },
                    {
                        name: "Banashankari Police Station",
                        dist: "4.9 km", ph: "080-26721234",
                        caps: ["Police", "24/7"],
                        dot: T.blue, dotBg: T.blueSoft, dotBo: T.blueBorder
                    },
                ].map((s, i, arr) => (
                    <div key={i}>
                        <div style={{
                            display: "flex", gap: 14, alignItems: "flex-start",
                            padding: "14px 0"
                        }}>
                            {/* Left accent */}
                            <div style={{
                                width: 42, height: 42, borderRadius: 14,
                                background: s.dotBg, border: `1px solid ${s.dotBo}`,
                                flexShrink: 0, display: "flex", alignItems: "center",
                                justifyContent: "center"
                            }}>
                                <div style={{
                                    width: 10, height: 10, borderRadius: "50%",
                                    background: s.dot
                                }} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{
                                    display: "flex", justifyContent: "space-between",
                                    alignItems: "flex-start", marginBottom: 4
                                }}>
                                    <div style={{
                                        fontSize: 14, fontWeight: 700, color: T.ink,
                                        lineHeight: 1.3, paddingRight: 8, letterSpacing: "-.01em"
                                    }}>
                                        {s.name}
                                    </div>
                                    <span style={{
                                        fontFamily: "'Big Shoulders Display', sans-serif",
                                        fontSize: 17, fontWeight: 900, color: T.inkSec,
                                        flexShrink: 0, letterSpacing: "-.01em", lineHeight: 1.2
                                    }}>{s.dist}</span>
                                </div>
                                <div style={{
                                    display: "flex", gap: 5, flexWrap: "wrap",
                                    marginBottom: 11
                                }}>
                                    {s.caps.map(c => (
                                        <span key={c} className="tag tm" style={{ fontSize: 9 }}>{c}</span>
                                    ))}
                                </div>
                                <div style={{ display: "flex", gap: 8 }}>
                                    <button style={{
                                        flex: 1, padding: "9px 0",
                                        background: T.greenSoft, border: `1px solid ${T.greenBorder}`,
                                        borderRadius: 10, fontSize: 12, fontWeight: 600, color: T.green,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        gap: 5
                                    }}>
                                        <Ic d={I.phone} s={13} c={T.green} w={2} /> Call
                                    </button>
                                    <button style={{
                                        flex: 1, padding: "9px 0",
                                        background: T.blueSoft, border: `1px solid ${T.blueBorder}`,
                                        borderRadius: 10, fontSize: 12, fontWeight: 600, color: T.blue,
                                        display: "flex", alignItems: "center", justifyContent: "center",
                                        gap: 5
                                    }}>
                                        <Ic d={I.arrow} s={13} c={T.blue} w={2} /> Navigate
                                    </button>
                                </div>
                            </div>
                        </div>
                        {i < arr.length - 1 && (
                            <div style={{ height: 1, background: T.borderFaint }} />
                        )}
                    </div>
                ))}

                {/* ── Offline footer ── */}
                <div style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 7, padding: "16px 0 6px"
                }}>
                    <div style={{ width: 6, height: 6, borderRadius: "50%", background: T.green }} />
                    <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9, color: T.inkMute, letterSpacing: ".1em",
                        textTransform: "uppercase"
                    }}>
                        Works fully offline · No internet required
                    </span>
                </div>
            </div>
        </div>
    );
}

/* ─── SOS ─────────────────────────────────────────────────────── */
function SOS({ set }: { set: (s: string) => void }) {
    const [held, setHeld] = useState(0);
    const [active, setActive] = useState(false);
    const timer = useRef<ReturnType<typeof setInterval> | null>(null);

    const startHold = () => {
        timer.current = setInterval(() => {
            setHeld(h => {
                if (h >= 100) {
                    clearInterval(timer.current!);
                    setActive(true);
                    return 100;
                }
                return h + 2.8;
            });
        }, 50);
    };
    const endHold = () => {
        clearInterval(timer.current!);
        if (!active) setHeld(0);
    };

    const R = 92, C = 2 * Math.PI * R;

    const injuryTypes = [
        { l: "Head / Brain", sub: "Head injury, unconscious", ic: I.brain, c: T.red, bg: T.redSoft, bo: T.redBorder },
        { l: "Heart / Cardiac", sub: "Chest pain, cardiac arrest", ic: I.heart, c: "#C0124A", bg: "#FEE8F0", bo: "#F4B0CC" },
        { l: "Burns", sub: "Fire, chemical, electrical", ic: I.fire, c: T.amber, bg: T.amberSoft, bo: T.amberBorder },
        { l: "Spine / Neck", sub: "Back/neck pain, paralysis", ic: I.spine, c: "#6B35CC", bg: "#F4EFFE", bo: "#C8A8EE" },
        { l: "Child < 12", sub: "Paediatric emergency", ic: I.child, c: T.blue, bg: T.blueSoft, bo: T.blueBorder },
        { l: "General", sub: "Bleeding, fracture, other", ic: I.band, c: T.green, bg: T.greenSoft, bo: T.greenBorder },
    ];

    if (active) {
        return (
            <div className="scr swIn">
                <SBar />
                <div style={{ padding: "14px 22px 0" }}>
                    <div style={{
                        display: "flex", alignItems: "center", gap: 10,
                        marginBottom: 6
                    }}>
                        <div style={{
                            display: "flex", alignItems: "center", gap: 7,
                            background: T.redSoft, border: `1px solid ${T.redBorder}`,
                            borderRadius: 8, padding: "5px 12px"
                        }}>
                            <span className="blink" style={{
                                width: 7, height: 7,
                                borderRadius: "50%", background: T.red, display: "block"
                            }} />
                            <span style={{
                                fontSize: 11, fontWeight: 700, color: T.red,
                                letterSpacing: ".1em"
                            }}>SOS ACTIVE — HELP ALERTED</span>
                        </div>
                    </div>

                    {/* Mini sensor row */}
                    <div style={{
                        display: "flex", gap: 10, alignItems: "center",
                        padding: "10px 0", borderBottom: `1px solid ${T.borderFaint}`,
                        marginBottom: 14
                    }}>
                        {[{ l: "Accel", v: 46, c: T.red }, { l: "Gyro", v: 1, c: T.blue },
                        { l: "Audio", v: 59, c: T.amber }].map(m => (
                            <div key={m.l} style={{
                                display: "flex", alignItems: "center",
                                gap: 6, flex: 1
                            }}>
                                <span style={{
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: 9, color: T.inkMute, letterSpacing: ".06em"
                                }}>{m.l}</span>
                                <div style={{
                                    flex: 1, height: 2, background: T.border,
                                    borderRadius: 2, overflow: "hidden"
                                }}>
                                    <div style={{
                                        width: `${m.v}%`, height: "100%",
                                        background: m.c, borderRadius: 2
                                    }} />
                                </div>
                                <span style={{
                                    fontFamily: "'JetBrains Mono', monospace",
                                    fontSize: 9, color: T.inkSec
                                }}>{m.v}%</span>
                            </div>
                        ))}
                        <span style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10, fontWeight: 600, color: T.inkSec, flexShrink: 0
                        }}>
                            1.8g
                        </span>
                    </div>

                    <div style={{
                        fontSize: 20, fontWeight: 800, color: T.ink,
                        letterSpacing: "-.03em", marginBottom: 4
                    }}>What type of injury?</div>
                    <div style={{
                        fontSize: 12, color: T.inkSec, marginBottom: 16,
                        letterSpacing: "-.01em"
                    }}>
                        This helps us find the right hospital — tap the best match
                    </div>
                </div>

                <div className="body" style={{ padding: "0 22px" }}>
                    <div style={{
                        display: "grid", gridTemplateColumns: "1fr 1fr",
                        gap: 9, marginBottom: 14
                    }}>
                        {injuryTypes.map((x, i) => (
                            <button key={i} onClick={() => set("crash")} style={{
                                background: x.bg, border: `1px solid ${x.bo}`,
                                borderRadius: 18, padding: "14px 14px 13px",
                                textAlign: "left", cursor: "pointer",
                                transition: "transform .1s",
                            }}>
                                <div style={{
                                    width: 34, height: 34, borderRadius: 10,
                                    background: "rgba(255,255,255,0.6)",
                                    border: `1px solid ${x.bo}`,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    marginBottom: 10
                                }}>
                                    <Ic d={x.ic} s={16} c={x.c} w={1.8} />
                                </div>
                                <div style={{
                                    fontSize: 13, fontWeight: 700, color: T.ink,
                                    letterSpacing: "-.02em", lineHeight: 1.25, marginBottom: 3
                                }}>
                                    {x.l}
                                </div>
                                <div style={{ fontSize: 10, color: T.inkSec, lineHeight: 1.4 }}>
                                    {x.sub}
                                </div>
                            </button>
                        ))}
                    </div>

                    <button style={{
                        width: "100%", padding: "12px",
                        background: T.surface, border: `1px solid ${T.border}`,
                        borderRadius: 12, fontSize: 12, fontWeight: 600, color: T.inkSec
                    }}>
                        Injury type unclear
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="scr swIn">
            <SBar />

            {/* Header */}
            <div style={{
                padding: "14px 22px 0", display: "flex",
                justifyContent: "space-between", alignItems: "flex-end"
            }}>
                <div>
                    <div style={{
                        fontSize: 24, fontWeight: 800, color: T.ink,
                        letterSpacing: "-.03em"
                    }}>Emergency SOS</div>
                    <div style={{
                        fontSize: 12, color: T.inkSec, marginTop: 4,
                        letterSpacing: "-.01em"
                    }}>Hold for 3 seconds to activate</div>
                </div>
                <div style={{
                    display: "flex", alignItems: "center", gap: 6,
                    background: T.greenSoft, border: `1px solid ${T.greenBorder}`,
                    borderRadius: 8, padding: "5px 10px"
                }}>
                    <span className="blink" style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: T.green, display: "block"
                    }} />
                    <span style={{
                        fontSize: 10, fontWeight: 700, color: T.green,
                        letterSpacing: ".06em"
                    }}>MONITORING</span>
                </div>
            </div>

            {/* Central hold button */}
            <div style={{
                flex: 1, display: "flex", alignItems: "center",
                justifyContent: "center", flexDirection: "column"
            }}>

                <div style={{ position: "relative", marginBottom: 32 }}
                    onMouseDown={startHold} onMouseUp={endHold} onMouseLeave={endHold}
                    onTouchStart={startHold} onTouchEnd={endHold}>

                    {/* SVG ring */}
                    <svg width={R * 2 + 24} height={R * 2 + 24}
                        viewBox={`0 0 ${R * 2 + 24} ${R * 2 + 24}`}
                        style={{
                            position: "absolute", inset: 0,
                            transform: "rotate(-90deg)"
                        }}>
                        <circle cx={R + 12} cy={R + 12} r={R}
                            fill="none" stroke={T.borderFaint} strokeWidth="2" />
                        {held > 0 && (
                            <circle cx={R + 12} cy={R + 12} r={R}
                                fill="none" stroke={T.red} strokeWidth="3"
                                strokeLinecap="round"
                                strokeDasharray={C}
                                strokeDashoffset={C * (1 - held / 100)}
                                style={{ transition: "stroke-dashoffset .06s linear" }} />
                        )}
                    </svg>

                    {/* Button face */}
                    <div style={{
                        width: R * 2, height: R * 2, borderRadius: "50%",
                        marginTop: 12, marginLeft: 12,
                        background: held > 0 ? T.red : T.surface,
                        border: held > 0 ? `2px solid ${T.red}` : `1.5px solid ${T.border}`,
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center",
                        cursor: "pointer", userSelect: "none",
                        transition: "background .28s ease, border-color .28s ease",
                        boxShadow: held > 0
                            ? `0 8px 0 ${T.redDeep}, 0 14px 40px rgba(239,62,40,0.28)`
                            : "0 6px 0 #CCC9C1, 0 10px 24px rgba(20,18,16,0.08)",
                    }}>
                        <span style={{
                            fontSize: 26, fontWeight: 800,
                            color: held > 0 ? "#fff" : T.red,
                            letterSpacing: ".12em", lineHeight: 1
                        }}>
                            SOS
                        </span>
                        <span style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 9.5,
                            color: held > 0 ? "rgba(255,255,255,0.52)" : T.inkMute,
                            marginTop: 9, letterSpacing: ".1em"
                        }}>
                            {held === 0 ? "HOLD TO SEND"
                                : held >= 100 ? "SENDING…"
                                    : `${Math.round(held)}%`}
                        </span>
                    </div>
                </div>

                {/* Sensor bars */}
                <div style={{ width: "100%", padding: "0 30px" }}>
                    {[
                        { l: "Accel", v: 47, c: T.red },
                        { l: "Gyro", v: 5, c: T.blue },
                        { l: "Audio", v: 67, c: T.amber },
                    ].map(m => (
                        <div key={m.l} style={{
                            display: "flex", alignItems: "center",
                            gap: 10, marginBottom: 10
                        }}>
                            <span style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                width: 38, fontSize: 10, color: T.inkMute,
                                letterSpacing: ".06em"
                            }}>{m.l}</span>
                            <div style={{
                                flex: 1, height: 2.5, background: T.borderFaint,
                                borderRadius: 2, overflow: "hidden"
                            }}>
                                <div style={{
                                    width: `${m.v}%`, height: "100%",
                                    background: m.c, borderRadius: 2
                                }} />
                            </div>
                            <span style={{
                                fontFamily: "'JetBrains Mono', monospace",
                                width: 30, fontSize: 10, color: T.inkSec,
                                textAlign: "right"
                            }}>{m.v}%</span>
                        </div>
                    ))}
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        textAlign: "center", fontSize: 10, color: T.inkMute,
                        marginTop: 2, letterSpacing: ".08em"
                    }}>
                        1.9g peak g-force
                    </div>
                </div>
            </div>

            {/* Quick-dial */}
            <div style={{ padding: "0 22px 14px" }}>
                <span className="lbl" style={{ display: "block", marginBottom: 12 }}>
                    Quick dial
                </span>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 9 }}>
                    {[
                        { n: "108", l: "Ambulance", c: T.red, bg: T.redSoft, bo: T.redBorder },
                        { n: "100", l: "Police", c: T.blue, bg: T.blueSoft, bo: T.blueBorder },
                        { n: "101", l: "Fire", c: T.amber, bg: T.amberSoft, bo: T.amberBorder },
                    ].map(e => (
                        <div key={e.n} style={{
                            background: e.bg, border: `1px solid ${e.bo}`,
                            borderRadius: 18, padding: "13px 14px 11px", cursor: "pointer"
                        }}>
                            <div style={{
                                fontFamily: "'Big Shoulders Display', sans-serif",
                                fontSize: 38, fontWeight: 900, color: e.c,
                                lineHeight: 1, marginBottom: 4, letterSpacing: "-.01em"
                            }}>{e.n}</div>
                            <div style={{ fontSize: 10, color: T.inkSec, fontWeight: 500 }}>
                                {e.l}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/* ─── CRASH ────────────────────────────────────────────────────── */
function Crash({ set }: { set: (s: string) => void }) {
    const [n, setN] = useState(5);
    useEffect(() => {
        if (n <= 0) return;
        const t = setTimeout(() => setN(x => x - 1), 1000);
        return () => clearTimeout(t);
    }, [n]);

    const R = 64, C = 2 * Math.PI * R;

    return (
        <div className="scr" style={{ background: "#0C0A07" }}>
            <SBar time="10:18" light />

            <div style={{
                flex: 1, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "space-between",
                padding: "24px 26px 38px"
            }}>

                {/* Top section */}
                <div style={{ width: "100%", textAlign: "center" }}>
                    <div style={{
                        display: "inline-flex", alignItems: "center", gap: 8,
                        background: "rgba(239,62,40,0.12)",
                        border: "1px solid rgba(239,62,40,0.26)",
                        borderRadius: 8, padding: "6px 14px", marginBottom: 28
                    }}>
                        <span className="blink" style={{
                            width: 7, height: 7,
                            borderRadius: "50%", background: T.red, display: "block"
                        }} />
                        <span style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 10, fontWeight: 600, color: T.red,
                            letterSpacing: ".12em"
                        }}>SOS ACTIVE</span>
                    </div>

                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9, fontWeight: 600,
                        color: "rgba(247,245,240,0.22)", letterSpacing: ".22em",
                        textTransform: "uppercase", marginBottom: 12
                    }}>
                        CRASH DETECTED
                    </div>
                    <div style={{
                        fontSize: 36, fontWeight: 800, color: "#F7F5F0",
                        letterSpacing: "-.04em", lineHeight: 1.15
                    }}>
                        AETHER will send<br />
                        <span style={{ fontWeight: 300, fontSize: 32 }}>
                            SOS automatically
                        </span>
                    </div>
                </div>

                {/* Countdown ring */}
                <div style={{
                    position: "relative",
                    width: R * 2 + 28, height: R * 2 + 28
                }}>
                    <svg width={R * 2 + 28} height={R * 2 + 28}
                        viewBox={`0 0 ${R * 2 + 28} ${R * 2 + 28}`}
                        style={{
                            position: "absolute", inset: 0,
                            transform: "rotate(-90deg)"
                        }}>
                        <circle cx={R + 14} cy={R + 14} r={R}
                            fill="none" stroke="rgba(239,62,40,0.10)" strokeWidth="3" />
                        <circle cx={R + 14} cy={R + 14} r={R}
                            fill="none" stroke={T.red} strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={C}
                            strokeDashoffset={C * n / 5}
                            style={{ transition: "stroke-dashoffset 0.92s linear" }} />
                    </svg>
                    <div style={{
                        position: "absolute", inset: 0,
                        display: "flex", flexDirection: "column",
                        alignItems: "center", justifyContent: "center"
                    }}>
                        <div style={{
                            fontFamily: "'Big Shoulders Display', sans-serif",
                            fontSize: 110, fontWeight: 900, color: "#F7F5F0",
                            lineHeight: 1, letterSpacing: "-.01em"
                        }}>{n}</div>
                        <div style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 9, color: "rgba(247,245,240,0.26)",
                            letterSpacing: ".2em", marginTop: 6
                        }}>SEC</div>
                    </div>
                </div>

                {/* Bottom */}
                <div style={{ width: "100%" }}>
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        textAlign: "center", fontSize: 10,
                        color: "rgba(247,245,240,0.22)",
                        letterSpacing: ".08em", marginBottom: 4
                    }}>
                        SOS dispatching in {n}s · Confidence: 36%
                    </div>
                    <div style={{
                        height: 1, background: "rgba(255,255,255,0.06)",
                        marginBottom: 22
                    }} />

                    <button onClick={() => set("home")} style={{
                        width: "100%", padding: "18px",
                        background: "transparent",
                        border: `1.5px solid ${T.green}`,
                        borderRadius: 14,
                        fontSize: 14, fontWeight: 700,
                        color: T.green,
                        letterSpacing: ".05em",
                        display: "flex", alignItems: "center",
                        justifyContent: "center", gap: 10,
                        marginBottom: 16,
                    }}>
                        <Ic d={I.x} s={16} c={T.green} w={2.5} />
                        I'M OK — CANCEL SOS
                    </button>

                    <div style={{
                        fontSize: 12, color: "rgba(247,245,240,0.20)",
                        textAlign: "center", lineHeight: 1.75, letterSpacing: "-.01em"
                    }}>
                        If you are injured and cannot cancel,<br />help is already on the way.
                    </div>
                </div>
            </div>
        </div>
    );
}

/* ─── SERVICES ────────────────────────────────────────────────── */
function Services() {
    const [tab, setTab] = useState(0);
    const tabs = ["Hospital", "Police", "Towing", "Tyre", "Petrol", "Blood Bank"];

    const cards = [
        {
            name: "BGS Gleneagles Global Hospital Kengeri",
            dist: "2.5 km", tags: ["Neurosurgery", "Cath Lab", "CT Scan", "+4"],
            ph: "080-26730000", open: "24/7", rank: 0
        },
        {
            name: "Rajarajeshwari Medical College Hospital",
            dist: "3.0 km", tags: ["Emergency", "CT Scan", "Blood Bank", "+2"],
            ph: "080-28610408", open: "24/7", rank: 1
        },
        {
            name: "Rajiv Gandhi Government General Hospital",
            dist: "8.8 km", tags: ["General", "ICU"],
            ph: "080-26703272", open: "24/7", rank: 2
        },
    ];

    const rankColors = [T.red, T.amber, T.inkMute];
    const rankBgs = [T.redSoft, T.amberSoft, T.surface];
    const rankBos = [T.redBorder, T.amberBorder, T.border];

    return (
        <div className="scr swIn">
            <SBar />

            {/* Header */}
            <div style={{ padding: "14px 22px 0" }}>
                <div style={{
                    display: "flex", justifyContent: "space-between",
                    alignItems: "flex-end", marginBottom: 18
                }}>
                    <div style={{
                        fontSize: 26, fontWeight: 800, color: T.ink,
                        letterSpacing: "-.04em"
                    }}>Find Services</div>
                    <span className="tag tm" style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 9, letterSpacing: ".08em"
                    }}>OFFLINE</span>
                </div>

                {/* Tab strip — underline style, not pills */}
                <div style={{
                    display: "flex", borderBottom: `1.5px solid ${T.border}`,
                    overflowX: "auto", scrollbarWidth: "none", marginBottom: 16
                }}>
                    {tabs.map((t, i) => (
                        <button key={t} onClick={() => setTab(i)} style={{
                            flexShrink: 0, padding: "8px 16px",
                            background: "none", border: "none",
                            borderBottom: tab === i
                                ? `2.5px solid ${T.red}`
                                : "2.5px solid transparent",
                            fontSize: 13, fontWeight: tab === i ? 700 : 500,
                            color: tab === i ? T.ink : T.inkSec,
                            cursor: "pointer", transition: "all .18s",
                            marginBottom: -1.5, letterSpacing: "-.01em",
                        }}>{t}</button>
                    ))}
                </div>

                <div style={{
                    display: "flex", alignItems: "center", gap: 7,
                    fontSize: 12, color: T.inkSec, marginBottom: 14, letterSpacing: "-.01em"
                }}>
                    <span>3 found within 9 km</span>
                    <span style={{
                        width: 3, height: 3, borderRadius: "50%",
                        background: T.inkFaint, display: "block"
                    }} />
                    <span style={{
                        display: "flex", alignItems: "center", gap: 4,
                        color: T.green, fontWeight: 600
                    }}>
                        <span style={{
                            width: 5, height: 5, borderRadius: "50%",
                            background: T.green, display: "block"
                        }} /> Live OpenStreetMap
                    </span>
                </div>
            </div>

            <div className="body" style={{ padding: "0 22px" }}>
                {cards.map((h, i) => (
                    <div key={i} style={{
                        background: T.surface,
                        border: `1px solid ${T.border}`, borderRadius: 22,
                        marginBottom: 10, overflow: "hidden"
                    }}>

                        {/* Top rank bar */}
                        <div style={{ height: 3.5, background: rankColors[i] }} />

                        <div style={{ padding: "14px 16px" }}>
                            <div style={{
                                display: "flex", justifyContent: "space-between",
                                alignItems: "flex-start", marginBottom: 8
                            }}>
                                <div style={{ flex: 1, paddingRight: 10 }}>
                                    <div style={{
                                        fontSize: 14, fontWeight: 700, color: T.ink,
                                        lineHeight: 1.3, letterSpacing: "-.02em"
                                    }}>{h.name}</div>
                                    <div style={{
                                        fontFamily: "'JetBrains Mono', monospace",
                                        fontSize: 10, color: T.inkMute, marginTop: 4,
                                        letterSpacing: ".02em"
                                    }}>{h.open} · Emergency</div>
                                </div>
                                {/* Distance badge */}
                                <div style={{
                                    background: rankBgs[i], border: `1px solid ${rankBos[i]}`,
                                    borderRadius: 9, padding: "3px 10px", flexShrink: 0
                                }}>
                                    <span style={{
                                        fontFamily: "'Big Shoulders Display', sans-serif",
                                        fontSize: 18, fontWeight: 900,
                                        color: rankColors[i] === T.inkMute ? T.inkSec : rankColors[i],
                                        letterSpacing: "-.01em", lineHeight: 1.4
                                    }}>{h.dist}</span>
                                </div>
                            </div>

                            <div style={{
                                display: "flex", gap: 5, flexWrap: "wrap",
                                marginBottom: 14
                            }}>
                                {h.tags.map(c => (
                                    <span key={c} className="tag tm"
                                        style={{ fontSize: 9, letterSpacing: ".04em" }}>{c}</span>
                                ))}
                            </div>

                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 9 }}>
                                <button style={{
                                    padding: "10px 8px",
                                    background: T.greenSoft, border: `1px solid ${T.greenBorder}`,
                                    borderRadius: 11, fontSize: 12, fontWeight: 600, color: T.green,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    gap: 5, letterSpacing: "-.01em"
                                }}>
                                    <Ic d={I.phone} s={13} c={T.green} w={2} />
                                    {h.ph}
                                </button>
                                <button style={{
                                    padding: "10px 8px",
                                    background: T.blueSoft, border: `1px solid ${T.blueBorder}`,
                                    borderRadius: 11, fontSize: 12, fontWeight: 600, color: T.blue,
                                    display: "flex", alignItems: "center", justifyContent: "center",
                                    gap: 5, letterSpacing: "-.01em"
                                }}>
                                    <Ic d={I.arrow} s={13} c={T.blue} w={2} />
                                    Navigate
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/* ─── MAP ─────────────────────────────────────────────────────── */
function MapScreen() {
    const pins: [number, number, string][] = [
        [138, 162, T.red], [216, 146, T.red], [186, 216, T.red], [100, 248, T.red],
        [268, 196, T.red], [160, 306, T.red], [238, 286, T.red], [296, 246, T.red],
        [198, 352, T.red], [130, 372, T.red], [275, 334, T.red], [182, 265, T.red],
        [316, 174, T.blue], [154, 196, T.amber],
    ];

    return (
        <div className="scr" style={{ background: "#E8E5DC" }}>

            {/* Floating filter */}
            <div style={{
                position: "absolute", top: 56, left: 14, right: 14,
                zIndex: 20, display: "flex", gap: 7
            }}>
                {["Hospital", "Police", "Towing", "Petrol"].map((t, i) => (
                    <button key={t} style={{
                        flexShrink: 0, padding: "8px 15px",
                        borderRadius: 10,
                        border: `1px solid ${i === 0 ? T.red : "rgba(0,0,0,0.12)"}`,
                        background: i === 0 ? T.red : "rgba(255,255,255,0.90)",
                        color: i === 0 ? "#fff" : T.inkSec,
                        fontSize: 12, fontWeight: 600,
                        boxShadow: "0 2px 10px rgba(20,18,16,0.10)",
                        letterSpacing: "-.01em",
                    }}>{t}</button>
                ))}
            </div>

            {/* Map SVG */}
            <div style={{ position: "absolute", inset: 0 }}>
                <svg width="375" height="812" viewBox="0 0 375 812">
                    {/* Base tile — warm parchment like OSM */}
                    <rect width="375" height="812" fill="#EEE8D8" />

                    {/* ── Park / green areas (OSM green) ── */}
                    <path d="M0,210 Q80,185 175,225 Q265,265 375,235 L375,420 L0,420Z"
                        fill="#C8DDB0" />
                    <ellipse cx="55" cy="390" rx="58" ry="72" fill="#C8DDB0" />
                    <ellipse cx="318" cy="490" rx="44" ry="58" fill="#C8DDB0" />
                    <ellipse cx="190" cy="680" rx="60" ry="50" fill="#C8DDB0" />
                    {/* Lighter park inner */}
                    <path d="M0,220 Q80,200 160,235 Q230,260 375,245 L375,380 L0,380Z"
                        fill="#D8E8BC" />
                    <ellipse cx="55" cy="390" rx="40" ry="52" fill="#D4E4B4" />
                    <ellipse cx="318" cy="490" rx="28" ry="40" fill="#D4E4B4" />

                    {/* ── Water (OSM blue) ── */}
                    <ellipse cx="30" cy="600" rx="28" ry="18" fill="#AED4E8" />
                    <ellipse cx="350" cy="680" rx="22" ry="14" fill="#AED4E8" />

                    {/* ── Block fills (buildings area, OSM beige) ── */}
                    <rect x="120" y="160" width="60" height="40" rx="3" fill="#E2DACC" />
                    <rect x="200" y="240" width="50" height="32" rx="3" fill="#E2DACC" />
                    <rect x="260" y="180" width="40" height="35" rx="3" fill="#E2DACC" />
                    <rect x="130" y="310" width="55" height="28" rx="3" fill="#E2DACC" />
                    <rect x="225" y="300" width="48" height="30" rx="3" fill="#E2DACC" />

                    {/* ── Major roads ── */}
                    <line x1="108" y1="0" x2="98" y2="812"
                        stroke="#F5F0E8" strokeWidth="18" />
                    <line x1="208" y1="0" x2="193" y2="812"
                        stroke="#F5F0E8" strokeWidth="18" />
                    <line x1="0" y1="138" x2="375" y2="155"
                        stroke="#F5F0E8" strokeWidth="13" />
                    <line x1="0" y1="300" x2="375" y2="285"
                        stroke="#F5F0E8" strokeWidth="10" />
                    <line x1="0" y1="440" x2="375" y2="455"
                        stroke="#F5F0E8" strokeWidth="8" />

                    {/* Road edges / kerbs */}
                    <line x1="108" y1="0" x2="98" y2="812"
                        stroke="#D8D2C2" strokeWidth="20" strokeOpacity="0.5" />
                    <line x1="208" y1="0" x2="193" y2="812"
                        stroke="#D8D2C2" strokeWidth="20" strokeOpacity="0.5" />

                    {/* ── Centre lines ── */}
                    <line x1="108" y1="0" x2="98" y2="812"
                        stroke="#E8E2D2" strokeWidth="1.5" strokeDasharray="14 10" />
                    <line x1="208" y1="0" x2="193" y2="812"
                        stroke="#E8E2D2" strokeWidth="1.5" strokeDasharray="14 10" />

                    {/* ── Minor roads ── */}
                    <line x1="50" y1="200" x2="320" y2="210"
                        stroke="#F2EDE0" strokeWidth="6" strokeOpacity="0.7" />
                    <line x1="30" y1="360" x2="340" y2="350"
                        stroke="#F2EDE0" strokeWidth="5" strokeOpacity="0.7" />

                    {/* ── Road labels ── */}
                    <text x="116" y="147" fill="#B8B4A8" fontSize="8"
                        fontFamily="'JetBrains Mono',monospace"
                        fontWeight="500" letterSpacing="0.10em">MAGADI MAIN ROAD</text>
                    <text x="36" y="94" fill="#B8B4A8" fontSize="7"
                        fontFamily="'JetBrains Mono',monospace" letterSpacing="0.08em">
                        NICE ROAD</text>
                    {/* Pin drop shadow filter */}
                    <defs>
                        <filter id="pinShadow" x="-40%" y="-20%" width="180%" height="160%">
                            <feDropShadow dx="0" dy="2" stdDeviation="2.5"
                                floodColor="rgba(20,18,16,0.28)" floodOpacity="1" />
                        </filter>
                        <filter id="userShadow" x="-60%" y="-60%" width="220%" height="220%">
                            <feDropShadow dx="0" dy="2" stdDeviation="3"
                                floodColor="rgba(22,72,208,0.35)" floodOpacity="1" />
                        </filter>
                    </defs>

                    {/* Pins — teardrop body + needle */}
                    {pins.map(([x, y, c], i) => {
                        const label = c === T.blue ? "P" : c === T.amber ? "T" : "H";
                        // pin body top-center is at (x, y-28), needle tip at (x, y)
                        const W = 26, H = 30, R2 = W / 2;
                        const bx = x - R2, by = y - H - 6;
                        return (
                            <g key={i} filter="url(#pinShadow)">
                                {/* Teardrop shape: rounded rect top + triangle needle */}
                                {/* Needle */}
                                <polygon
                                    points={`${x - 5},${y - 10} ${x + 5},${y - 10} ${x},${y + 1}`}
                                    fill={c} />
                                {/* Body circle */}
                                <rect x={bx} y={by} width={W} height={H}
                                    rx={R2} ry={R2} fill={c} />
                                {/* White inner circle */}
                                <circle cx={x} cy={by + R2} r={R2 - 5}
                                    fill="white" opacity="0.22" />
                                {/* Letter */}
                                <text x={x} y={by + R2 + 4.5}
                                    textAnchor="middle"
                                    fill="white"
                                    fontSize="11"
                                    fontWeight="700"
                                    fontFamily="'Bricolage Grotesque',sans-serif"
                                    letterSpacing="0">
                                    {label}
                                </text>
                            </g>
                        );
                    })}

                    {/* User location */}
                    <circle cx="188" cy="288" r="22" fill={T.blue} fillOpacity="0.10" />
                    <circle cx="188" cy="288" r="12" fill={T.blue}
                        stroke="white" strokeWidth="3" filter="url(#userShadow)" />
                    <circle cx="188" cy="288" r="4" fill="white" />
                </svg>
            </div>

            {/* Legend */}
            <div style={{
                position: "absolute", top: 104, right: 14,
                background: "rgba(255,255,255,0.94)",
                border: `1px solid ${T.border}`, borderRadius: 14,
                padding: "10px 13px",
                boxShadow: "0 2px 12px rgba(20,18,16,0.08)"
            }}>
                {[
                    [T.red, "Hospital"], [T.blue, "Police"],
                    [T.amber, "Towing"], ["#8B5CF6", "Petrol"],
                ].map(([c, l]) => (
                    <div key={l} style={{
                        display: "flex", alignItems: "center",
                        gap: 8, marginBottom: 6
                    }}>
                        <div style={{
                            width: 7, height: 7, borderRadius: "50%",
                            background: c
                        }} />
                        <span style={{
                            fontSize: 10, color: T.inkSec,
                            fontWeight: 600, letterSpacing: "-.01em"
                        }}>{l}</span>
                    </div>
                ))}
            </div>

            {/* Bottom bar */}
            <div style={{ position: "absolute", bottom: 92, left: 14, right: 14 }}>
                <div style={{
                    background: "rgba(255,255,255,0.94)",
                    border: `1px solid ${T.border}`, borderRadius: 16,
                    padding: "14px 18px",
                    display: "flex", justifyContent: "space-between",
                    alignItems: "center",
                    boxShadow: "0 4px 20px rgba(20,18,16,0.10)"
                }}>
                    <div style={{
                        fontSize: 13, fontWeight: 600, color: T.ink,
                        letterSpacing: "-.01em"
                    }}>
                        84 found &nbsp;·&nbsp; tap a pin for options
                    </div>
                    <span className="tag tg"
                        style={{
                            fontFamily: "'JetBrains Mono', monospace",
                            fontSize: 9, letterSpacing: ".08em"
                        }}>CACHED</span>
                </div>
            </div>
        </div>
    );
}

/* ─── RAKSHAK ─────────────────────────────────────────────────── */
function Rakshak() {
    return (
        <div className="scr swIn">
            <SBar />
            <div className="body" style={{ padding: "0 22px" }}>

                {/* ── Hero ── */}
                <div style={{ paddingTop: 20, paddingBottom: 24 }}>
                    {/* Shield SVG — custom, not icon font */}
                    <div style={{ marginBottom: 22 }}>
                        <svg width="56" height="62" viewBox="0 0 56 62" fill="none">
                            <path d="M28 3L51 12.5V29C51 43.5 41 54 28 59C15 54 5 43.5 5 29V12.5L28 3Z"
                                fill={T.redSoft} stroke={T.red} strokeWidth="1.5" />
                            <path d="M19 31L25 37L37 23"
                                stroke={T.red} strokeWidth="2.2"
                                strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>

                    <div style={{
                        fontSize: 36, fontWeight: 800, color: T.ink,
                        letterSpacing: "-.05em", lineHeight: .95, marginBottom: 12
                    }}>
                        Rakshak<br />
                        <span style={{
                            fontWeight: 300, fontSize: 32,
                            letterSpacing: "-.03em"
                        }}>Network</span>
                    </div>
                    <div style={{
                        fontSize: 14, color: T.inkSec, lineHeight: 1.65,
                        maxWidth: 270, letterSpacing: "-.01em"
                    }}>
                        Join India's certified first-aid volunteer network.
                        Get alerts when accidents happen near you.
                        Save lives. Claim ₹25,000.
                    </div>
                </div>

                {/* ── Stats — tight seamless grid ── */}
                <div style={{
                    display: "grid", gridTemplateColumns: "1fr 1fr 1fr",
                    border: `1px solid ${T.border}`, borderRadius: 20,
                    overflow: "hidden", marginBottom: 24,
                    boxShadow: "0 2px 8px rgba(20,18,16,0.05)"
                }}>
                    {[
                        { n: "2km", l: "Alert radius" },
                        { n: "₹25k", l: "Reward" },
                        { n: "12k+", l: "Rakshaks" },
                    ].map((s, i) => (
                        <div key={s.l} style={{
                            background: T.surface, padding: "18px 14px",
                            textAlign: "center",
                            borderRight: i < 2 ? `1px solid ${T.border}` : "none",
                        }}>
                            <div style={{
                                fontFamily: "'Big Shoulders Display', sans-serif",
                                fontSize: 34, fontWeight: 900, color: T.ink,
                                lineHeight: 1, letterSpacing: "-.01em"
                            }}>{s.n}</div>
                            <div style={{
                                fontSize: 10, color: T.inkSec, marginTop: 6,
                                fontWeight: 500, letterSpacing: "-.01em"
                            }}>{s.l}</div>
                        </div>
                    ))}
                </div>

                {/* ── Benefits ── */}
                <div style={{
                    background: T.surface, border: `1px solid ${T.border}`,
                    borderRadius: 22, overflow: "hidden", marginBottom: 18,
                    boxShadow: "0 2px 8px rgba(20,18,16,0.05)"
                }}>
                    {[
                        {
                            l: "Get crash alerts within 2km",
                            sub: "Push notification the moment it happens",
                            ic: I.bell, c: T.red
                        },
                        {
                            l: "Navigate directly to the scene",
                            sub: "Turn-by-turn with live incident location",
                            ic: I.arrow, c: T.blue
                        },
                        {
                            l: "Protected by Good Samaritan Law",
                            sub: "No police detention, fully protected",
                            ic: I.shield, c: T.green
                        },
                        {
                            l: "₹25,000 reward per rescue",
                            sub: "Auto-generated PDF claim filed for you",
                            ic: I.star, c: T.amber
                        },
                    ].map((x, i, arr) => (
                        <div key={x.l} style={{
                            display: "flex", gap: 14, padding: "15px 18px",
                            alignItems: "center",
                            borderBottom: i < arr.length - 1
                                ? `1px solid ${T.borderFaint}` : "none",
                        }}>
                            <div style={{
                                width: 42, height: 42, borderRadius: 14,
                                flexShrink: 0,
                                background: x.c === T.red ? T.redSoft
                                    : x.c === T.green ? T.greenSoft
                                        : x.c === T.blue ? T.blueSoft
                                            : T.amberSoft,
                                border: `1px solid ${x.c === T.red ? T.redBorder
                                        : x.c === T.green ? T.greenBorder
                                            : x.c === T.blue ? T.blueBorder
                                                : T.amberBorder}`,
                                display: "flex", alignItems: "center",
                                justifyContent: "center"
                            }}>
                                <Ic d={x.ic} s={18} c={x.c} />
                            </div>
                            <div style={{ flex: 1 }}>
                                <div style={{
                                    fontSize: 13, fontWeight: 700, color: T.ink,
                                    marginBottom: 2, letterSpacing: "-.02em"
                                }}>{x.l}</div>
                                <div style={{
                                    fontSize: 11, color: T.inkSec,
                                    letterSpacing: "-.01em"
                                }}>{x.sub}</div>
                            </div>
                            <Ic d={I.chevron} s={16} c={T.inkFaint} />
                        </div>
                    ))}
                </div>

                {/* ── CTA ── */}
                <button style={{
                    width: "100%", padding: "17px",
                    background: T.red,
                    border: "none", borderRadius: 16,
                    fontSize: 16, fontWeight: 800, color: "white",
                    letterSpacing: "-.01em",
                    display: "flex", alignItems: "center",
                    justifyContent: "center", gap: 10,
                    marginBottom: 14,
                    boxShadow: `0 5px 0 ${T.redDeep}, 0 8px 24px rgba(239,62,40,0.22)`,
                }}>
                    Join Rakshak Network
                    <Ic d={I.arrow} s={17} c="#fff" w={2.5} />
                </button>

                <div style={{
                    textAlign: "center", fontSize: 13, color: T.inkSec,
                    paddingBottom: 8, letterSpacing: "-.01em"
                }}>
                    Already registered?{" "}
                    <span style={{ color: T.red, fontWeight: 700, cursor: "pointer" }}>
                        Login
                    </span>
                </div>
            </div>
        </div>
    );
}

/* ─── ROOT ────────────────────────────────────────────────────── */
export default function App() {
    const [sc, setSc] = useState("home");
    const noNav = ["crash"];

    const tabs = [
        { id: "home", l: "Home" },
        { id: "sos", l: "SOS" },
        { id: "crash", l: "Crash" },
        { id: "services", l: "Services" },
        { id: "map", l: "Map" },
        { id: "rakshak", l: "Rakshak" },
    ];

    return (
        <>
            <style>{CSS}</style>
            <div style={{
                minHeight: "100vh", background: "#ECEAE4",
                display: "flex", flexDirection: "column",
                alignItems: "center", gap: 36, padding: "52px 16px 80px"
            }}>

                {/* Page header */}
                <div style={{ textAlign: "center" }}>
                    <div style={{
                        fontSize: 38, fontWeight: 800, color: "#141210",
                        letterSpacing: "-.05em"
                    }}>AETHER</div>
                    <div style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 10, color: "#A8A5A0", letterSpacing: ".18em",
                        textTransform: "uppercase", marginTop: 7
                    }}>
                        UI System · v5
                    </div>
                </div>

                {/* Screen switcher */}
                <div style={{
                    display: "flex", gap: 6, flexWrap: "wrap",
                    justifyContent: "center"
                }}>
                    {tabs.map(s => (
                        <button key={s.id} onClick={() => setSc(s.id)} style={{
                            padding: "8px 18px", borderRadius: 10,
                            border: `1px solid ${sc === s.id ? T.red : "#D4D1C8"}`,
                            background: sc === s.id ? T.redSoft : "#F7F5F0",
                            color: sc === s.id ? T.red : "#706D65",
                            fontSize: 13, fontWeight: 600,
                            letterSpacing: "-.01em",
                            transition: "all .18s",
                        }}>
                            {s.l}
                        </button>
                    ))}
                </div>

                {/* Phone */}
                <div className="phone">
                    <div className="notch" />
                    {sc === "home" && <Home />}
                    {sc === "sos" && <SOS set={setSc} />}
                    {sc === "crash" && <Crash set={setSc} />}
                    {sc === "services" && <Services />}
                    {sc === "map" && <MapScreen />}
                    {sc === "rakshak" && <Rakshak />}
                    {!noNav.includes(sc) && <Nav sc={sc} set={setSc} />}
                </div>

                {/* Font credit */}
                <div style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10, color: "#A8A5A0", letterSpacing: ".12em",
                    display: "flex", gap: 16, textTransform: "uppercase"
                }}>
                    <span>Bricolage Grotesque</span>
                    <span>·</span>
                    <span>Big Shoulders Display</span>
                    <span>·</span>
                    <span>JetBrains Mono</span>
                    <span>·</span>
                    <span>#F7F5F0</span>
                </div>
            </div>
        </>
    );
}