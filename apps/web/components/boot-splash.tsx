/**
 * The animated welcome when the app opens: the Buddy tile pops in, its smile draws itself,
 * it blinks, "Welcome to UOSBuddy" and the tagline rise in, and three dots bounce. It always
 * plays in full (MIN_MS), and stays longer only if the first screen isn't in yet, then zooms
 * away. Once per visit: later page loads in the same tab skip it (sessionStorage). Plain HTML
 * and inline CSS, so it paints with the first bytes, before any script or stylesheet loads.
 * People who ask for less motion get a short, still version.
 */

const MIN_MS = 1900;
const REDUCED_MS = 700;

const CSS = `
html{background:#f2f4f7}
@media (prefers-color-scheme:dark){html:not([data-theme=light]){background:#0b0f17}}
html[data-theme=dark]{background:#0b0f17}
#boot-splash{position:fixed;inset:0;z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:24px;text-align:center;overflow:hidden;
  --bg:#f2f4f7;--ink:#0b1220;--sec:#5a6475;background:var(--bg);color:var(--ink);
  font-family:-apple-system,BlinkMacSystemFont,"SF Pro Display",var(--font-inter),system-ui,sans-serif;
  transition:opacity .45s ease,transform .45s ease,visibility 0s linear .45s}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) #boot-splash{--bg:#0b0f17;--ink:#f2f4f7;--sec:#9aa4b5}}
:root[data-theme=dark] #boot-splash{--bg:#0b0f17;--ink:#f2f4f7;--sec:#9aa4b5}
#boot-splash .bs-glow{position:absolute;width:420px;height:420px;border-radius:50%;background:radial-gradient(circle,rgba(37,99,235,.28),rgba(37,99,235,0) 65%);animation:bs-glow 2.4s ease-in-out infinite}
#boot-splash .bs-tile{position:relative;width:92px;height:92px;border-radius:24px;background:linear-gradient(145deg,#3b82f6,#2563eb 55%,#1d4ed8);display:grid;place-items:center;
  box-shadow:0 14px 34px rgba(37,99,235,.38);animation:bs-pop .7s cubic-bezier(.2,1.4,.4,1) both, bs-float 2.6s ease-in-out .8s infinite}
#boot-splash .bs-eye{transform-box:fill-box;transform-origin:center;animation:bs-blink 3.2s ease-in-out .95s infinite}
#boot-splash .bs-smile{stroke-dasharray:62;stroke-dashoffset:62;animation:bs-draw .6s cubic-bezier(.6,0,.2,1) .4s forwards}
#boot-splash .bs-title{margin:26px 0 0;font-size:26px;font-weight:700;letter-spacing:-.02em;animation:bs-rise .6s cubic-bezier(.2,.8,.2,1) .55s both}
#boot-splash .bs-title b{font-weight:800;background:linear-gradient(90deg,#2563eb,#60a5fa,#2563eb);background-size:200% 100%;-webkit-background-clip:text;background-clip:text;color:transparent;animation:bs-shine 2s linear .9s infinite}
#boot-splash .bs-tag{margin:8px 0 0;font-size:15px;color:var(--sec);animation:bs-rise .6s cubic-bezier(.2,.8,.2,1) .75s both}
#boot-splash .bs-dots{display:flex;gap:7px;margin-top:30px;animation:bs-rise .5s ease .95s both}
#boot-splash .bs-dots i{width:8px;height:8px;border-radius:50%;background:#2563eb;animation:bs-bounce 1s ease-in-out infinite}
#boot-splash .bs-dots i:nth-child(2){animation-delay:.15s;opacity:.75}
#boot-splash .bs-dots i:nth-child(3){animation-delay:.3s;opacity:.5}
html.booted #boot-splash{opacity:0;transform:scale(1.06);visibility:hidden;pointer-events:none}
html.booted-skip #boot-splash{display:none}
@keyframes bs-pop{0%{transform:scale(.3) rotate(-12deg);opacity:0}100%{transform:none;opacity:1}}
@keyframes bs-float{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
@keyframes bs-blink{0%,92%,100%{transform:scaleY(1)}95%{transform:scaleY(.1)}}
@keyframes bs-draw{to{stroke-dashoffset:0}}
@keyframes bs-rise{from{transform:translateY(14px);opacity:0}to{transform:none;opacity:1}}
@keyframes bs-shine{to{background-position:-200% 0}}
@keyframes bs-bounce{0%,100%{transform:translateY(0)}40%{transform:translateY(-9px)}}
@keyframes bs-glow{0%,100%{transform:scale(.9);opacity:.8}50%{transform:scale(1.08);opacity:1}}
@media (prefers-reduced-motion:reduce){
  #boot-splash *,#boot-splash{animation:none!important;transition:opacity .2s ease!important;transform:none!important}
  #boot-splash .bs-smile{stroke-dashoffset:0}
}
`;

/**
 * Inline in <head>, before the body paints. Skips the welcome on later loads in the same tab,
 * and in automated browsers (tests, which would otherwise wait behind it on every run);
 * otherwise waits for the first screen (a <main>, or the page done loading) and the minimum
 * time, whichever is later, then lets it zoom away. Never longer than 8 s.
 */
export const BOOT_SCRIPT = `(function(){var d=document,h=d.documentElement,K="uosb-welcomed";
if(navigator.webdriver){h.classList.add("booted","booted-skip");return}
try{if(sessionStorage.getItem(K)){h.classList.add("booted","booted-skip");return}sessionStorage.setItem(K,"1")}catch(e){}
var calm=window.matchMedia&&matchMedia("(prefers-reduced-motion: reduce)").matches,min=calm?${REDUCED_MS}:${MIN_MS},t0=Date.now(),gone=false;
var hide=function(){if(gone)return;gone=true;h.classList.add("booted")};
var ready=function(){clearInterval(poll);setTimeout(hide,Math.max(0,min-(Date.now()-t0)))};
var poll=setInterval(function(){if(d.querySelector("main"))ready()},40);
d.addEventListener("DOMContentLoaded",ready);setTimeout(hide,8000)})();`;

export function BootSplash() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      {/* Without JavaScript nothing would hide it, so it never shows. */}
      <noscript>
        <style>{"#boot-splash{display:none}"}</style>
      </noscript>
      <div id="boot-splash" aria-hidden>
        <div className="bs-glow" />
        <div className="bs-tile">
          <svg width="62" height="62" viewBox="0 0 100 100">
            <circle className="bs-eye" cx="36" cy="40" r="7" fill="#fff" />
            <circle className="bs-eye" cx="64" cy="40" r="7" fill="#fff" />
            <path
              className="bs-smile"
              d="M31 56 a19 19 0 0 0 38 0"
              fill="none"
              stroke="#fff"
              strokeWidth="9"
              strokeLinecap="round"
            />
          </svg>
        </div>
        {/* Not a heading: the page's own heading is the first one that counts. */}
        <p className="bs-title">
          Welcome to <b>UOSBuddy</b>
        </p>
        <p className="bs-tag">Find your batch. Find your people.</p>
        <div className="bs-dots">
          <i />
          <i />
          <i />
        </div>
      </div>
    </>
  );
}
