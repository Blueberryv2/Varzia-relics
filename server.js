const http = require("http");
const fs = require("fs");
const path = require("path");

// Fetches a web address and passes the answer back to the page
async function forward(target, res) {
  try {
    const r = await fetch(target);
    const body = await r.text();
    res.writeHead(r.status, { "Content-Type": "application/json" });
    res.end(body);
  } catch (e) {
    res.writeHead(502);
    res.end(JSON.stringify({ error: String(e) }));
  }
}

http.createServer(async (req, res) => {

  // WARFRAME MARKET
  if (req.url.startsWith("/api/")) {
    await forward("https://api.warframe.market/v2/" + req.url.slice(5), res);

  // WARFRAMESTAT.US (Varzia, world state)
  } else if (req.url.startsWith("/ws/")) {
    await forward("https://api.warframestat.us/" + req.url.slice(4), res);

  // THE PAGE (index.html)
  } else {
    // Figure out which file was asked for. "/" means the page itself.
    const requestedPath = req.url === "/" ? "index.html" : req.url.slice(1);
    const filePath = path.join(__dirname, requestedPath);

    fs.readFile(filePath, (err, data) => {
      if (err) { res.writeHead(404); return res.end("Not found"); }

      // Pick the right content type based on the file's extension
      const ext = path.extname(filePath);
      const types = { ".html": "text/html", ".css": "text/css", ".json": "application/json" };
      res.writeHead(200, { "Content-Type": types[ext] || "text/plain" });
      res.end(data);
    });
  }

}).listen(3000, () => console.log("Open http://localhost:3000"));