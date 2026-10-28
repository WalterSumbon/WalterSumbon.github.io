import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { root, updateIndex } from "./index.mjs";
const types = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".mjs": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".md": "text/plain",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".ttf": "font/ttf",
};
const port = Number(process.env.PORT || 4173);
await updateIndex();
http
  .createServer(async (req, res) => {
    try {
      let pathname = decodeURIComponent(
        new URL(req.url, "http://localhost").pathname,
      );
      if (pathname === "/content/index.json") await updateIndex();
      if (pathname.endsWith("/")) pathname += "index.html";
      const file = path.resolve(root, "." + pathname);
      if (
        !file.startsWith(root + path.sep) ||
        /(^|\/)\./.test(pathname) ||
        pathname.startsWith("/node_modules/")
      ) {
        res.writeHead(403);
        return res.end("禁止访问");
      }
      if (!(await stat(file)).isFile())
        throw Object.assign(new Error("文件不存在"), { code: "ENOENT" });
      res.writeHead(200, {
        "Content-Type":
          (types[path.extname(file)] || "application/octet-stream") +
          ([".html", ".js", ".mjs", ".css", ".json", ".md"].includes(
            path.extname(file),
          )
            ? "; charset=utf-8"
            : ""),
        "Cache-Control": "no-store",
      });
      res.end(await readFile(file));
    } catch (error) {
      if (error.code === "ENOENT") {
        res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
        res.end(await readFile(path.join(root, "404.html")));
      } else {
        console.error(error);
        res.writeHead(500);
        res.end(error.message);
      }
    }
  })
  .listen(port, "127.0.0.1", () =>
    console.log(`本地预览：http://127.0.0.1:${port}，按 Ctrl+C 停止`),
  );
