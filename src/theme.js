/**
 * theme.js — تم «Aurora Glass» برای پنل Vanta Core
 *
 * پالت: شب عمیق با شفق‌های سایان/بنفش/صورتی، سطوح شیشه‌ای مات،
 * تایپوگرافی وزیرمتن + Space Grotesk، جزئیات نئونی ظریف.
 */

export const AURORA_STYLE = `
<style>
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Vazirmatn:wght@400;500;600;700;800&display=swap');
  :root{
    --bg:#070B14; --bg2:#0A1020;
    --glass:rgba(20,28,48,.55); --glass2:rgba(14,20,36,.72);
    --line:rgba(148,170,255,.14); --line-hi:rgba(148,170,255,.28);
    --c1:#22D3EE; --c2:#818CF8; --c3:#E879F9; --c4:#34D399;
    --ink:#EDF2FF; --ink-dim:#8B96B8; --ink-faint:#5A6485;
    --ok:#34D399; --warn:#FBBF24; --danger:#FB7185;
    --glow1:rgba(34,211,238,.14); --glow2:rgba(129,140,248,.12); --glow3:rgba(232,121,249,.10);
    --ease:cubic-bezier(.4,0,.2,1);
    --grad:linear-gradient(120deg,var(--c1),var(--c2) 50%,var(--c3));
  }
  *{box-sizing:border-box}
  html{scroll-behavior:smooth}
  body{
    margin:0;color:var(--ink);font-family:'Vazirmatn','Space Grotesk',sans-serif;
    -webkit-font-smoothing:antialiased;
    background:
      radial-gradient(1100px 560px at 85% -12%, var(--glow1), transparent 62%),
      radial-gradient(900px 520px at -10% 12%, var(--glow2), transparent 58%),
      radial-gradient(800px 480px at 55% 115%, var(--glow3), transparent 60%),
      var(--bg);
    background-attachment:fixed;
    min-height:100vh;position:relative;overflow-x:hidden;
  }
  ::selection{background:rgba(129,140,248,.4);color:#fff}
  .mono{font-family:'JetBrains Mono',monospace}
  .display{font-family:'Space Grotesk','Vazirmatn',sans-serif}
  a{color:inherit}

  /* ── برند ─────────────────────────────────────────── */
  .vanta-mark{display:flex;align-items:center;gap:12px}
  .vanta-mark .sigil{
    width:38px;height:38px;border-radius:12px;position:relative;
    background:var(--grad);display:inline-flex;align-items:center;justify-content:center;
    box-shadow:0 0 24px rgba(129,140,248,.45), inset 0 1px 0 rgba(255,255,255,.3);
  }
  .vanta-mark .sigil svg{width:20px;height:20px}
  .vanta-mark h1{
    font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:21px;letter-spacing:.03em;margin:0;
    background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  }
  .vanta-mark .sub{font-size:10px;color:var(--ink-faint);letter-spacing:.28em;text-transform:uppercase;font-family:'JetBrains Mono',monospace}

  /* ── سطوح شیشه‌ای ─────────────────────────────────── */
  .card{
    background:linear-gradient(180deg,var(--glass),var(--glass2));
    border:1px solid var(--line);border-radius:16px;
    box-shadow:0 24px 48px -24px rgba(0,0,0,.7), inset 0 1px 0 rgba(255,255,255,.05);
    backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);position:relative;
    transition:border-color .25s var(--ease), box-shadow .25s var(--ease), transform .2s var(--ease);
  }
  .card:hover{border-color:var(--line-hi);box-shadow:0 28px 56px -24px rgba(0,0,0,.75), 0 0 40px -18px rgba(129,140,248,.25), inset 0 1px 0 rgba(255,255,255,.06)}
  .card-accent-top::before{
    content:'';position:absolute;top:0;left:24px;right:24px;height:2px;border-radius:2px;
    background:var(--grad);opacity:.85;box-shadow:0 0 18px rgba(129,140,248,.6);
  }

  /* ── فرم ──────────────────────────────────────────── */
  input,select,textarea{
    background:rgba(10,16,32,.6); border:1px solid var(--line); color:var(--ink);
    border-radius:10px; padding:10px 14px; font-family:'Vazirmatn',sans-serif; font-size:13.5px; width:100%;
    transition:border-color .15s var(--ease), box-shadow .15s var(--ease), background .15s var(--ease);
  }
  input:hover,select:hover,textarea:hover{border-color:var(--line-hi)}
  input:focus,select:focus,textarea:focus{outline:none;border-color:var(--c2);box-shadow:0 0 0 3px rgba(129,140,248,.18), 0 0 20px rgba(129,140,248,.15);background:rgba(129,140,248,.06)}
  input::placeholder,textarea::placeholder{color:var(--ink-faint)}
  label{font-size:11px;color:var(--ink-dim);letter-spacing:.04em;font-family:'Vazirmatn',sans-serif;display:block;margin-bottom:6px}
  button{cursor:pointer;font-family:'Vazirmatn',sans-serif;border:none}

  .btn-primary{
    position:relative;overflow:hidden;
    background:var(--grad);background-size:200% 100%;
    color:#fff;font-weight:700;letter-spacing:.02em;
    border-radius:10px;padding:10px 20px;font-size:13.5px;
    transition:background-position .4s var(--ease), transform .12s var(--ease), box-shadow .2s var(--ease);
    box-shadow:0 4px 20px -6px rgba(129,140,248,.6), inset 0 1px 0 rgba(255,255,255,.25);
  }
  .btn-primary:hover{background-position:100% 0;transform:translateY(-1px);box-shadow:0 8px 28px -8px rgba(129,140,248,.75), inset 0 1px 0 rgba(255,255,255,.25)}
  .btn-primary:active{transform:translateY(0)}
  .btn-primary:disabled{opacity:.5;cursor:default;transform:none;box-shadow:none}
  .btn-ghost{
    background:rgba(148,170,255,.06);border:1px solid var(--line);color:var(--ink-dim);
    border-radius:10px;padding:7px 13px;font-size:12.5px;
    transition:all .15s var(--ease);
  }
  .btn-ghost:hover{color:var(--ink);border-color:var(--c2);background:rgba(129,140,248,.12);box-shadow:0 0 16px rgba(129,140,248,.15);transform:translateY(-1px)}
  .btn-ghost:active{transform:translateY(0)}
  .btn-ghost.danger:hover{color:var(--danger);border-color:var(--danger);background:rgba(251,113,133,.1);box-shadow:0 0 16px rgba(251,113,133,.15)}
  .btn-ghost.ok-btn:hover{color:var(--ok);border-color:var(--ok);background:rgba(52,211,153,.1)}

  /* ── جدول ─────────────────────────────────────────── */
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  th{text-align:right;color:var(--ink-faint);font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;padding:11px 10px;border-bottom:1px solid var(--line);font-weight:600}
  td{padding:11px 10px;border-bottom:1px solid var(--line);vertical-align:middle}
  tbody tr{transition:background .15s var(--ease)}
  tbody tr:last-child td{border-bottom:none}
  tbody tr:hover{background:rgba(129,140,248,.06)}

  /* ── تب‌ها ─────────────────────────────────────────── */
  .tabs{display:flex;gap:4px;margin-bottom:20px;flex-wrap:wrap;position:relative}
  .tab{
    padding:9px 16px;font-size:13px;color:var(--ink-dim);cursor:pointer;border-radius:10px;
    transition:all .18s var(--ease);position:relative;
  }
  .tab:hover{color:var(--ink);background:rgba(148,170,255,.08)}
  .tab.active{
    color:#fff;
    background:linear-gradient(180deg, rgba(129,140,248,.22), rgba(129,140,248,.10));
    box-shadow:inset 0 0 0 1px var(--line-hi), 0 4px 18px -8px rgba(129,140,248,.5);
  }
  .tab.active::after{content:'';position:absolute;bottom:-1px;right:14px;left:14px;height:2px;border-radius:2px;background:var(--grad);box-shadow:0 0 10px rgba(129,140,248,.7)}

  /* ── pill وضعیت ───────────────────────────────────── */
  .pill{display:inline-flex;align-items:center;gap:6px;padding:3px 10px;border-radius:99px;font-size:10.5px;border:1px solid transparent;letter-spacing:.03em}
  .pill::before{content:'';width:6px;height:6px;border-radius:50%;background:currentColor;box-shadow:0 0 8px currentColor}
  .pill.on{background:rgba(52,211,153,.1);color:var(--ok);border-color:rgba(52,211,153,.3)}
  .pill.off{background:rgba(251,113,133,.1);color:var(--danger);border-color:rgba(251,113,133,.3)}
  .pill.warn{background:rgba(251,191,36,.1);color:var(--warn);border-color:rgba(251,191,36,.3)}
  .pill.info{background:rgba(34,211,238,.1);color:var(--c1);border-color:rgba(34,211,238,.3)}

  /* ── کارت آمار ────────────────────────────────────── */
  .stat{padding:16px;overflow:hidden;transition:transform .18s var(--ease), border-color .18s var(--ease), box-shadow .18s var(--ease)}
  .stat .stat-icon{
    width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;margin-bottom:10px;
    background:linear-gradient(135deg, rgba(34,211,238,.15), rgba(129,140,248,.15));
    border:1px solid var(--line-hi);
  }
  .stat .stat-icon svg{width:16px;height:16px}
  .stat .num{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:25px;letter-spacing:.01em}
  .stat .lbl{color:var(--ink-dim);font-size:11.5px;margin-top:4px}
  .stat:hover{transform:translateY(-3px);border-color:var(--line-hi)}

  /* ── نوار پیشرفت ──────────────────────────────────── */
  .meter{background:rgba(148,170,255,.1);border-radius:99px;height:8px;overflow:hidden;position:relative}
  .meter i{display:block;height:100%;background:var(--grad);border-radius:99px;transition:width .6s var(--ease);box-shadow:0 0 12px rgba(129,140,248,.5)}
  .meter i.hot{background:linear-gradient(90deg,#FBBF24,#F97316);box-shadow:0 0 12px rgba(251,191,36,.5)}
  .meter i.over{background:linear-gradient(90deg,#FB7185,#EF4444);box-shadow:0 0 12px rgba(251,113,133,.5)}
  .cfg-usage-bar{height:4px;background:rgba(148,170,255,.12);border-radius:99px;margin-top:6px;overflow:hidden;min-width:70px}
  .cfg-usage-bar i{display:block;height:100%;background:var(--grad);border-radius:99px;transition:width .6s var(--ease)}
  .cfg-usage-bar i.hot{background:linear-gradient(90deg,var(--warn),#F97316)}
  .cfg-usage-bar i.over{background:var(--danger)}

  /* ── مودال ─────────────────────────────────────────── */
  .modal-bg{
    position:fixed;inset:0;background:rgba(4,7,15,.7);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);
    display:flex;align-items:center;justify-content:center;padding:16px;z-index:50;
    animation:fadeIn .16s var(--ease);
  }
  .modal-bg .card{animation:pop .2s var(--ease)}

  /* ── توست ──────────────────────────────────────────── */
  #toastWrap{position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:3000;display:flex;flex-direction:column;gap:8px;align-items:center}
  .toast{
    background:rgba(10,16,32,.92);border:1px solid var(--line-hi);color:var(--ink);border-radius:12px;
    padding:11px 18px;font-size:13px;box-shadow:0 12px 36px rgba(0,0,0,.6), 0 0 24px -8px rgba(129,140,248,.3);
    animation:toastIn .25s var(--ease);display:flex;align-items:center;gap:9px;max-width:90vw;
    backdrop-filter:blur(10px);
  }
  .toast.ok{border-color:rgba(52,211,153,.4);color:var(--ok)}
  .toast.err{border-color:rgba(251,113,133,.4);color:var(--danger)}
  .toast.hide{transition:opacity .3s,transform .3s;opacity:0;transform:translateY(8px)}

  /* ── نمودار ────────────────────────────────────────── */
  .chart-card{padding:16px;margin-bottom:20px}
  .chart-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px}
  .chart-legend{display:flex;gap:14px;font-size:11px;color:var(--ink-dim);flex-wrap:wrap}
  .chart-legend .lg{display:inline-flex;align-items:center;gap:5px}
  .chart-legend .sw{width:10px;height:10px;border-radius:3px;display:inline-block}
  .traffic-chart{width:100%;height:150px;display:block}
  .traffic-chart .gridline{stroke:rgba(148,170,255,.08);stroke-width:1}
  .traffic-chart .axis-label{fill:var(--ink-faint);font-size:9px;font-family:'JetBrains Mono',monospace}
  .traffic-chart .area{fill:url(#vantaGrad);opacity:.4}
  .traffic-chart .line{fill:none;stroke:url(#vantaLine);stroke-width:2.2;stroke-linejoin:round;stroke-linecap:round}
  .traffic-chart .dot{fill:#0A1020;stroke:var(--c3);stroke-width:2}
  .traffic-chart .dot-glow{fill:rgba(232,121,249,.3)}
  .chart-wrap{position:relative}
  .chart-tip{
    position:absolute;pointer-events:none;background:rgba(10,16,32,.95);border:1px solid var(--line-hi);
    border-radius:10px;padding:6px 10px;font-size:11.5px;color:var(--ink);white-space:nowrap;
    box-shadow:0 8px 24px rgba(0,0,0,.5);display:none;z-index:5;backdrop-filter:blur(8px);
  }
  .chart-tip .t{color:var(--ink-dim);font-size:10px;margin-bottom:2px}

  /* ── متفرقه ────────────────────────────────────────── */
  .row-actions{display:flex;gap:4px;flex-wrap:wrap;justify-content:flex-end}
  .flag-badge{font-size:14px;margin-inline-end:4px}
  .cfg-name{font-weight:700;color:var(--ink)}
  .toolbar{display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap;justify-content:space-between;align-items:center}
  .search-wrap{position:relative;flex:1;max-width:280px}
  .search-wrap input{padding-right:36px}
  .search-wrap .s-ic{position:absolute;right:12px;top:50%;transform:translateY(-50%);color:var(--ink-faint);font-size:13px;pointer-events:none}
  .hdr-meta{display:flex;gap:14px;align-items:center;font-size:11px;color:var(--ink-dim)}
  .hdr-meta .live-dot{width:7px;height:7px;border-radius:50%;background:var(--ok);box-shadow:0 0 10px var(--ok);display:inline-block;margin-inline-end:4px;animation:blip 2s ease-in-out infinite}
  @keyframes blip{0%,100%{opacity:1}50%{opacity:.4}}
  .skeleton{background:linear-gradient(90deg,rgba(148,170,255,.06) 25%,rgba(148,170,255,.16) 50%,rgba(148,170,255,.06) 75%);background-size:200% 100%;animation:skel 1.1s infinite;border-radius:8px;height:38px}
  @keyframes skel{from{background-position:200% 0}to{background-position:-200% 0}}
  #qrBox{display:flex;justify-content:center;padding:12px;background:#fff;border-radius:14px;margin:12px 0}
  #qrBox svg,#qrBox canvas,#qrBox img{display:block}
  .hint{font-size:11.5px;color:var(--ink-dim);line-height:1.7}
  .empty-note{color:var(--ink-dim);text-align:center;padding:18px}

  @keyframes fadeIn{from{opacity:0}to{opacity:1}}
  @keyframes pop{from{opacity:0;transform:scale(.97) translateY(6px)}to{opacity:1;transform:scale(1) translateY(0)}}
  @keyframes toastIn{from{opacity:0;transform:translateY(12px) scale(.96)}to{opacity:1;transform:translateY(0) scale(1)}}
  @keyframes numPop{0%{transform:scale(.7);opacity:0}60%{transform:scale(1.1)}100%{transform:scale(1);opacity:1}}
  .num.pop{animation:numPop .45s var(--ease)}

  ::-webkit-scrollbar{width:9px;height:9px}
  ::-webkit-scrollbar-track{background:transparent}
  ::-webkit-scrollbar-thumb{background:rgba(148,170,255,.2);border-radius:9px}
  ::-webkit-scrollbar-thumb:hover{background:rgba(148,170,255,.35)}

  @media (max-width:640px){
    .stat .num{font-size:20px}
    .row-actions{justify-content:flex-start}
  }
  @media (prefers-reduced-motion:reduce){*{animation-duration:.01ms !important;transition-duration:.01ms !important}}
</style>`;
