// C18 load test: realtime at scale. Every student listens on their private inbox channel
// (the way the app does), while a few senders post in the 500-member load-test chat, so each
// message signals 500 inboxes. Measures how long a signal takes to arrive and whether every
// join is allowed.
//   k6 run -e API=http://127.0.0.1:54321 -e ANON=... -e VUS=500 load/realtime.js
import http from "k6/http";
import ws from "k6/ws";
import { check, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";

const { users } = JSON.parse(open("./tokens.json"));
const VUS = Number(__ENV.VUS || 500);
const API = __ENV.API;
const CHAT = "00000000-0000-0000-0000-00000000c0de";
const LISTEN_SECONDS = 150;

const delivery = new Trend("inbox_delivery_ms", true);
const received = new Counter("inbox_signals");
const joined = new Rate("inbox_join_ok");

export const options = {
  scenarios: {
    listeners: {
      executor: "per-vu-iterations",
      vus: VUS,
      iterations: 1,
      maxDuration: `${LISTEN_SECONDS + 60}s`,
      exec: "listen",
    },
    senders: {
      executor: "constant-vus",
      vus: 10,
      startTime: "20s",
      duration: `${LISTEN_SECONDS - 40}s`,
      exec: "send",
    },
  },
  thresholds: {
    inbox_join_ok: ["rate>0.99"],
    inbox_delivery_ms: ["p(95)<1000"],
    inbox_signals: ["count>0"],
  },
};

export function listen() {
  const me = users[(__VU - 1) % users.length];
  const url = `${API.replace(/^http/, "ws")}/realtime/v1/websocket?apikey=${__ENV.ANON}&vsn=1.0.0`;
  const topic = `realtime:inbox:${me.id}`;

  const res = ws.connect(url, {}, (socket) => {
    let ref = 1;
    socket.on("open", () => {
      socket.send(
        JSON.stringify({
          topic,
          event: "phx_join",
          payload: {
            config: {
              broadcast: { ack: false, self: false },
              presence: { key: "" },
              private: true,
            },
            access_token: me.token,
          },
          ref: String(ref),
          join_ref: String(ref),
        }),
      );
      socket.setInterval(() => {
        ref++;
        socket.send(
          JSON.stringify({ topic: "phoenix", event: "heartbeat", payload: {}, ref: String(ref) }),
        );
      }, 25000);
      socket.setTimeout(() => socket.close(), LISTEN_SECONDS * 1000);
    });

    socket.on("message", (raw) => {
      const msg = JSON.parse(raw);
      if (msg.event === "phx_reply" && msg.topic === topic && msg.ref === "1") {
        joined.add(msg.payload && msg.payload.status === "ok");
      } else if (msg.event === "broadcast" && msg.payload && msg.payload.event === "message") {
        received.add(1);
        const at = Date.parse(msg.payload.payload.at);
        if (!Number.isNaN(at)) delivery.add(Date.now() - at);
      }
    });
  });
  check(res, { "socket opened": (r) => r && r.status === 101 });
}

export function send() {
  const me = users[(__VU - 1) % users.length];
  const r = http.post(
    `${API}/rest/v1/rpc/send_message`,
    JSON.stringify({ p_conversation: CHAT, p_body: `realtime check ${__VU}/${__ITER}` }),
    {
      headers: {
        apikey: __ENV.ANON,
        Authorization: `Bearer ${me.token}`,
        "Content-Type": "application/json",
      },
    },
  );
  check(r, { "send 200": (x) => x.status === 200 });
  sleep(3);
}
