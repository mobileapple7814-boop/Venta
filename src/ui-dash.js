/**
 * ui-dash.js — داشبورد مدیریت Vanta Core
 *
 * ساختار صفحات نسبی است (./api/...) تا پنل روی مسیر مخفی ADMIN_PATH
 * کار کند بدون اینکه در مسیرهای دیگر لو برود.
 */

import { AURORA_STYLE } from "./theme.js";

export function dashboardPage() {
  return `<!DOCTYPE html>
<html lang="fa" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex, nofollow">
<title>Vanta — کنسول مدیریت</title>
${AURORA_STYLE}
</head>
<body>
<div id="toastWrap"></div>
<div style="max-width:1100px;margin:0 auto;padding:24px 16px 70px;animation:fadeIn .3s var(--ease)">

  <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:22px;flex-wrap:wrap;gap:12px">
    <div class="vanta-mark">
      <span class="sigil">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M12 2 2 20h20L12 2z" opacity=".55"/>
          <path d="M12 8.5 5.5 20"/><path d="M12 8.5 18.5 20"/>
          <circle cx="12" cy="16.5" r="1.6" fill="#fff" stroke="none"/>
        </svg>
      </span>
      <div>
        <h1>VANTA</h1>
        <div class="sub">CORE CONSOLE</div>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:14px">
      <div class="hdr-meta mono" dir="ltr">
        <span><span class="live-dot"></span><span id="hdrUptime">—</span></span>
        <span id="hdrClock">--:--:--</span>
      </div>
      <button class="btn-ghost" onclick="logout()">خروج</button>
    </div>
  </div>

  <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px;margin-bottom:20px" id="stats"></div>

  <div class="card chart-card">
    <div class="chart-head">
      <label style="margin:0">ترافیک ۲۴ ساعت اخیر (ساعتی)</label>
      <div class="chart-legend">
        <span class="lg"><span class="sw" style="background:var(--c2)"></span> حجم عبوری</span>
        <span class="lg" id="chartPeak"></span>
      </div>
    </div>
    <div class="chart-wrap">
      <svg class="traffic-chart" id="trafficChart" viewBox="0 0 800 150" preserveAspectRatio="none" aria-hidden="true"></svg>
      <div class="chart-tip" id="chartTip"></div>
    </div>
  </div>

  <div class="card" style="margin-bottom:20px;padding:16px">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px">
      <label style="margin:0">شمارنده‌ی درخواست‌های امروز</label>
      <span id="reqUsageText" class="mono" style="font-size:12px;color:var(--ink-dim)"></span>
    </div>
    <div class="meter" style="height:10px">
      <div id="reqUsageBar" style="height:100%;width:0%;background:var(--grad);border-radius:99px;transition:width .4s"></div>
    </div>
    <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;gap:8px;flex-wrap:wrap">
      <div id="reqUsageHistory" class="mono" style="font-size:11px;color:var(--ink-faint)"></div>
      <div style="display:flex;gap:8px;align-items:center">
        <label style="margin:0;font-size:11px">سقف روزانه</label>
        <input id="reqLimitInput" type="number" style="width:110px" value="100000">
        <button class="btn-ghost" onclick="saveRequestLimit()">ذخیره</button>
      </div>
    </div>
  </div>

  <div class="tabs">
    <div class="tab active" data-tab="configs">◈ کانفیگ‌ها</div>
    <div class="tab" data-tab="security">🛡 امنیت و ضد بن</div>
    <div class="tab" data-tab="logs">☰ لاگ اتصال‌ها</div>
    <div class="tab" data-tab="bot">✈ ربات تلگرام</div>
    <div class="tab" data-tab="backup">⇅ بکاپ و بازیابی</div>
  </div>

  <div id="tab-configs">
    <div id="configLoadError" style="display:none;background:rgba(251,113,133,.08);color:var(--danger);border:1px solid rgba(251,113,133,.25);border-radius:12px;padding:10px 14px;margin-bottom:12px;font-size:13px"></div>
    <div class="toolbar">
      <div class="search-wrap">
        <input id="cfgSearch" type="search" placeholder="جستجوی کانفیگ…" oninput="renderConfigRows()">
        <span class="s-ic">⌕</span>
      </div>
      <button class="btn-primary" onclick="openConfigModal()">+ کانفیگ جدید</button>
    </div>
    <div class="card" style="overflow:auto">
      <table>
        <thead><tr>
          <th>نام</th><th>وضعیت</th><th>آنلاین</th><th>مصرف</th><th>انقضا</th><th>عملیات</th>
        </tr></thead>
        <tbody id="configRows"><tr><td colspan="6"><div class="skeleton"></div></td></tr></tbody>
      </table>
    </div>
  </div>

  <div id="tab-security" style="display:none">
    <div class="card card-accent-top" style="padding:20px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div>
          <label style="margin:0;font-size:13px;color:var(--ink)">🧊 کلید پنیک (حالت سرد فوری)</label>
          <div class="hint">با فعال‌شدن، همه‌ی اتصال‌های زنده‌ی VLESS فوراً قطع و هندشیک جدید رد می‌شود؛ پنل و ربات زنده می‌مانند. برای «سردکردن» سرویس در لحظه‌ی خبر بن.</div>
        </div>
        <span id="panicState" class="pill off">غیرفعال</span>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input id="panicMinutes" type="number" min="1" value="30" style="width:100px">
        <span style="font-size:12px;color:var(--ink-dim)">دقیقه</span>
        <button class="btn-primary" onclick="setPanic(true)">فعال‌کردن پنیک</button>
        <button class="btn-ghost ok-btn" onclick="setPanic(false)">خاموش‌کردن</button>
      </div>
    </div>

    <div class="card" style="padding:20px;margin-bottom:16px">
      <label style="margin:0 0 6px;font-size:13px;color:var(--ink)">🚦 سقف ترافیک کل (ضد بن مصرفی)</label>
      <div class="hint" style="margin-bottom:12px">مهم‌ترین علت بن‌شدن اکانت Railway، مصرف ترافیک غیرعادی است. با ست‌کردن سقف، وقتی مجموع ترافیک همه‌ی کانفیگ‌ها به این عدد برسد، رله‌ها به‌صورت خودکار بسته می‌شوند و دیگر بایتِ اضافه‌ای خارج نمی‌شود (پنل زنده می‌ماند). صفر = بی‌سقف.</div>
      <div id="trafficCeilInfo" class="mono" style="font-size:12px;color:var(--ink-dim);margin-bottom:10px"></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        <input id="ceilGb" type="number" min="0" step="0.5" style="width:110px">
        <span style="font-size:12px;color:var(--ink-dim)">گیگابایت</span>
        <button class="btn-primary" onclick="saveCeiling()">ذخیره سقف</button>
      </div>
      <div class="meter" style="margin-top:12px"><i id="ceilBar" style="width:0%"></i></div>
    </div>

    <div class="card" style="padding:20px;margin-bottom:16px">
      <label style="margin:0 0 10px;font-size:13px;color:var(--ink)">⚙ تنظیمات سپر</label>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px">
        <div>
          <label>مسیر مخفی پنل</label>
          <input id="secAdminPath" dir="ltr" class="mono" placeholder="vanta-admin">
          <div class="hint" style="margin-top:4px">آدرس ورود پنل: https://دامنه/&lt;مسیر&gt; — فقط همین‌جا لاگین می‌شود؛ بقیه‌ی مسیرها صفحه‌ی قلابی می‌بینند.</div>
        </div>
        <div>
          <label>حداکثر تلاش ورود</label>
          <input id="secLoginAttempts" type="number" min="1" style="width:100%">
          <div class="hint" style="margin-top:4px">بعد از این تعداد رمز غلط، آن IP به‌مدت «مدت قفل» از ورود محروم می‌شود.</div>
        </div>
        <div>
          <label>مدت قفل ورود (دقیقه)</label>
          <input id="secLockMinutes" type="number" min="1" style="width:100%">
        </div>
        <div>
          <label>سقف درخواست/دقیقه (ادمین)</label>
          <input id="secRateLimit" type="number" min="5" style="width:100%">
        </div>
        <div>
          <label>سقف هندشیک/دقیقه (هر IP)</label>
          <input id="secWsRate" type="number" min="5" style="width:100%">
          <div class="hint" style="margin-top:4px">جلوی اسکن/بروت‌فورس روی مسیر WebSocket را می‌گیرد.</div>
        </div>
      </div>
      <div style="display:flex;gap:20px;flex-wrap:wrap;margin-top:14px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin:0">
          <input type="checkbox" id="secStrict" style="width:auto"> مسدودسازی اسکنرها (curl/bot)
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin:0">
          <input type="checkbox" id="secMaskIp" style="width:auto"> ماسک‌کردن IP در لاگ‌ها
        </label>
      </div>
      <div style="display:flex;justify-content:flex-end;margin-top:16px">
        <button class="btn-primary" onclick="saveShieldSettings()">ذخیره تنظیمات سپر</button>
      </div>
    </div>

    <div class="card" style="padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <label style="margin:0;font-size:13px;color:var(--ink)">🧾 رویدادهای امنیتی</label>
        <button class="btn-ghost" onclick="loadSecurityEvents()">بروزرسانی</button>
      </div>
      <div class="card" style="overflow:auto;background:rgba(10,16,32,.4)">
        <table>
          <thead><tr><th>زمان</th><th>نوع</th><th>IP</th><th>جزئیات</th></tr></thead>
          <tbody id="secRows"></tbody>
        </table>
      </div>
    </div>
  </div>

  <div id="tab-logs" style="display:none">
    <div style="margin-bottom:12px;display:flex;gap:8px;align-items:center">
      <label style="margin:0">فیلتر کانفیگ:</label>
      <select id="logFilter" style="width:220px" onchange="loadLogs()"><option value="">همه</option></select>
    </div>
    <div class="card" style="overflow:auto">
      <table>
        <thead><tr><th>زمان</th><th>کانفیگ</th><th>IP</th><th>مقصد</th><th>حجم</th></tr></thead>
        <tbody id="logRows"></tbody>
      </table>
    </div>
  </div>

  <div id="tab-bot" style="display:none">
    <div class="card" style="padding:20px;margin-bottom:16px">
      <div style="margin-bottom:14px"><label>توکن ربات (از BotFather)</label><input id="botToken" placeholder="123456:ABC-..."></div>
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
        <input type="checkbox" id="botEnabled" style="width:auto">
        <label style="margin:0">ربات فعال باشد</label>
      </div>
      <button class="btn-primary" onclick="saveBotSettings()">ذخیره و اتصال Webhook</button>
      <div id="botStatus" class="mono" style="margin-top:14px;font-size:12px;color:var(--ink-dim)"></div>
    </div>
    <div class="card" style="padding:20px;margin-bottom:16px">
      <label>افزودن ادمین (آی‌دی عددی تلگرام)</label>
      <div style="display:flex;gap:8px">
        <input id="newAdminId">
        <button class="btn-ghost" onclick="addBotAdmin()">افزودن</button>
      </div>
      <div id="adminList" style="margin-top:12px"></div>
    </div>
    <div class="card" style="padding:20px;margin-bottom:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <label style="margin:0">ارسال پیام همگانی</label>
        <select id="broadcastTarget" style="width:170px">
          <option value="all">همه‌ی اعضا</option>
          <option value="admins">فقط ادمین‌ها</option>
        </select>
      </div>
      <textarea id="broadcastText" rows="4" placeholder="متن پیام..." style="width:100%;resize:vertical"></textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:10px">
        <button class="btn-primary" id="broadcastBtn" onclick="sendBroadcast()">ارسال</button>
      </div>
      <div id="broadcastStatus" class="mono" style="font-size:12px;color:var(--ink-dim);margin-top:8px"></div>
    </div>
    <div class="card" style="padding:20px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <label style="margin:0" id="memberCount"></label>
        <button class="btn-ghost" onclick="loadBotMembers()">بروزرسانی</button>
      </div>
      <div style="overflow-x:auto">
        <table>
          <thead><tr><th>نام</th><th>یوزرنیم</th><th>آی‌دی</th><th>آخرین بازدید</th><th></th></tr></thead>
          <tbody id="memberRows"></tbody>
        </table>
      </div>
    </div>
  </div>

  <div id="dmModal" class="modal-bg" style="display:none">
    <div class="card" style="width:100%;max-width:380px;padding:20px">
      <label>پیام به <span id="dmTargetLabel" class="mono"></span></label>
      <textarea id="dmText" rows="4" style="width:100%;resize:vertical"></textarea>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:12px">
        <button class="btn-ghost" onclick="closeDmModal()">انصراف</button>
        <button class="btn-primary" onclick="sendDm()">ارسال</button>
      </div>
      <div id="dmStatus" class="mono" style="font-size:12px;color:var(--ink-dim);margin-top:8px"></div>
    </div>
  </div>

  <div id="tab-backup" style="display:none">
    <div class="card" style="padding:20px;margin-bottom:16px">
      <div class="hint" style="margin-bottom:12px">یک فایل JSON شامل همه‌ی کانفیگ‌ها، مصرف، تنظیمات ربات و لاگ‌ها دانلود می‌کند.</div>
      <button class="btn-primary" onclick="downloadBackup()">دانلود بکاپ</button>
    </div>
    <div class="card" style="padding:20px">
      <div style="margin-bottom:10px"><label>فایل بکاپ</label><input type="file" id="restoreFile" accept="application/json"></div>
      <div style="display:flex;gap:16px;align-items:center;margin-bottom:14px">
        <label style="margin:0"><input type="radio" name="mode" value="replace" checked style="width:auto"> جایگزینی کامل</label>
        <label style="margin:0"><input type="radio" name="mode" value="merge" style="width:auto"> ادغام</label>
      </div>
      <button class="btn-primary" onclick="doRestore()">بازیابی</button>
      <div id="restoreStatus" class="mono" style="margin-top:12px;font-size:12px"></div>
    </div>
  </div>
</div>

<div id="configModalBg" class="modal-bg" style="display:none">
  <div class="card card-accent-top" style="padding:24px;width:100%;max-width:440px;max-height:90vh;overflow:auto">
    <h3 class="display" id="modalTitle" style="margin:0 0 16px;font-size:17px">کانفیگ جدید</h3>
    <input type="hidden" id="cfgId">
    <div style="margin-bottom:12px"><label>نام</label><input id="cfgName"></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div><label>محدودیت ترافیک (GB، ۰=بی‌نهایت)</label><input id="cfgTraffic" type="number" value="0"></div>
      <div><label>انقضا (روز، ۰=بدون انقضا)</label><input id="cfgExpires" type="number" value="0"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div><label>محدودیت IP هم‌زمان (۰=بی‌نهایت)</label><input id="cfgIpLimit" type="number" value="0"></div>
      <div><label>پورت</label><input id="cfgPort" type="number" value="443"></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:12px">
      <div><label>Fingerprint</label>
        <select id="cfgFp">
          <option value="chrome">chrome</option><option value="firefox">firefox</option>
          <option value="safari">safari</option><option value="ios">ios</option>
          <option value="android">android</option><option value="edge">edge</option>
        </select>
      </div>
      <div><label>ALPN</label><input id="cfgAlpn" value="http/1.1"></div>
    </div>
    <div style="margin-bottom:12px">
      <label>پروکسی‌های خروجی (SOCKS5 یا HTTP — اختیاری، هر خط یکی)</label>
      <textarea id="cfgProxies" dir="ltr" rows="3" placeholder="socks5://user:pass@1.2.3.4:1080" class="mono" style="width:100%;resize:vertical"></textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:6px">
        <button type="button" class="btn-ghost" onclick="openProxyPicker()">انتخاب از لیست</button>
      </div>
      <div class="hint" style="margin-top:4px">اگر پر شود، هر اتصال خروجی این کانفیگ به‌طور تصادفی از یکی از این پروکسی‌ها رد می‌شود؛ خالی بگذارید برای اتصال مستقیم.</div>
    </div>
    <div style="margin-bottom:6px">
      <label>آی‌پی‌های تمیز (اختیاری)</label>
      <textarea id="cfgCleanIps" dir="ltr" rows="3" placeholder="104.16.1.1" class="mono" style="width:100%;resize:vertical"></textarea>
      <div class="hint" style="margin-top:4px">هر خط یک IP یا دامنه؛ برای هرکدام یک لینک جدا ساخته می‌شود (آدرس اتصال عوض می‌شود، SNI همان دامنه‌ی سرویس می‌ماند). خالی = آی‌پی‌های پیش‌فرض.</div>
      <div style="display:flex;justify-content:space-between;gap:8px;margin-top:8px;flex-wrap:wrap">
        <button type="button" class="btn-ghost" onclick="testCleanIps()" id="testIpsBtn">تست آی‌پی‌ها</button>
        <button type="button" class="btn-ghost" onclick="openCleanIpPicker()">انتخاب از لیست / اسکن</button>
      </div>
      <div id="cleanIpsTestResult" class="mono" style="font-size:11px;margin-top:6px;display:flex;flex-direction:column;gap:3px"></div>
      <div id="autoRotateSummary" class="mono" style="font-size:11px;color:var(--c1);margin-top:6px"></div>
      <input type="hidden" id="cfgIpOperator" value="all">
      <input type="hidden" id="cfgIpCount" value="20">
      <input type="hidden" id="cfgAutoRotate" value="0">
      <input type="hidden" id="cfgRotateMinutes" value="0">
    </div>
    <div style="margin-bottom:6px">
      <label>مسدودسازی (این کانفیگ نتواند به این آدرس‌ها وصل شود)</label>
      <textarea id="cfgBlocklist" dir="ltr" rows="3" placeholder="example.com&#10;1.2.3.0/24" class="mono" style="width:100%;resize:vertical"></textarea>
      <div class="hint" style="margin-top:4px">هر خط یک دامنه (زیردامنه‌ها هم مسدود می‌شوند)، یک آی‌پی، یا یک رنج CIDR.</div>
    </div>
    <div style="margin-bottom:6px">
      <label>لوکیشن (برچسب نمایشی روی اسم لینک‌ها — اختیاری)</label>
      <select id="cfgLocation" style="width:100%"></select>
      <div class="hint" style="margin-top:4px">فقط پرچم/کشورِ نمایشی است؛ با «انتخاب از لیست» به‌طور خودکار با کشورِ پروکسی‌های انتخاب‌شده هماهنگ می‌شود.</div>
    </div>
    <div style="display:flex;gap:10px;margin-top:18px">
      <button class="btn-primary" style="flex:1" onclick="saveConfig()">ذخیره</button>
      <button class="btn-ghost" style="flex:1" onclick="closeConfigModal()">انصراف</button>
    </div>
  </div>
</div>

<div id="linkModalBg" class="modal-bg" style="display:none">
  <div class="card card-accent-top" style="padding:24px;width:100%;max-width:470px;max-height:90vh;overflow:auto">
    <h3 class="display" style="margin:0 0 6px;font-size:17px">لینک اتصال</h3>
    <div id="linkCount" class="mono" style="font-size:11px;color:var(--ink-dim);margin-bottom:8px"></div>
    <textarea id="linkText" readonly class="mono" style="width:100%;height:120px;font-size:12px;resize:vertical"></textarea>
    <div id="qrBox"></div>
    <div style="display:flex;gap:10px;margin-top:14px;flex-wrap:wrap">
      <button class="btn-primary" style="flex:1" onclick="copyLink()">کپی</button>
      <button class="btn-ghost" style="flex:1" onclick="downloadLinkTxt()">دانلود txt</button>
      <button class="btn-ghost" style="flex:1" onclick="document.getElementById('linkModalBg').style.display='none'">بستن</button>
    </div>
  </div>
</div>

<div id="proxyPickerBg" class="modal-bg" style="display:none">
  <div class="card" style="padding:24px;width:100%;max-width:440px;max-height:85vh;overflow:auto">
    <h3 class="display" style="margin:0 0 16px;font-size:17px">انتخاب پروکسی از لیست</h3>
    <div style="margin-bottom:14px">
      <label>آدرس لیست پروکسی (هر خط یک پروکسی — می‌تواند شامل {country} باشد)</label>
      <div style="display:flex;gap:8px">
        <input id="proxyListUrl" dir="ltr" placeholder="https://.../proxies-{country}.txt" class="mono" style="flex:1">
        <button type="button" class="btn-ghost" onclick="saveProxyListUrl()">ذخیره</button>
      </div>
    </div>
    <div style="margin-bottom:14px">
      <label>لوکیشن</label>
      <select id="proxyPickerCountry" onchange="fetchProxyList()" style="width:100%"></select>
    </div>
    <div style="display:flex;gap:8px;align-items:flex-end;justify-content:space-between;margin-bottom:10px;flex-wrap:wrap">
      <button type="button" class="btn-primary" onclick="fetchProxyList()" id="fetchProxyListBtn">دریافت لیست</button>
      <div style="display:flex;gap:8px;align-items:flex-end">
        <div>
          <label style="font-size:11px">تعداد</label>
          <input id="proxyPickCount" type="number" min="1" value="20" style="width:80px">
        </div>
        <button type="button" class="btn-ghost" onclick="pickRandomProxies()">انتخاب تصادفی</button>
      </div>
    </div>
    <div id="proxyListStatus" class="mono" style="font-size:12px;color:var(--ink-dim);margin-bottom:8px"></div>
    <div id="proxyListRows" style="display:flex;flex-direction:column;gap:6px"></div>
    <div style="display:flex;gap:10px;margin-top:18px">
      <button class="btn-ghost" style="flex:1" onclick="closeProxyPicker()">بستن</button>
    </div>
  </div>
</div>

<div id="cleanIpPickerBg" class="modal-bg" style="display:none">
  <div class="card" style="padding:24px;width:100%;max-width:440px;max-height:85vh;overflow:auto">
    <h3 class="display" style="margin:0 0 16px;font-size:17px">انتخاب آی‌پی تمیز</h3>
    <div style="border-top:1px solid var(--line);padding-top:14px;margin-bottom:14px">
      <label>اسکن خودکار از رنج‌های رسمی Cloudflare</label>
      <div class="hint" style="margin-bottom:8px">فقط وقتی جواب می‌دهد که دامنه‌ی سرویس از طریق Cloudflare (ابر نارنجی) پراکسی شده باشد.</div>
      <div style="display:flex;gap:8px;align-items:flex-end;flex-wrap:wrap">
        <div>
          <label style="font-size:11px">چند آی‌پی پیدا شود</label>
          <input id="scanWantInput" type="number" min="1" max="50" value="10" style="width:100px">
        </div>
        <button type="button" class="btn-primary" onclick="scanCleanIpsNow()" id="scanIpsBtn">اسکن و پیدا کردن</button>
      </div>
      <div id="scanIpsStatus" class="mono" style="font-size:11px;color:var(--ink-dim);margin-top:8px"></div>
      <div id="scanIpsResult" class="mono" style="font-size:11px;margin-top:6px;display:flex;flex-direction:column;gap:3px"></div>
    </div>
    <div style="margin-bottom:14px">
      <label>یا از یک لیست آماده (بلوک‌های جداشده با ----------، هر بلوک با خط # نام‌گروه)</label>
      <div style="display:flex;gap:8px">
        <input id="cleanIpListUrl" dir="ltr" placeholder="https://.../ips.txt" class="mono" style="flex:1">
        <button type="button" class="btn-ghost" onclick="saveCleanIpListUrl()">ذخیره</button>
      </div>
    </div>
    <div style="margin-bottom:14px">
      <label>اپراتور / گروه</label>
      <select id="ipOperatorSelect" style="width:100%"><option value="all">همه (توصیه‌شده)</option></select>
    </div>
    <div style="display:flex;gap:8px;align-items:flex-end;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap">
      <button type="button" class="btn-primary" onclick="fetchCleanIpOperators()" id="fetchCleanIpsBtn">دریافت لیست</button>
      <div>
        <label style="font-size:11px">تعداد آی‌پی</label>
        <input id="ipCountInput" type="number" min="1" value="20" style="width:100px">
      </div>
    </div>
    <div style="border-top:1px solid var(--line);padding-top:14px;margin-bottom:14px">
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer">
        <input type="checkbox" id="autoRotateToggle" onchange="toggleAutoRotateInputs()" style="width:auto">
        چرخش خودکار آی‌پی‌ها (هر چند دقیقه، N آی‌پی تصادفی جایگزین می‌شود)
      </label>
      <div id="autoRotateMinutesWrap" style="margin-top:8px;display:none">
        <label style="font-size:11px">هر چند دقیقه</label>
        <input id="autoRotateMinutes" type="number" min="1" value="60" style="width:120px">
      </div>
    </div>
    <div id="cleanIpListStatus" class="mono" style="font-size:12px;color:var(--ink-dim);margin-bottom:14px"></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <button class="btn-primary" style="flex:1" onclick="applySelectedCleanIps()">اعمال</button>
      <button class="btn-ghost" style="flex:1" onclick="closeCleanIpPicker()">بستن</button>
    </div>
  </div>
</div>
<script src="../qrcode.min.js"></script>
<script>
let CONFIGS = [];

// آدرس پنل نسبت به مسیر فعلی (dashboard داخل ADMIN_PATH است) — همه‌ی
// فراخوانی‌های API نسبت به همین مبنا می‌روند تا مسیر مخفی کار کند.
const API = '../api/';

function toast(msg, kind){
  const wrap = document.getElementById('toastWrap');
  const el = document.createElement('div');
  el.className = 'toast ' + (kind || '');
  el.innerHTML = '<span>' + (kind==='ok' ? '✓' : kind==='err' ? '✕' : '›') + '</span><span></span>';
  el.lastElementChild.textContent = msg;
  wrap.appendChild(el);
  setTimeout(()=>{ el.classList.add('hide'); setTimeout(()=>el.remove(), 350); }, 3200);
}

function tickClock(){
  const n = new Date();
  const p = x => String(x).padStart(2,'0');
  document.getElementById('hdrClock').textContent = p(n.getHours())+':'+p(n.getMinutes())+':'+p(n.getSeconds());
}
tickClock(); setInterval(tickClock, 1000);
function fmtUptime(sec){
  if(!sec && sec!==0) return '—';
  const d = Math.floor(sec/86400), h = Math.floor(sec%86400/3600), m = Math.floor(sec%3600/60);
  return (d ? d+'d ' : '') + h+'h '+m+'m';
}

document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
  document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));
  t.classList.add('active');
  ['configs','security','logs','bot','backup'].forEach(name=>{
    document.getElementById('tab-'+name).style.display = (name===t.dataset.tab)?'':'none';
  });
  if(t.dataset.tab==='logs') loadLogs();
  if(t.dataset.tab==='security') loadSecurityTab();
  if(t.dataset.tab==='bot'){ loadBotSettings(); loadBotMembers(); }
}));

function fmtBytes(n){
  if(!n) return '0 B';
  const units=['B','KB','MB','GB','TB']; let i=0; let v=n;
  while(v>=1024 && i<units.length-1){ v/=1024; i++; }
  return v.toFixed(v>=10||i===0?0:1)+' '+units[i];
}
function fmtDate(ts){ if(!ts) return '—'; return new Date(ts*1000).toLocaleString('fa-IR'); }

async function api(path, opts={}){
  const res = await fetch(API + path, {headers:{'Content-Type':'application/json'}, ...opts});
  if(res.status===401){ location.href='./'; throw new Error('unauthorized'); }
  const data = await res.json().catch(()=>({}));
  if(!res.ok) throw new Error(data.detail||'خطا');
  return data;
}

async function logout(){ await api('logout', {method:'POST'}); location.href='./'; }

// شمارنده‌ی متحرک عدد
function animateNum(el, target, fmt){
  const from = parseFloat(el.dataset.v || '0') || 0;
  if(from === target){ el.textContent = fmt(target); return; }
  const t0 = performance.now(), dur = 500;
  function step(t){
    const k = Math.min(1, (t - t0)/dur);
    const eased = 1 - Math.pow(1-k, 3);
    el.textContent = fmt(from + (target-from)*eased);
    if(k < 1) requestAnimationFrame(step);
    else el.dataset.v = String(target);
  }
  el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop');
  requestAnimationFrame(step);
  el.dataset.v = String(target);
}

// نمودار ترافیک ۲۴ ساعته (SVG منحنی نرم)
function renderTrafficChart(series){
  const svg = document.getElementById('trafficChart');
  if(!svg) return;
  const W = 800, H = 150, PAD = 4;
  const data = (series || []).map(s => s.bytes || 0);
  const max = Math.max(...data, 1);
  const n = data.length || 24;
  const stepX = (W - PAD*2) / Math.max(1, n-1);
  const pts = data.map((v,i) => [PAD + i*stepX, H - PAD - (v/max)*(H-PAD*2-14)]);
  let grid = '', labels = '';
  for(let g=1; g<=3; g++){
    const y = (H/4)*g;
    grid += '<line class="gridline" x1="0" y1="'+y+'" x2="'+W+'" y2="'+y+'"/>';
  }
  data.forEach((v,i)=>{
    if(i % 6 === 0){
      const d = new Date(Date.now() - (n-1-i)*3600*1000);
      labels += '<text class="axis-label" x="'+pts[i][0]+'" y="'+(H-1)+'" text-anchor="middle">'+String(d.getHours()).padStart(2,'0')+':00</text>';
    }
  });
  let defs = '<defs>' +
    '<linearGradient id="vantaGrad" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0%" stop-color="#818CF8" stop-opacity=".65"/><stop offset="100%" stop-color="#818CF8" stop-opacity="0"/>' +
    '</linearGradient>' +
    '<linearGradient id="vantaLine" x1="0" y1="0" x2="1" y2="0">' +
      '<stop offset="0%" stop-color="#22D3EE"/><stop offset="50%" stop-color="#818CF8"/><stop offset="100%" stop-color="#E879F9"/>' +
    '</linearGradient></defs>';
  let line = '', area = '';
  if(pts.length){
    line = 'M' + pts.map(p => p[0].toFixed(1)+','+p[1].toFixed(1)).join(' L');
    area = line + ' L'+pts[pts.length-1][0].toFixed(1)+','+(H-14)+' L'+pts[0][0].toFixed(1)+','+(H-14)+' Z';
  }
  const last = pts[pts.length-1];
  const dot = last ? ('<circle class="dot-glow" cx="'+last[0]+'" cy="'+last[1]+'" r="7"/>' +
    '<circle class="dot" cx="'+last[0]+'" cy="'+last[1]+'" r="3"/>') : '';
  svg.innerHTML = defs + grid + '<path class="area" d="'+area+'"/><path class="line" d="'+line+'"/>' + labels + dot;
  const peak = document.getElementById('chartPeak');
  if(peak) peak.innerHTML = 'اوج: <b style="color:var(--c3)">'+fmtBytes(max)+'</b>/h';

  const tip = document.getElementById('chartTip');
  svg.onmousemove = (e) => {
    const rect = svg.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * W;
    let idx = Math.round((x - PAD)/stepX);
    idx = Math.max(0, Math.min(n-1, idx));
    const d = new Date(Date.now() - (n-1-idx)*3600*1000);
    tip.innerHTML = '<div class="t">'+String(d.getHours()).padStart(2,'0')+':00 — '+fmtBytes(data[idx])+'</div>';
    tip.style.display = 'block';
    const tx = Math.min(rect.width - 90, Math.max(4, (pts[idx][0]/W)*rect.width - 40));
    tip.style.left = tx + 'px';
    tip.style.top = '0px';
  };
  svg.onmouseleave = () => { tip.style.display = 'none'; };
}

// کارت‌های آمار
let prevStats = { online: 0 };
async function loadStats(){
  const s = await api('stats');
  const onlineDelta = (s.online||0) - (prevStats.online||0);
  const trendUp = onlineDelta >= 0;
  document.getElementById('stats').innerHTML = \`
    <div class="card stat"><div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="url(#g1)" stroke-width="2"><defs><linearGradient id="g1"><stop offset="0" stop-color="#22D3EE"/><stop offset="1" stop-color="#818CF8"/></linearGradient></defs><rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/></svg></div><div class="num" id="stCfg">0</div><div class="lbl">کانفیگ (\${s.active_configs||0} فعال)</div></div>
    <div class="card stat"><div class="stat-icon" style="border-color:rgba(52,211,153,.4)"><svg viewBox="0 0 24 24" fill="none" stroke="#34D399" stroke-width="2"><path d="M13 2 4 14h6l-1 8 9-12h-6z"/></svg></div><div class="num" style="color:var(--ok)" id="stOnline">0</div><div class="lbl">آنلاین <span id="stTrend" style="font-size:11px;\${onlineDelta!==0?('color:'+(trendUp?'var(--ok)':'var(--danger)')):''}">\${onlineDelta!==0?((trendUp?'▲ +':'▼ ')+onlineDelta):''}</span></div></div>
    <div class="card stat"><div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#E879F9" stroke-width="2"><path d="M3 17l5-5 4 4 8-8"/><path d="M15 8h5v5"/></svg></div><div class="num" id="stTraffic">0</div><div class="lbl">ترافیک کل\${s.total_limit_bytes ? ' / '+fmtBytes(s.total_limit_bytes) : ''}</div></div>
    <div class="card stat"><div class="stat-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#22D3EE" stroke-width="2"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><circle cx="7" cy="7" r=".8" fill="currentColor"/><circle cx="7" cy="17" r=".8" fill="currentColor"/></svg></div><div class="num mono" style="font-size:15px" id="stBackend">—</div><div class="lbl">بک‌اند · <span id="stUptime">—</span></div></div>
  \`;
  animateNum(document.getElementById('stCfg'), s.config_count||0, v=>Math.round(v).toString());
  animateNum(document.getElementById('stOnline'), s.online||0, v=>Math.round(v).toString());
  animateNum(document.getElementById('stTraffic'), s.total_used_bytes||0, v=>fmtBytes(v));
  document.getElementById('stBackend').textContent = s.backend || 'redis';
  document.getElementById('stUptime').textContent = fmtUptime(s.uptime_sec);
  const upEl = document.getElementById('hdrUptime');
  if(upEl) upEl.textContent = 'UP ' + fmtUptime(s.uptime_sec);
  prevStats = { online: s.online||0 };
  renderRequestUsage(s);
  renderTrafficChart(s.traffic_series);
}

function renderRequestUsage(s){
  const used = s.requests_today || 0;
  const limit = s.requests_limit || 100000;
  const pct = Math.min(100, (used/limit)*100);
  const bar = document.getElementById('reqUsageBar');
  bar.style.width = pct.toFixed(1)+'%';
  bar.className = pct >= 90 ? 'over' : (pct >= 70 ? 'hot' : '');
  bar.style.background = '';
  if(pct >= 90){ bar.style.background = 'linear-gradient(90deg,#FB7185,#EF4444)'; }
  else if(pct >= 70){ bar.style.background = 'linear-gradient(90deg,#FBBF24,#F97316)'; }
  document.getElementById('reqUsageText').textContent = used.toLocaleString('en-US')+' / '+limit.toLocaleString('en-US')+' ('+pct.toFixed(1)+'%)';
  const limitInput = document.getElementById('reqLimitInput');
  if(document.activeElement !== limitInput) limitInput.value = limit;
  const hist = s.requests_history || [];
  document.getElementById('reqUsageHistory').textContent = hist.map(h => h.day.slice(5)+': '+h.count.toLocaleString('en-US')).join('   |   ');
}

async function saveRequestLimit(){
  const val = parseInt(document.getElementById('reqLimitInput').value, 10);
  if(!val || val < 1) return;
  await api('request-limit', {method:'POST', body: JSON.stringify({limit: val})});
  toast('سقف روزانه ذخیره شد', 'ok');
  loadStats();
}

async function loadConfigs(){
  let data;
  try{
    data = await api('configs');
  }catch(e){
    // خطای واضح به‌جای جدولِ خالیِ گمراه‌کننده
    const banner = document.getElementById('configLoadError');
    if(banner){ banner.style.display='block'; banner.textContent = 'خطا در دریافت لیست کانفیگ‌ها (داده‌ها پاک نشدند؛ فقط بارگذاری شکست خورد): ' + e.message; }
    return;
  }
  const banner = document.getElementById('configLoadError');
  if(banner) banner.style.display='none';
  CONFIGS = data.configs;
  const sel = document.getElementById('logFilter');
  sel.innerHTML = '<option value="">همه</option>' + CONFIGS.map(c=>\`<option value="\${c.id}">\${escHtml(c.name)}</option>\`).join('');
  renderConfigRows();
}

// رندر جدول با جستجو — جدا از loadConfigs تا تایپ در جستجو باعث
// درخواست مجدد به سرور نشود.
function renderConfigRows(){
  const q = (document.getElementById('cfgSearch')?.value || '').trim().toLowerCase();
  const rows = CONFIGS.filter(c => !q || c.name.toLowerCase().includes(q) || (c.location||'').toLowerCase().includes(q));
  const tbody = document.getElementById('configRows');
  if(!rows.length){
    tbody.innerHTML = '<tr><td colspan="6" class="empty-note">'+(q ? 'چیزی مطابق جستجو پیدا نشد' : 'هنوز کانفیگی نساختی — با «کانفیگ جدید» شروع کن')+'</td></tr>';
    return;
  }
  tbody.innerHTML = rows.map(c=>{
    const usedPct = c.traffic_limit_bytes ? Math.min(100, (c.used_bytes/c.traffic_limit_bytes)*100) : 0;
    const barCls = usedPct >= 90 ? 'over' : (usedPct >= 70 ? 'hot' : '');
    const flag = c.location ? '<span class="flag-badge">'+flagEmoji(c.location)+'</span>' : '';
    const nameHtml = escHtml(c.name);
    return \`
    <tr>
      <td><span class="cfg-name">\${flag}\${nameHtml}</span>\${c.traffic_limit_bytes?('<div class="cfg-usage-bar"><i class="'+barCls+'" style="width:'+usedPct.toFixed(1)+'%"></i></div>'):''}</td>
      <td><span class="pill \${c.enabled?'on':'off'}">\${c.enabled?'فعال':'غیرفعال'}</span></td>
      <td>\${c.online}</td>
      <td>\${fmtBytes(c.used_bytes)}\${c.traffic_limit_bytes?' / '+fmtBytes(c.traffic_limit_bytes):''}</td>
      <td>\${fmtDate(c.expires_at)}</td>
      <td style="white-space:nowrap">
        <div class="row-actions">
          <button class="btn-ghost" onclick="showLink('\${c.id}')">لینک</button>
          <button class="btn-ghost" onclick="showSub('\${c.id}')">ساب</button>
          <button class="btn-ghost" onclick="editConfig('\${c.id}')">ویرایش</button>
          <button class="btn-ghost" onclick="toggleConfig('\${c.id}', \${!c.enabled})">\${c.enabled?'خاموش':'روشن'}</button>
          <button class="btn-ghost" onclick="resetUsage('\${c.id}')">ریست</button>
          <button class="btn-ghost" onclick="filterLogsFor('\${c.id}')">لاگ</button>
          <button class="btn-ghost danger" onclick="deleteConfig('\${c.id}')">حذف</button>
        </div>
      </td>
    </tr>\`;
  }).join('');
}

function filterLogsFor(id){
  document.querySelector('.tab[data-tab=logs]').click();
  document.getElementById('logFilter').value = id;
  loadLogs();
}

async function loadLogs(){
  const cid = document.getElementById('logFilter').value;
  const data = await api('logs'+(cid?('?config_id='+cid):''));
  document.getElementById('logRows').innerHTML = data.logs.map(l=>\`
    <tr><td class="mono">\${fmtDate(l.ts)}</td><td>\${escHtml(l.config_name||'')}</td><td class="mono" dir="ltr">\${escHtml(l.ip||'')}</td>
    <td class="mono" dir="ltr">\${escHtml(l.address||'')}:\${l.port}</td><td>\${fmtBytes(l.bytes)}</td></tr>\`).join('') || '<tr><td colspan="5" class="empty-note">رکوردی نیست</td></tr>';
}

// لیست کشورهای رایج (کد ۲ حرفی ISO)
const COUNTRIES = [
  ["DE", "آلمان"], ["NL", "هلند"], ["FR", "فرانسه"],
  ["GB", "بریتانیا"], ["US", "آمریکا"], ["CA", "کانادا"], ["TR", "ترکیه"], ["AE", "امارات"],
  ["SG", "سنگاپور"], ["JP", "ژاپن"], ["FI", "فنلاند"], ["SE", "سوئد"], ["RU", "روسیه"],
  ["IN", "هند"], ["AU", "استرالیا"], ["BR", "برزیل"], ["ES", "اسپانیا"], ["IT", "ایتالیا"],
  ["PL", "لهستان"], ["CH", "سوئیس"],
];
function flagEmoji(cc){
  if(!cc) return '🌐';
  const up = String(cc).toUpperCase().replace(/[^A-Z]/g,'');
  if(up.length!==2) return '🌐';
  const pts = [...up].map(c=>127397+c.charCodeAt(0));
  return String.fromCodePoint.apply(null, pts);
}
function fillCountrySelect(el, mode){
  const special = mode === 'fetch' ? [["ALL", "🌐 همه"]] : [["", "بدون برچسب"]];
  const rows = special.concat(COUNTRIES);
  el.innerHTML = rows.map(([code,name])=>{
    const label = code && code!=='ALL' ? (flagEmoji(code)+' '+name+' ('+code+')') : name;
    return '<option value="'+code+'">'+label+'</option>';
  }).join('');
}

function escHtml(s){
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
</script>
<script>
function openConfigModal(){
  document.getElementById('modalTitle').textContent='کانفیگ جدید';
  document.getElementById('cfgId').value='';
  document.getElementById('cfgName').value='';
  document.getElementById('cfgTraffic').value=0;
  document.getElementById('cfgExpires').value=0;
  document.getElementById('cfgIpLimit').value=0;
  document.getElementById('cfgPort').value=443;
  document.getElementById('cfgFp').value='chrome';
  document.getElementById('cfgAlpn').value='http/1.1';
  document.getElementById('cfgProxies').value='';
  document.getElementById('cfgCleanIps').value='';
  document.getElementById('cfgBlocklist').value='';
  document.getElementById('cleanIpsTestResult').innerHTML='';
  document.getElementById('cfgIpOperator').value='all';
  document.getElementById('cfgIpCount').value='20';
  document.getElementById('cfgAutoRotate').value='0';
  document.getElementById('cfgRotateMinutes').value='0';
  updateAutoRotateSummary();
  fillCountrySelect(document.getElementById('cfgLocation'), 'location');
  document.getElementById('cfgLocation').value='';
  document.getElementById('configModalBg').style.display='flex';
}
function closeConfigModal(){ document.getElementById('configModalBg').style.display='none'; }

function editConfig(id){
  const c = CONFIGS.find(x=>x.id===id);
  if(!c) return;
  document.getElementById('modalTitle').textContent='ویرایش کانفیگ';
  document.getElementById('cfgId').value=c.id;
  document.getElementById('cfgName').value=c.name;
  document.getElementById('cfgTraffic').value=(c.traffic_limit_bytes/1073741824)||0;
  document.getElementById('cfgExpires').value = c.expires_at ? Math.max(1, Math.ceil((c.expires_at - Date.now()/1000)/86400)) : 0;
  document.getElementById('cfgIpLimit').value=c.ip_limit||0;
  document.getElementById('cfgPort').value=c.port||443;
  document.getElementById('cfgFp').value=c.fingerprint||'chrome';
  document.getElementById('cfgAlpn').value=c.alpn||'http/1.1';
  document.getElementById('cfgProxies').value=(c.proxies||[]).join('\\n');
  document.getElementById('cfgCleanIps').value=(c.clean_ips||[]).join('\\n');
  document.getElementById('cfgBlocklist').value=(c.blocklist||[]).join('\\n');
  document.getElementById('cleanIpsTestResult').innerHTML='';
  document.getElementById('cfgIpOperator').value=c.ip_operator||'all';
  document.getElementById('cfgIpCount').value=c.ip_count||20;
  document.getElementById('cfgAutoRotate').value=c.auto_rotate_ip?'1':'0';
  document.getElementById('cfgRotateMinutes').value=c.rotate_minutes||0;
  updateAutoRotateSummary();
  fillCountrySelect(document.getElementById('cfgLocation'), 'location');
  document.getElementById('cfgLocation').value=c.location||'';
  document.getElementById('configModalBg').style.display='flex';
}

async function saveConfig(){
  const id = document.getElementById('cfgId').value;
  const body = {
    name: document.getElementById('cfgName').value,
    traffic_limit_gb: parseFloat(document.getElementById('cfgTraffic').value||0),
    expires_days: parseInt(document.getElementById('cfgExpires').value||0),
    ip_limit: parseInt(document.getElementById('cfgIpLimit').value||0),
    port: parseInt(document.getElementById('cfgPort').value||443),
    fingerprint: document.getElementById('cfgFp').value,
    alpn: document.getElementById('cfgAlpn').value,
    proxies: document.getElementById('cfgProxies').value,
    clean_ips: document.getElementById('cfgCleanIps').value,
    location: document.getElementById('cfgLocation').value,
    ip_operator: document.getElementById('cfgIpOperator').value,
    ip_count: parseInt(document.getElementById('cfgIpCount').value||20),
    auto_rotate_ip: document.getElementById('cfgAutoRotate').value==='1',
    rotate_minutes: parseInt(document.getElementById('cfgRotateMinutes').value||0),
    blocklist: document.getElementById('cfgBlocklist').value,
  };
  if(id){
    await api('configs/'+id, {method:'PATCH', body: JSON.stringify(body)});
  } else {
    await api('configs', {method:'POST', body: JSON.stringify(body)});
  }
  toast(id ? 'کانفیگ به‌روزرسانی شد' : 'کانفیگ ساخته شد', 'ok');
  closeConfigModal();
  await Promise.all([loadConfigs(), loadStats()]);
}

async function toggleConfig(id, enabled){
  await api('configs/'+id, {method:'PATCH', body: JSON.stringify({enabled})});
  toast(enabled ? 'کانفیگ روشن شد' : 'کانفیگ خاموش شد', 'ok');
  loadConfigs();
}
async function resetUsage(id){
  await api('configs/'+id, {method:'PATCH', body: JSON.stringify({reset_usage:true})});
  toast('مصرف ریست شد', 'ok');
  loadConfigs(); loadStats();
}
async function deleteConfig(id){
  if(!confirm('این کانفیگ حذف شود؟')) return;
  await api('configs/'+id, {method:'DELETE'});
  toast('کانفیگ حذف شد', 'ok');
  loadConfigs(); loadStats();
}

// ── تست آی‌پی تمیز ──────────────────────────────────────────────────
async function testCleanIps(){
  const raw = document.getElementById('cfgCleanIps').value;
  const ips = raw.split(/[\\n,]+/).map(s=>s.trim()).filter(Boolean);
  const box = document.getElementById('cleanIpsTestResult');
  if(!ips.length){ box.innerHTML = '<div style="color:var(--ink-dim)">چیزی برای تست وارد نشده</div>'; return; }
  const btn = document.getElementById('testIpsBtn');
  btn.disabled = true; btn.textContent = 'در حال تست...';
  box.innerHTML = ips.map(ip=>'<div id="testrow-'+cssEsc(ip)+'">⏳ '+ip+' — در حال بررسی…</div>').join('');
  await Promise.all(ips.map(async ip=>{
    const row = document.getElementById('testrow-'+cssEsc(ip));
    try{
      const data = await api('test-clean-ip', {method:'POST', body: JSON.stringify({ip})});
      if(data.ok){ row.innerHTML = '✅ '+ip+' — سالم ('+data.ms+'ms)'; row.style.color='var(--ok)'; }
      else { row.innerHTML = '❌ '+ip+' — '+(data.error || ('کد '+data.status)); row.style.color='var(--danger)'; }
    }catch(e){ row.innerHTML = '❌ '+ip+' — خطا'; row.style.color='var(--danger)'; }
  }));
  btn.disabled = false; btn.textContent = 'تست آی‌پی‌ها';
}
function cssEsc(s){ return s.replace(/[^a-zA-Z0-9_-]/g, m => '_'+m.charCodeAt(0)+'_'); }

// ── انتخاب پروکسی از لیست ───────────────────────────────────────────
function openProxyPicker(){
  document.getElementById('proxyPickerBg').style.display='flex';
  document.getElementById('proxyListRows').innerHTML='';
  document.getElementById('proxyListStatus').textContent='';
  fillCountrySelect(document.getElementById('proxyPickerCountry'), 'fetch');
  const cur = document.getElementById('cfgLocation').value;
  document.getElementById('proxyPickerCountry').value = cur && cur!=='' ? cur : 'ALL';
  loadProxyListUrl();
}
function closeProxyPicker(){ document.getElementById('proxyPickerBg').style.display='none'; }

async function loadProxyListUrl(){
  try{
    const data = await api('proxy-list-url');
    document.getElementById('proxyListUrl').value = data.url || '';
  }catch(e){ /* ignore */ }
}
async function saveProxyListUrl(){
  const url = document.getElementById('proxyListUrl').value.trim();
  await api('proxy-list-url', {method:'POST', body: JSON.stringify({url})});
  document.getElementById('proxyListStatus').textContent = 'ذخیره شد.';
}

async function fetchProxyList(){
  const btn = document.getElementById('fetchProxyListBtn');
  const status = document.getElementById('proxyListStatus');
  const rows = document.getElementById('proxyListRows');
  const country = document.getElementById('proxyPickerCountry').value || 'ALL';
  btn.disabled = true; btn.textContent = 'در حال دریافت...';
  rows.innerHTML = '';
  status.style.color = 'var(--ink-dim)';
  status.textContent = 'در حال دریافت لیست...';
  try{
    const data = await api('proxy-list?country='+encodeURIComponent(country));
    const proxies = data.proxies || [];
    window.PROXY_LIST_CACHE = proxies;
    const flag = flagEmoji(country);
    if(!proxies.length){
      status.textContent = 'لیست خالی بود.';
    } else {
      status.textContent = proxies.length + ' پروکسی ' + flag + ' پیدا شد — یکی را انتخاب کن یا «انتخاب تصادفی»:';
      rows.innerHTML = proxies.map((p, i) => {
        const safe = escHtml(p);
        return '<button type="button" class="btn-ghost mono" style="text-align:left;justify-content:flex-start;direction:ltr;width:100%" onclick="selectProxyIdx('+i+')">'+flag+' '+safe+'</button>';
      }).join('');
    }
  }catch(e){
    status.style.color = 'var(--danger)';
    status.textContent = e.message || 'خطا در دریافت لیست';
  }
  btn.disabled = false; btn.textContent = 'دریافت لیست';
}
function syncLocationFromPicker(){
  const country = document.getElementById('proxyPickerCountry').value;
  if(country && country !== 'ALL'){
    document.getElementById('cfgLocation').value = country;
  }
}
function selectProxyIdx(i){
  const p = (window.PROXY_LIST_CACHE||[])[i];
  if(!p) return;
  appendProxies([p]);
  syncLocationFromPicker();
  closeProxyPicker();
}
function pickRandomProxies(){
  const all = window.PROXY_LIST_CACHE || [];
  if(!all.length){ document.getElementById('proxyListStatus').textContent = 'اول لیست را دریافت کن.'; return; }
  const n = Math.max(1, parseInt(document.getElementById('proxyPickCount').value || '1', 10));
  const shuffled = all.slice().sort(()=>Math.random()-0.5);
  const picked = shuffled.slice(0, Math.min(n, shuffled.length));
  appendProxies(picked);
  syncLocationFromPicker();
  document.getElementById('proxyListStatus').textContent = picked.length + ' پروکسی اضافه شد و لوکیشن لینک‌ها هماهنگ شد.';
  closeProxyPicker();
}
function appendProxies(list){
  const ta = document.getElementById('cfgProxies');
  const existing = ta.value.split(/[\\n,]+/).map(s=>s.trim()).filter(Boolean);
  const merged = existing.concat(list.filter(p => existing.indexOf(p) === -1));
  ta.value = merged.join('\\n');
}

// ── آی‌پی تمیز + چرخش خودکار ────────────────────────────────────────
function updateAutoRotateSummary(){
  const el = document.getElementById('autoRotateSummary');
  const on = document.getElementById('cfgAutoRotate').value==='1';
  const mins = document.getElementById('cfgRotateMinutes').value;
  el.textContent = on ? ('چرخش خودکار فعال است — هر '+mins+' دقیقه یک‌بار.') : '';
}

function openCleanIpPicker(){
  document.getElementById('cleanIpPickerBg').style.display='flex';
  document.getElementById('cleanIpListStatus').textContent='';
  document.getElementById('ipOperatorSelect').innerHTML='<option value="all">همه (توصیه‌شده)</option>';
  document.getElementById('ipCountInput').value = document.getElementById('cfgIpCount').value || 20;
  const isAuto = document.getElementById('cfgAutoRotate').value==='1';
  document.getElementById('autoRotateToggle').checked = isAuto;
  document.getElementById('autoRotateMinutes').value = document.getElementById('cfgRotateMinutes').value || 60;
  toggleAutoRotateInputs();
  loadCleanIpListUrl();
}
function closeCleanIpPicker(){ document.getElementById('cleanIpPickerBg').style.display='none'; }

function toggleAutoRotateInputs(){
  const on = document.getElementById('autoRotateToggle').checked;
  document.getElementById('autoRotateMinutesWrap').style.display = on ? '' : 'none';
}

async function scanCleanIpsNow(){
  const btn = document.getElementById('scanIpsBtn');
  const status = document.getElementById('scanIpsStatus');
  const box = document.getElementById('scanIpsResult');
  let want = parseInt(document.getElementById('scanWantInput').value, 10);
  if(isNaN(want) || want < 1) want = 10;
  btn.disabled = true; btn.textContent = 'در حال اسکن...';
  status.style.color = 'var(--ink-dim)';
  status.textContent = 'در حال تست آی‌پی‌های تصادفی از رنج‌های Cloudflare...';
  box.innerHTML = '';
  window.SCANNED_CLEAN_IPS = [];
  try{
    const data = await api('scan-clean-ips', {method:'POST', body: JSON.stringify({want})});
    const found = data.found || [];
    window.SCANNED_CLEAN_IPS = found.map(r=>r.ip);
    status.style.color = found.length ? 'var(--ok)' : 'var(--danger)';
    status.textContent = found.length
      ? (found.length + ' آی‌پی سالم از ' + data.tested + ' تست پیدا شد.')
      : ('هیچ‌کدام از ' + data.tested + ' آی‌پی جواب ندادند — یعنی این دامنه پشت Cloudflare نیست (یا ابر نارنجی فعال نشده).');
    box.innerHTML = found.map(r => '<div style="display:flex;justify-content:space-between"><span>'+escHtml(r.ip)+'</span><span style="color:var(--ok)">'+r.ms+'ms</span></div>').join('');
    if(!found.length && data.failReasons && Object.keys(data.failReasons).length){
      const reasons = Object.entries(data.failReasons).map(([k,v])=>escHtml(k)+': '+v).join(' — ');
      const reasonEl = document.createElement('div');
      reasonEl.style.color = 'var(--ink-dim)';
      reasonEl.style.marginTop = '4px';
      reasonEl.textContent = 'علت رد شدن‌ها: ' + reasons;
      box.appendChild(reasonEl);
    }
    if(found.length){
      const applyBtn = document.createElement('button');
      applyBtn.type = 'button';
      applyBtn.className = 'btn-ghost ok-btn';
      applyBtn.style.marginTop = '8px';
      applyBtn.textContent = 'استفاده از این آی‌پی‌ها';
      applyBtn.onclick = applyScannedCleanIps;
      box.appendChild(applyBtn);
    }
  }catch(e){
    status.style.color = 'var(--danger)';
    status.textContent = e.message || 'خطا در اسکن';
  }
  btn.disabled = false; btn.textContent = 'اسکن و پیدا کردن';
}
function applyScannedCleanIps(){
  const ips = window.SCANNED_CLEAN_IPS || [];
  if(!ips.length) return;
  document.getElementById('cfgCleanIps').value = ips.join('\\n');
  document.getElementById('cfgIpCount').value = ips.length;
  closeCleanIpPicker();
}

async function loadCleanIpListUrl(){
  try{
    const data = await api('clean-ip-list-url');
    document.getElementById('cleanIpListUrl').value = data.url || '';
  }catch(e){ /* ignore */ }
}
async function saveCleanIpListUrl(){
  const url = document.getElementById('cleanIpListUrl').value.trim();
  await api('clean-ip-list-url', {method:'POST', body: JSON.stringify({url})});
  document.getElementById('cleanIpListStatus').textContent = 'ذخیره شد.';
}

async function fetchCleanIpOperators(){
  const btn = document.getElementById('fetchCleanIpsBtn');
  const status = document.getElementById('cleanIpListStatus');
  const sel = document.getElementById('ipOperatorSelect');
  const prevValue = sel.value;
  btn.disabled = true; btn.textContent = 'در حال دریافت...';
  status.style.color = 'var(--ink-dim)';
  status.textContent = 'در حال دریافت لیست...';
  try{
    const data = await api('clean-ip-list');
    const operators = data.operators || {};
    window.CLEAN_IP_OPERATORS = operators;
    const keys = Object.keys(operators);
    sel.innerHTML = '<option value="all">همه (توصیه‌شده)</option>' + keys.map(k=>'<option value="'+escHtml(k)+'">'+escHtml(k)+'</option>').join('');
    sel.value = keys.indexOf(prevValue) !== -1 || prevValue==='all' ? prevValue : 'all';
    const total = keys.reduce((s,k)=>s+operators[k].length,0);
    status.textContent = keys.length + ' گروه، ' + total + ' آی‌پی پیدا شد.';
  }catch(e){
    status.style.color = 'var(--danger)';
    status.textContent = e.message || 'خطا در دریافت لیست';
  }
  btn.disabled = false; btn.textContent = 'دریافت لیست';
}

function applySelectedCleanIps(){
  const operators = window.CLEAN_IP_OPERATORS || {};
  const operator = document.getElementById('ipOperatorSelect').value;
  let count = parseInt(document.getElementById('ipCountInput').value, 10);
  if(isNaN(count) || count < 1) count = 10;
  let pool = [];
  if(operator === 'all'){
    Object.values(operators).forEach(ips => { pool = pool.concat(ips); });
  } else {
    pool = operators[operator] || [];
  }
  pool = [...new Set(pool)];
  if(!pool.length){
    document.getElementById('cleanIpListStatus').textContent = 'اول لیست را دریافت کن (یا گروه دیگری انتخاب کن).';
    return;
  }
  let selected;
  if(count >= pool.length){ selected = pool; }
  else {
    const shuffled = pool.slice();
    for(let i=shuffled.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]; }
    selected = shuffled.slice(0, count);
  }
  // این N آی‌پی جایگزین لیست فعلی می‌شوند — همه زیر همین یک کانفیگ
  // (یک UUID) و یک لینک سابسکریپشن باقی می‌مانند.
  document.getElementById('cfgCleanIps').value = selected.join('\\n');
  document.getElementById('cfgIpOperator').value = operator;
  document.getElementById('cfgIpCount').value = count;
  const isAuto = document.getElementById('autoRotateToggle').checked;
  document.getElementById('cfgAutoRotate').value = isAuto ? '1' : '0';
  document.getElementById('cfgRotateMinutes').value = document.getElementById('autoRotateMinutes').value || 0;
  updateAutoRotateSummary();
  closeCleanIpPicker();
}

// ── QR و لینک‌ها ────────────────────────────────────────────────────
function renderQr(text){
  const box = document.getElementById('qrBox');
  if(!box) return;
  box.innerHTML = '';
  if(!text){ box.style.display='none'; return; }
  try{
    box.style.display = 'flex';
    const qr = qrcode(0, 'M');
    qr.addData(text);
    qr.make();
    const svgTag = qr.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
    box.innerHTML = svgTag;
    const svgEl = box.querySelector('svg');
    if(svgEl){ svgEl.style.width='180px'; svgEl.style.height='180px'; svgEl.removeAttribute('width'); svgEl.removeAttribute('height'); }
  }catch(e){
    box.style.display = 'none';
  }
}

function showLink(id){
  const c = CONFIGS.find(x=>x.id===id);
  const links = (c.links && c.links.length ? c.links : [c.link]);
  document.getElementById('linkText').value = links.join('\\n\\n');
  document.getElementById('linkCount').textContent = links.length>1 ? (links.length+' لینک (به ازای هر آی‌پی تمیز، یک لینک)') : '';
  renderQr(links[0]);
  document.getElementById('linkModalBg').style.display='flex';
}
function showSub(id){
  const c = CONFIGS.find(x=>x.id===id);
  document.getElementById('linkText').value = c.sub_url;
  const n = (c.clean_ips && c.clean_ips.length) ? c.clean_ips.length : 1;
  document.getElementById('linkCount').textContent = 'لینک سابسکریپشن — شامل '+n+' کانفیگ. این لینک را در کلاینت به‌عنوان Subscription وارد کن.';
  renderQr(c.sub_url);
  document.getElementById('linkModalBg').style.display='flex';
}
function downloadLinkTxt(){
  const t = document.getElementById('linkText').value;
  if(!t) return;
  const blob = new Blob([t], {type:'text/plain;charset=utf-8'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'vanta-link.txt';
  a.click();
  URL.revokeObjectURL(a.href);
}
async function downloadBackup(){
  location.href = API + 'backup';
}
async function copyLink(){
  const t = document.getElementById('linkText').value;
  if(!t) return;
  let ok = false;
  try{
    await navigator.clipboard.writeText(t); ok = true;
  }catch{
    const ta = document.getElementById('linkText');
    ta.select();
    try{ ok = document.execCommand('copy'); }catch{ ok = false; }
  }
  toast(ok ? 'کپی شد ✓' : 'کپی نشد — دستی انتخاب و کپی کن', ok ? 'ok' : 'err');
}
</script>
<script>
// ── تب امنیت و ضد بن ───────────────────────────────────────────────
const SEC_KIND_FA = {
  login_locked: 'قفل ورود',
  login_failed: 'رمز غلط',
  login_ok: 'ورود موفق',
  rate_limited: 'محدودیت نرخ',
  scanner_blocked: 'اسکنر مسدود',
  panic_on: 'پنیک فعال شد',
  panic_off: 'پنیک خاموش شد',
  traffic_ceiling: 'سقف ترافیک',
  admin_path_changed: 'تغییر مسیر پنل',
  unauthorized: 'دسترسی غیرمجاز',
};

async function loadSecurityTab(){
  try{
    const snap = await api('security/snapshot');
    // پنیک
    const ps = document.getElementById('panicState');
    ps.className = 'pill ' + (snap.panic_active ? 'warn' : 'off');
    ps.textContent = snap.panic_active ? 'فعال — سرویس سرد است' : 'غیرفعال';
    // سقف ترافیک
    const gb = snap.traffic.ceiling_gb || 0;
    document.getElementById('ceilGb').value = gb || '';
    const usedB = snap.traffic.used_bytes || 0;
    const ceilB = snap.traffic.ceiling_bytes || 0;
    const pct = ceilB ? Math.min(100, (usedB/ceilB)*100) : 0;
    document.getElementById('trafficCeilInfo').textContent = gb
      ? ('مصرف کل فعلی: ' + fmtBytes(usedB) + ' از ' + fmtBytes(ceilB) + ' (' + pct.toFixed(1) + '%)' + (snap.traffic.exceeded ? ' — سقف پر شده؛ رله‌ها بسته‌اند' : ''))
      : ('سقفی ست نشده — مصرف کل فعلی: ' + fmtBytes(usedB));
    const bar = document.getElementById('ceilBar');
    bar.style.width = pct.toFixed(1) + '%';
    bar.className = pct >= 90 ? 'over' : (pct >= 70 ? 'hot' : '');
    // تنظیمات سپر
    document.getElementById('secAdminPath').value = snap.admin_path || 'vanta-admin';
    document.getElementById('secLoginAttempts').value = snap.login_max_attempts || 5;
    document.getElementById('secLockMinutes').value = snap.login_lock_minutes || 15;
    document.getElementById('secRateLimit').value = snap.rate_limit_per_minute || 60;
    document.getElementById('secWsRate').value = snap.rate_limit_ws_per_minute || 40;
    document.getElementById('secStrict').checked = !!snap.strict_mode;
    document.getElementById('secMaskIp').checked = !!snap.log_ip_mask;
  }catch(e){ /* ignore */ }
  loadSecurityEvents();
}

async function loadSecurityEvents(){
  try{
    const data = await api('security/events');
    const rows = data.events || [];
    document.getElementById('secRows').innerHTML = rows.map(ev=>\`
      <tr><td class="mono">\${fmtDate(ev.ts)}</td>
      <td><span class="pill info">\${SEC_KIND_FA[ev.kind] || escHtml(ev.kind)}</span></td>
      <td class="mono" dir="ltr">\${escHtml(ev.ip||'')}</td>
      <td style="color:var(--ink-dim)">\${escHtml(ev.detail||'')}</td></tr>\`).join('') || '<tr><td colspan="4" class="empty-note">رویدادی ثبت نشده</td></tr>';
  }catch(e){
    document.getElementById('secRows').innerHTML = '<tr><td colspan="4" class="empty-note">خطا در دریافت رویدادها</td></tr>';
  }
}

async function setPanic(on){
  const minutes = on ? (parseInt(document.getElementById('panicMinutes').value, 10) || 30) : 0;
  await api('security/panic', {method:'POST', body: JSON.stringify({minutes})});
  toast(on ? ('حالت پنیک برای '+minutes+' دقیقه فعال شد — همه‌ی اتصال‌ها قطع شدند') : 'حالت پنیک خاموش شد', on ? 'err' : 'ok');
  loadSecurityTab();
}

async function saveCeiling(){
  const gb = parseFloat(document.getElementById('ceilGb').value || '0') || 0;
  await api('security/ceiling', {method:'POST', body: JSON.stringify({gb})});
  toast(gb ? ('سقف ترافیک روی '+gb+' GB ست شد') : 'سقف ترافیک حذف شد', 'ok');
  loadSecurityTab();
}

async function saveShieldSettings(){
  const body = {
    admin_path: document.getElementById('secAdminPath').value.trim(),
    login_max_attempts: parseInt(document.getElementById('secLoginAttempts').value, 10),
    login_lock_minutes: parseInt(document.getElementById('secLockMinutes').value, 10),
    rate_limit_per_minute: parseInt(document.getElementById('secRateLimit').value, 10),
    rate_limit_ws_per_minute: parseInt(document.getElementById('secWsRate').value, 10),
    strict_mode: document.getElementById('secStrict').checked,
    log_ip_mask: document.getElementById('secMaskIp').checked,
  };
  const data = await api('security/shield', {method:'POST', body: JSON.stringify(body)});
  toast('تنظیمات سپر ذخیره شد' + (data.admin_path_changed ? ' — آدرس جدید ورود: /'+data.admin_path : ''), 'ok');
  loadSecurityTab();
}

// ── ربات تلگرام ─────────────────────────────────────────────────────
async function loadBotSettings(){
  const s = await api('bot/settings');
  document.getElementById('botEnabled').checked = s.enabled;
  document.getElementById('botToken').placeholder = s.token_masked || '123456:ABC-...';
  document.getElementById('botStatus').textContent = s.webhook_url ? ('Webhook: '+s.webhook_url) : '';
  document.getElementById('adminList').innerHTML = s.admins.map(a=>\`
    <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid var(--line)">
      <span class="mono">\${a.id}</span>
      <button class="btn-ghost danger" onclick="removeBotAdmin('\${a.id}')">حذف</button>
    </div>\`).join('') || '<div style="color:var(--ink-dim)">ادمینی ثبت نشده</div>';
}
async function saveBotSettings(){
  const token = document.getElementById('botToken').value.trim();
  const enabled = document.getElementById('botEnabled').checked;
  await api('bot/settings', {method:'POST', body: JSON.stringify({token, enabled})});
  toast('تنظیمات ربات ذخیره شد', 'ok');
  loadBotSettings();
}
async function addBotAdmin(){
  const id = document.getElementById('newAdminId').value.trim();
  if(!id) return;
  await api('bot/admins', {method:'POST', body: JSON.stringify({id})});
  document.getElementById('newAdminId').value='';
  toast('ادمین اضافه شد', 'ok');
  loadBotSettings();
}
async function removeBotAdmin(id){
  await api('bot/admins/'+id, {method:'DELETE'});
  loadBotSettings();
}

function timeAgoFa(ts){
  if(!ts) return '—';
  const diff = Date.now()/1000 - ts;
  if(diff < 60) return 'همین الان';
  if(diff < 3600) return Math.floor(diff/60)+' دقیقه پیش';
  if(diff < 86400) return Math.floor(diff/3600)+' ساعت پیش';
  return Math.floor(diff/86400)+' روز پیش';
}
async function loadBotMembers(){
  const data = await api('bot/members');
  const members = data.members || [];
  document.getElementById('memberCount').textContent = 'اعضای ثبت‌شده: '+members.length;
  document.getElementById('memberRows').innerHTML = members.map(m=>\`
    <tr>
      <td>\${escHtml(m.first_name||'—')}</td>
      <td class="mono">\${m.username ? '@'+escHtml(m.username) : '—'}</td>
      <td class="mono">\${m.id}</td>
      <td class="mono" style="color:var(--ink-dim)">\${timeAgoFa(m.last_seen)}</td>
      <td><button class="btn-ghost" onclick="openDmModal('\${m.id}','\${escHtml(m.first_name||m.id)}')">پیام</button></td>
    </tr>\`).join('') || '<tr><td colspan="5" class="empty-note">هنوز عضوی نداری</td></tr>';
}
async function sendBroadcast(){
  const text = document.getElementById('broadcastText').value.trim();
  const target = document.getElementById('broadcastTarget').value;
  const status = document.getElementById('broadcastStatus');
  const btn = document.getElementById('broadcastBtn');
  if(!text){ status.style.color='var(--danger)'; status.textContent='متن پیام را بنویس'; return; }
  if(!confirm('ارسال به «'+(target==='all'?'همه‌ی اعضا':'فقط ادمین‌ها')+'» — مطمئنی؟')) return;
  btn.disabled = true; btn.textContent = 'در حال ارسال...';
  status.style.color = 'var(--ink-dim)'; status.textContent = 'در حال ارسال، ممکن است چند لحظه طول بکشد...';
  try{
    const data = await api('bot/broadcast', {method:'POST', body: JSON.stringify({text, target})});
    status.style.color = 'var(--ok)';
    status.textContent = data.sent+' نفر دریافت کردند، '+data.failed+' ناموفق'+(data.removed?(' ('+data.removed+' نفر بلاک کرده بودند و حذف شدند)'):'')+'.';
    document.getElementById('broadcastText').value='';
    if(data.removed) loadBotMembers();
  }catch(e){ status.style.color = 'var(--danger)'; status.textContent = e.message; }
  finally{ btn.disabled=false; btn.textContent='ارسال'; }
}
let dmTargetId = null;
function openDmModal(id, label){
  dmTargetId = id;
  document.getElementById('dmTargetLabel').textContent = label;
  document.getElementById('dmText').value = '';
  document.getElementById('dmStatus').textContent = '';
  document.getElementById('dmModal').style.display = 'flex';
}
function closeDmModal(){ document.getElementById('dmModal').style.display = 'none'; dmTargetId = null; }
async function sendDm(){
  const text = document.getElementById('dmText').value.trim();
  const status = document.getElementById('dmStatus');
  if(!text || !dmTargetId) return;
  status.style.color = 'var(--ink-dim)'; status.textContent = 'در حال ارسال...';
  try{
    const data = await api('bot/broadcast', {method:'POST', body: JSON.stringify({text, target:[dmTargetId]})});
    if(data.sent > 0){ closeDmModal(); }
    else { status.style.color='var(--danger)'; status.textContent = 'ارسال نشد — احتمالاً کاربر ربات را بلاک کرده.'; loadBotMembers(); }
  }catch(e){ status.style.color = 'var(--danger)'; status.textContent = e.message; }
}

// ── بکاپ ────────────────────────────────────────────────────────────
async function doRestore(){
  const file = document.getElementById('restoreFile').files[0];
  const status = document.getElementById('restoreStatus');
  if(!file){ status.style.color='var(--ink-dim)'; status.textContent='یک فایل انتخاب کن'; return; }
  const mode = document.querySelector('input[name=mode]:checked').value;
  try{
    const text = await file.text();
    const backup = JSON.parse(text);
    const data = await api('backup/restore', {method:'POST', body: JSON.stringify({backup, mode})});
    status.style.color='var(--ok)';
    status.textContent = 'انجام شد: '+data.counters.configs+' کانفیگ، '+data.counters.admins+' ادمین، '+data.counters.members+' عضو';
    loadConfigs(); loadStats();
  }catch(e){ status.style.color='var(--danger)'; status.textContent = e.message; }
}

// ── راه‌اندازی ──────────────────────────────────────────────────────
loadStats(); loadConfigs(); loadSecurityTab();
// رفرش خودکار فقط وقتی تب دیده می‌شود — ۲۰ ثانیه.
setInterval(()=>{ if(!document.hidden){ loadStats().catch(()=>{}); loadConfigs().catch(()=>{}); } }, 20000);
document.addEventListener('visibilitychange', ()=>{ if(!document.hidden){ loadStats().catch(()=>{}); loadConfigs().catch(()=>{}); } });
</script>
</body>
</html>`;
}
