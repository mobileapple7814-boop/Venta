/**
 * decoy.js — صفحه‌ی عمومی قلابی Vanta Core
 *
 * بازدیدکننده‌ی عادی (یا بازرس Railway/گوگل) که به دامنه‌ی سرویس می‌آید،
 * یک صفحه‌ی «محصول SaaS» معمولی می‌بیند: بدون هیچ نشانه‌ای از پروکسی،
 * VLESS یا پنل مدیریت. هدف این است که دامنه از بیرون شبیه یک وب‌اپ
 * کاملاً عادی به نظر برسد.
 *
 * صفحه کاملاً استاتیک و سبک است؛ هیچ درخواست API واقعی نمی‌فرستد.
 */

export function decoyPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Nimbus Notes — Write. Sync. Share.</title>
<style>
  :root{
    --bg:#0b0f1a; --card:#121829; --card2:#0f1524; --line:#232c45;
    --ink:#e8ecf8; --dim:#8b94ad; --brand:#6c8cff; --brand2:#9d7bff;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  body{
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background: radial-gradient(900px 500px at 20% -10%, rgba(108,140,255,.12), transparent 60%),
                radial-gradient(700px 400px at 100% 0%, rgba(157,123,255,.08), transparent 55%),
                var(--bg);
    color:var(--ink); min-height:100vh;
  }
  .wrap{max-width:920px;margin:0 auto;padding:24px 20px 80px}
  header{display:flex;justify-content:space-between;align-items:center;padding:18px 0}
  .logo{display:flex;align-items:center;gap:10px;font-weight:700;font-size:18px;letter-spacing:.2px}
  .logo .mark{width:26px;height:26px;border-radius:8px;background:linear-gradient(135deg,var(--brand),var(--brand2));display:inline-flex;align-items:center;justify-content:center;font-size:13px;color:#fff}
  nav{display:flex;gap:22px;align-items:center;font-size:14px;color:var(--dim)}
  nav a{color:inherit;text-decoration:none}
  nav a:hover{color:var(--ink)}
  .cta{background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff !important;padding:8px 16px;border-radius:8px;font-weight:600}
  .hero{text-align:center;padding:90px 0 60px}
  .hero h1{font-size:clamp(30px,6vw,52px);line-height:1.15;font-weight:800;letter-spacing:-.5px}
  .hero h1 span{background:linear-gradient(135deg,var(--brand),var(--brand2));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
  .hero p{color:var(--dim);font-size:clamp(15px,2.2vw,18px);max-width:560px;margin:18px auto 0;line-height:1.7}
  .hero .btns{display:flex;gap:12px;justify-content:center;margin-top:32px;flex-wrap:wrap}
  .btn{padding:12px 26px;border-radius:10px;font-size:15px;font-weight:600;text-decoration:none;display:inline-block}
  .btn.primary{background:linear-gradient(135deg,var(--brand),var(--brand2));color:#fff}
  .btn.ghost{border:1px solid var(--line);color:var(--ink)}
  .features{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:16px;margin-top:40px}
  .feature{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:22px}
  .feature .ic{font-size:22px;margin-bottom:12px}
  .feature h3{font-size:15.5px;margin-bottom:8px}
  .feature p{color:var(--dim);font-size:13.5px;line-height:1.65}
  footer{margin-top:70px;padding-top:24px;border-top:1px solid var(--line);display:flex;justify-content:space-between;color:var(--dim);font-size:13px;flex-wrap:wrap;gap:10px}
  @media (max-width:640px){ nav .menu{display:none} }
</style>
</head>
<body>
<div class="wrap">
  <header>
    <div class="logo"><span class="mark">N</span> Nimbus Notes</div>
    <nav>
      <a class="menu" href="#">Product</a>
      <a class="menu" href="#">Pricing</a>
      <a class="menu" href="#">Docs</a>
      <a class="cta" href="#">Get started</a>
    </nav>
  </header>

  <section class="hero">
    <h1>Your notes,<br><span>everywhere you work.</span></h1>
    <p>Nimbus Notes is a fast, private workspace for teams. Capture ideas, sync instantly across devices, and share with one link — encrypted end to end.</p>
    <div class="btns">
      <a class="btn primary" href="#">Start free</a>
      <a class="btn ghost" href="#">Book a demo</a>
    </div>
  </section>

  <section class="features">
    <div class="feature"><div class="ic">⚡</div><h3>Instant sync</h3><p>Everything you write is synced across all your devices in under a second, online or offline.</p></div>
    <div class="feature"><div class="ic">🔒</div><h3>Private by default</h3><p>End-to-end encryption on every page. Not even we can read your workspace.</p></div>
    <div class="feature"><div class="ic">🤝</div><h3>Team spaces</h3><p>Invite teammates, mention anyone, and keep every project in one searchable place.</p></div>
  </section>

  <footer>
    <span>© 2026 Nimbus Labs Inc.</span>
    <span>Status · Privacy · Terms</span>
  </footer>
</div>
</body>
</html>`;
}

/** صفحه 404 عمومی — شبیه یک سایت استاتیک معمولی */
export function notFoundPage() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Page not found — Nimbus Notes</title>
<style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#0b0f1a;color:#e8ecf8;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;text-align:center}
  .box h1{font-size:64px;margin:0;opacity:.9}
  .box p{color:#8b94ad;margin:14px 0 28px}
  .box a{color:#6c8cff;text-decoration:none;border:1px solid #232c45;padding:10px 22px;border-radius:8px;display:inline-block}
</style>
</head>
<body>
<div class="box">
  <h1>404</h1>
  <p>That page doesn't exist — it may have been moved or deleted.</p>
  <a href="/">Back to home</a>
</div>
</body>
</html>`;
}
