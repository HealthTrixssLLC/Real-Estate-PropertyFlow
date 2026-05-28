#!/usr/bin/env node
/**
 * Tiny HTTP responder for the Replit production preview slot.
 *
 * tour-mobile is a bare React Native iOS app — there is nothing to serve
 * in the browser. We expose a single /status endpoint returning JSON so
 * the artifact health-check passes and the preview shows a clear message.
 */
const http = require("node:http");

const PORT = Number(process.env.PORT ?? 22753);
const BASE = process.env.BASE_PATH ?? "/tour-mobile/";

const message =
  "TourFlow Mobile is a bare React Native iOS app. " +
  "Open ios/TourFlow.xcworkspace in Xcode to run it on a simulator or device.";

const server = http.createServer((req, res) => {
  const url = req.url ?? "/";
  if (url === BASE + "status" || url === "/status") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ ok: true, kind: "bare-rn-ios", message }));
    return;
  }
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(
    `<!doctype html><meta charset="utf-8"><title>TourFlow Mobile</title>` +
      `<body style="font:16px -apple-system,system-ui,sans-serif;padding:24px;line-height:1.5;color:#111">` +
      `<h2 style="margin:0 0 12px">TourFlow Mobile</h2>` +
      `<p>${message}</p></body>`,
  );
});

server.listen(PORT, () => {
  console.log(`[tour-mobile] stub server listening on ${PORT} (${BASE})`);
});
