// Minimal S3-compatible store: accepts presigned PUTs, serves GETs.
// Enough to exercise the real browser -> bucket upload path end to end.
import { createServer } from "node:http";

const objects = new Map();

createServer((req, res) => {
  const url = new URL(req.url, "http://localhost");
  const key = url.pathname.replace(/^\/+/, "");

  // Direct browser uploads are cross-origin, and PUT with an image
  // Content-Type is not a "simple request", so the browser preflights.
  // A real bucket needs an equivalent CORS policy configured.
  const cors = {
    "Access-Control-Allow-Origin": req.headers.origin ?? "*",
    "Access-Control-Allow-Methods": "PUT, GET, HEAD",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Max-Age": "86400",
  };

  if (req.method === "OPTIONS") {
    res.writeHead(204, cors).end();
    return;
  }

  if (req.method === "PUT") {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const body = Buffer.concat(chunks);
      const declared = Number(req.headers["content-length"]);

      // Mirror the provider behaviour the presign relies on: a body that does
      // not match the signed Content-Length is rejected.
      if (Number.isFinite(declared) && declared !== body.length) {
        res.writeHead(400, cors).end("length mismatch");
        return;
      }

      objects.set(key, { body, contentType: req.headers["content-type"] });
      // Report whether the request carried a signature, so the test can assert it.
      res.writeHead(200, { ...cors, "x-signed": url.searchParams.has("X-Amz-Signature") ? "yes" : "no" }).end();
    });
    return;
  }

  if (req.method === "GET") {
    const object = objects.get(key);
    if (!object) { res.writeHead(404, cors).end(); return; }
    res.writeHead(200, { ...cors, "Content-Type": object.contentType }).end(object.body);
    return;
  }

  res.writeHead(405).end();
}).listen(9000, () => console.log("fake-s3 on 9000"));
