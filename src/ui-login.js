/**
 * ui-login.js — صفحه‌ی ورود پنل Vanta Core
 *
 * این صفحه فقط روی مسیر مخفی ادمین (ADMIN_PATH) سرو می‌شود؛ برای
 * بقیه‌ی دنیا صفحه‌ی قلابی (decoy) نمایش داده می‌شود.
 */

export function loginPage() {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Vanta — ورود</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Vazirmatn:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#070B14; --glass:rgba(20,28,48,.55); --glass2:rgba(14,20,36,.75);
    --line:rgba(148,170,255,.16); --line-hi:rgba(148,170,255,.32);
    --c1:#22D3EE; --c2:#818CF8; --c3:#E879F9;
    --ink:#EDF2FF; --ink-dim:#8B96B8; --ink-faint:#5A6485;
    --ok:#34D399; --warn:#FBBF24; --danger:#FB7185;
    --grad:linear-gradient(120deg,var(--c1),var(--c2) 50%,var(--c3));
    --ease:cubic-bezier(.4,0,.2,1);
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{height:100%}
  body{
    font-family:'Vazirmatn',sans-serif;color:var(--ink);
    background:
      radial-gradient(1000px 520px at 80% -10%, rgba(34,211,238,.13), transparent 60%),
      radial-gradient(900px 540px at -10% 20%, rgba(129,140,248,.12), transparent 55%),
      radial-gradient(760px 500px at 55% 115%, rgba(232,121,249,.10), transparent 60%),
      var(--bg);
    min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;
    -webkit-font-smoothing:antialiased;overflow-x:hidden;
  }
  /* رشته‌های نوری شفق قطبی */
  .aurora{position:fixed;inset:0;pointer-events:none;z-index:0;overflow:hidden}
  .aurora .band{
    position:absolute;width:160vw;height:34vh;left:-30vw;filter:blur(70px);opacity:.5;
    border-radius:50%;
  }
  .aurora .b1{top:6%;background:linear-gradient(90deg,transparent,rgba(34,211,238,.24),transparent);animation:drift 16s ease-in-out infinite}
  .aurora .b2{top:36%;background:linear-gradient(90deg,transparent,rgba(129,140,248,.22),transparent);animation:drift 20s ease-in-out infinite reverse}
  .aurora .b3{top:66%;background:linear-gradient(90deg,transparent,rgba(232,121,249,.18),transparent);animation:drift 24s ease-in-out infinite}
  @keyframes drift{0%,100%{transform:translateX(-6%) rotate(-2deg)}50%{transform:translateX(6%) rotate(2deg)}}
  .stars{position:fixed;inset:0;z-index:0;pointer-events:none}
  .stars i{position:absolute;width:2px;height:2px;border-radius:50%;background:#fff;opacity:.5;animation:tw 3s ease-in-out infinite}
  @keyframes tw{0%,100%{opacity:.15}50%{opacity:.7}}

  .panel-wrap{position:relative;z-index:2;width:100%;max-width:400px;animation:panelIn .5s var(--ease)}
  @keyframes panelIn{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}

  .glass{
    background:linear-gradient(180deg,var(--glass),var(--glass2));
    border:1px solid var(--line);border-radius:22px;padding:34px 30px 28px;
    backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
    box-shadow:0 32px 64px -28px rgba(0,0,0,.8), inset 0 1px 0 rgba(255,255,255,.06);
    position:relative;overflow:hidden;
  }
  .glass::before{
    content:'';position:absolute;top:0;left:40px;right:40px;height:2px;border-radius:2px;
    background:var(--grad);box-shadow:0 0 22px rgba(129,140,248,.7);
  }

  .brand{display:flex;flex-direction:column;align-items:center;gap:14px;margin-bottom:26px}
  .sigil{
    width:62px;height:62px;border-radius:20px;position:relative;
    background:var(--grad);display:flex;align-items:center;justify-content:center;
    box-shadow:0 0 40px rgba(129,140,248,.55), inset 0 2px 0 rgba(255,255,255,.35);
    animation:sigilFloat 5s ease-in-out infinite;
  }
  @keyframes sigilFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
  .sigil svg{width:30px;height:30px}
  .brand h1{
    font-family:'Space Grotesk',sans-serif;font-size:26px;font-weight:700;letter-spacing:.06em;
    background:var(--grad);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;
  }
  .brand .tagline{font-size:10px;color:var(--ink-faint);letter-spacing:.34em;text-transform:uppercase;font-family:'JetBrains Mono',monospace}

  .field{margin-bottom:15px}
  .field label{display:flex;justify-content:space-between;align-items:center;font-size:12px;color:var(--ink-dim);margin-bottom:7px}
  .field label .en{font-family:'JetBrains Mono',monospace;font-size:9.5px;color:var(--ink-faint);letter-spacing:.08em}
  .field input{
    width:100%;background:rgba(10,16,32,.6);border:1px solid var(--line);color:var(--ink);
    padding:12px 15px;font-size:14px;border-radius:12px;outline:none;
    font-family:'JetBrains Mono',monospace;direction:ltr;text-align:left;letter-spacing:.5px;
    transition:border-color .2s, box-shadow .2s, background .2s;
  }
  .field input::placeholder{color:var(--ink-faint)}
  .field input:focus{border-color:var(--c2);box-shadow:0 0 0 3px rgba(129,140,248,.16), 0 0 24px rgba(129,140,248,.14);background:rgba(129,140,248,.05)}

  .auth-btn{
    width:100%;position:relative;overflow:hidden;border:none;cursor:pointer;
    background:var(--grad);background-size:200% 100%;
    color:#fff;font-family:'Vazirmatn',sans-serif;font-weight:700;font-size:14.5px;letter-spacing:.02em;
    padding:13px 0;border-radius:12px;margin-top:6px;
    transition:background-position .4s var(--ease), transform .12s var(--ease), box-shadow .2s var(--ease);
    box-shadow:0 8px 28px -8px rgba(129,140,248,.7), inset 0 1px 0 rgba(255,255,255,.3);
  }
  .auth-btn:hover{background-position:100% 0;transform:translateY(-1px);box-shadow:0 12px 34px -10px rgba(129,140,248,.85), inset 0 1px 0 rgba(255,255,255,.3)}
  .auth-btn:active{transform:translateY(0)}
  .auth-btn:disabled{opacity:.6;cursor:default;transform:none}
  .auth-btn .shine{position:absolute;top:0;bottom:0;left:-50%;width:40%;background:linear-gradient(90deg,transparent,rgba(255,255,255,.35),transparent);transform:skewX(-20deg)}
  .auth-btn.busy .shine{animation:sweep 1.1s linear infinite}
  @keyframes sweep{from{left:-50%}to{left:130%}}

  .status-line{
    margin-top:16px;text-align:center;font-size:11px;font-family:'JetBrains Mono',monospace;
    direction:ltr;letter-spacing:.06em;color:var(--ink-faint);min-height:16px;transition:color .3s;
  }
  .status-line.ok{color:var(--ok)}
  .status-line.warn{color:var(--warn)}
  .status-line.err{color:var(--danger)}

  .foot{margin-top:22px;display:flex;justify-content:center;gap:14px;font-size:9.5px;color:var(--ink-faint);font-family:'JetBrains Mono',monospace;letter-spacing:.14em;direction:ltr}
  .foot span::before{content:'●';font-size:6px;margin-right:6px;vertical-align:2px}

  .attempts{margin-top:10px;text-align:center;font-size:10.5px;color:var(--ink-faint)}
  .attempts b{color:var(--warn)}

  @media (prefers-reduced-motion:reduce){*{animation-duration:.01ms !important;transition-duration:.01ms !important}}
</style>
</head>
<body>
<div class="aurora" aria-hidden="true"><div class="band b1"></div><div class="band b2"></div><div class="band b3"></div></div>
<div class="stars" aria-hidden="true" id="stars"></div>

<div class="panel-wrap">
  <div class="glass">
    <div class="brand">
      <div class="sigil">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2 2 20h20L12 2z" opacity=".55"/>
          <path d="M12 8.5 5.5 20"/>
          <path d="M12 8.5 18.5 20"/>
          <circle cx="12" cy="16.5" r="1.6" fill="#fff" stroke="none"/>
        </svg>
      </div>
      <h1>VANTA</h1>
      <div class="tagline">CORE&nbsp;CONSOLE</div>
    </div>

    <div class="field">
      <label>نام کاربری <span class="en">OPERATOR ID</span></label>
      <input type="text" id="u" placeholder="operator…" autocomplete="username">
    </div>
    <div class="field">
      <label>رمز عبور <span class="en">ACCESS KEY</span></label>
      <input type="password" id="p" placeholder="••••••••••" autocomplete="current-password">
    </div>

    <button type="button" class="auth-btn" id="authBtn" onclick="doLogin()">
      <span class="shine"></span>
      <span id="btnLabel">ورود به کنسول</span>
    </button>

    <div class="status-line" id="statusLine">SECURE LINK ESTABLISHED</div>
    <div class="attempts" id="attemptsInfo" style="display:none"></div>
  </div>

  <div class="foot"><span>TLS 1.3</span><span>HMAC SESSION</span><span>VANTA CORE</span></div>
</div>

<script>
  // ستاره‌های پس‌زمینه
  (function(){
    var box = document.getElementById('stars');
    for(var i=0;i<40;i++){
      var s = document.createElement('i');
      s.style.left = (Math.random()*100)+'%';
      s.style.top = (Math.random()*100)+'%';
      s.style.animationDelay = (Math.random()*3)+'s';
      s.style.transform = 'scale('+(0.5+Math.random())+')';
      box.appendChild(s);
    }
  })();

  var attemptsLeft = null;
  var authBtn = document.getElementById('authBtn');
  var btnLabel = document.getElementById('btnLabel');
  var statusLine = document.getElementById('statusLine');
  var attemptsInfo = document.getElementById('attemptsInfo');

  async function doLogin(){
    var u = document.getElementById('u').value;
    var p = document.getElementById('p').value;
    if(!u || !p){
      statusLine.textContent = 'MISSING FIELD — INPUT REQUIRED';
      statusLine.className = 'status-line warn';
      return;
    }
    authBtn.classList.add('busy');
    authBtn.disabled = true;
    btnLabel.textContent = 'در حال بررسی…';
    statusLine.textContent = 'VERIFYING CREDENTIALS …';
    statusLine.className = 'status-line';
    try{
      var res = await fetch('api/login', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({username:u, password:p})
      });
      var data = {};
      try{ data = await res.json(); }catch(e){}
      authBtn.classList.remove('busy');
      if(res.status === 429){
        // قفل تلاش ورود (سپر)
        var mins = data.retry_after_minutes || 0;
        authBtn.disabled = true;
        btnLabel.textContent = 'قفل شد';
        statusLine.textContent = 'LOCKED — TOO MANY FAILED ATTEMPTS' + (mins ? (' (' + mins + ' MIN)') : '');
        statusLine.className = 'status-line err';
        attemptsInfo.style.display = 'none';
        return;
      }
      if(!res.ok){
        attemptsLeft = (typeof data.attempts_left === 'number') ? data.attempts_left : null;
        authBtn.disabled = false;
        btnLabel.textContent = 'ورود به کنسول';
        statusLine.textContent = 'ACCESS DENIED — INVALID CREDENTIALS';
        statusLine.className = 'status-line err';
        if(attemptsLeft !== null){
          attemptsInfo.style.display = '';
          attemptsInfo.innerHTML = attemptsLeft > 0
            ? ('تا قفل‌شدن موقت: <b>' + attemptsLeft + '</b> تلاش دیگر')
            : 'حساب برای مدتی قفل شد — بعداً دوباره امتحان کن';
        }
        return;
      }
      btnLabel.textContent = 'دسترسی تایید شد';
      statusLine.textContent = 'ACCESS GRANTED — REDIRECTING';
      statusLine.className = 'status-line ok';
      attemptsInfo.style.display = 'none';
      setTimeout(function(){ location.href = './dashboard'; }, 450);
    }catch(e){
      authBtn.classList.remove('busy');
      authBtn.disabled = false;
      btnLabel.textContent = 'ورود به کنسول';
      statusLine.textContent = 'LINK FAILURE — NETWORK ERROR';
      statusLine.className = 'status-line err';
    }
  }
  document.getElementById('p').addEventListener('keydown', function(e){ if(e.key==='Enter') doLogin(); });
  document.getElementById('u').addEventListener('keydown', function(e){ if(e.key==='Enter') document.getElementById('p').focus(); });
</script>
</body>
</html>`;
}
