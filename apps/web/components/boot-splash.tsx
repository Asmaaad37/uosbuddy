/**
 * The opening screen: the Buddy mark, a welcome and the tagline, shown from the very first
 * bytes of the page instead of a blank screen. Styled inline (it paints before the CSS file
 * loads; the page colour shows at once and the logo fades in after 120 ms, so fast loads
 * never flash it) and hidden for good once the first screen is in: when a <main> appears or the page
 * has finished loading, whichever comes first, and after 8 s at most. Client-side
 * navigation never brings it back; signed-in screens show a skeleton instead (loading.tsx).
 */

const CSS = `
html{background:#f2f4f7}
@media (prefers-color-scheme:dark){html:not([data-theme=light]){background:#0b0f17}}
html[data-theme=dark]{background:#0b0f17}
#boot-splash{position:fixed;inset:0;z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;padding:24px;background:#f2f4f7;color:#0b1220;font-family:-apple-system,BlinkMacSystemFont,"SF Pro Text",var(--font-inter),system-ui,sans-serif;text-align:center;transition:opacity .28s ease,visibility 0s linear .28s}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) #boot-splash{background:#0b0f17;color:#f2f4f7}}
:root[data-theme=dark] #boot-splash{background:#0b0f17;color:#f2f4f7}
#boot-splash .bs-mark{width:76px;height:76px;border-radius:18px;background:#2563eb;display:grid;place-items:center;box-shadow:0 10px 30px rgba(37,99,235,.35);animation:bs-pop .5s .12s cubic-bezier(.2,.9,.3,1.2) both}
#boot-splash .bs-title{margin:6px 0 0;font-size:22px;font-weight:700;letter-spacing:-.01em;animation:bs-rise .45s .2s ease both}
#boot-splash .bs-tag{margin:0;font-size:15px;color:color-mix(in srgb,currentColor 65%,transparent);animation:bs-rise .45s .28s ease both}
#boot-splash .bs-bar{animation:bs-rise .45s .35s ease both;margin-top:18px;width:120px;height:3px;border-radius:3px;background:rgba(127,127,127,.2);overflow:hidden}
#boot-splash .bs-bar span{display:block;width:40%;height:100%;border-radius:3px;background:#2563eb;animation:bs-slide 1.1s ease-in-out infinite}
html.booted #boot-splash{opacity:0;visibility:hidden;pointer-events:none}
@keyframes bs-pop{from{transform:scale(.8);opacity:0}to{transform:none;opacity:1}}
@keyframes bs-rise{from{transform:translateY(6px);opacity:0}to{transform:none;opacity:1}}
@keyframes bs-slide{from{transform:translateX(-100%)}to{transform:translateX(250%)}}
@media (prefers-reduced-motion:reduce){#boot-splash *{animation:none!important}#boot-splash{transition:none}}
`;

/** Hides the splash once the first screen is in; inline so it runs before React loads. */
export const BOOT_SCRIPT = `(function(){var d=document,h=d.documentElement,done=function(){h.classList.add("booted")};var t=setInterval(function(){if(d.querySelector("main")){clearInterval(t);done()}},40);d.addEventListener("DOMContentLoaded",function(){clearInterval(t);done()});setTimeout(function(){clearInterval(t);done()},8000)})();`;

export function BootSplash() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {/* Without JavaScript nothing would hide it, so it never shows. */}
      <noscript>
        <style>{"#boot-splash{display:none}"}</style>
      </noscript>
      <div id="boot-splash" aria-hidden>
        <div className="bs-mark">
          <svg width="52" height="52" viewBox="0 0 100 100">
            <circle cx="36" cy="40" r="7" fill="#fff" />
            <circle cx="64" cy="40" r="7" fill="#fff" />
            <path
              d="M31 56 a19 19 0 0 0 38 0"
              fill="none"
              stroke="#fff"
              strokeWidth="9"
              strokeLinecap="round"
            />
          </svg>
        </div>
        {/* Not a heading: the page's own heading is the first one that counts. */}
        <p className="bs-title">Welcome to UOSBuddy</p>
        <p className="bs-tag">Find your batch. Find your people.</p>
        <div className="bs-bar">
          <span />
        </div>
      </div>
    </>
  );
}
