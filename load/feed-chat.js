// Phase 10 load test (BUILD_PLAN §4.12): 500 students reading the feed and chatting at
// once, against the same API calls the app makes. Targets from §2.2: feed reads p95 under
// 300 ms, chat sends under 500 ms.
//   k6 run -e API=http://127.0.0.1:54321 -e ANON=... load/feed-chat.js
import http from "k6/http";
import { check, sleep } from "k6";

const { users } = JSON.parse(open("./tokens.json"));
const API = __ENV.API;
const CHAT = "00000000-0000-0000-0000-00000000c0de";

export const options = {
  scenarios: {
    students: {
      executor: "ramping-vus",
      stages: [
        { duration: "30s", target: 500 },
        { duration: "2m", target: 500 },
        { duration: "15s", target: 0 },
      ],
    },
  },
  thresholds: {
    "http_req_duration{name:feed}": ["p(95)<300"],
    "http_req_duration{name:messages}": ["p(95)<300"],
    "http_req_duration{name:send}": ["p(95)<500"],
    http_req_failed: ["rate<0.01"],
  },
};

export default function () {
  const me = users[(__VU - 1) % users.length];
  const headers = {
    apikey: __ENV.ANON,
    Authorization: `Bearer ${me.token}`,
    "Content-Type": "application/json",
  };

  // The feed's first page, newest and hot (as /feed loads it).
  const sort = __ITER % 2 ? "created_at.desc,id.desc" : "hot_score.desc,id.desc";
  const feed = http.get(
    `${API}/rest/v1/posts_public?select=*&space=eq.campus&order=${sort}&limit=20`,
    { headers, tags: { name: "feed" } },
  );
  check(feed, { "feed 200": (r) => r.status === 200 });
  sleep(1 + Math.random() * 2);

  // Open the chat, then say something.
  const messages = http.get(
    `${API}/rest/v1/messages?select=id,body,created_at,sender_id&conversation_id=eq.${CHAT}&order=created_at.desc&limit=30`,
    { headers, tags: { name: "messages" } },
  );
  check(messages, { "messages 200": (r) => r.status === 200 });
  const send = http.post(
    `${API}/rest/v1/rpc/send_message`,
    JSON.stringify({ p_conversation: CHAT, p_body: `hello from student ${__VU} (${__ITER})` }),
    { headers, tags: { name: "send" } },
  );
  check(send, { "send 200": (r) => r.status === 200 });
  sleep(3 + Math.random() * 4);
}
