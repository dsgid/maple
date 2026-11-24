// Host-header reverse proxy with WebSocket support: MAPLE_ROUTES_FILE maps host -> loopback port.
import { existsSync, readFileSync } from "node:fs"
const file = process.env.MAPLE_ROUTES_FILE!
// Prebuilt web client (MAPLE_WEB_DIST) served for MAPLE_ROUTE_WEB's host, SPA fallback to index.html.
// The Worker-only routes (/share/*, /alerts/chart/*, /chat/chart/*) are not served in this mode.
const webDist = process.env.MAPLE_WEB_DIST
const webHost = process.env.MAPLE_ROUTE_WEB ? new URL(process.env.MAPLE_ROUTE_WEB).hostname : undefined
const serveWeb = async (pathname: string): Promise<Response> => {
	const rel = decodeURIComponent(pathname).replace(/^\/+/, "")
	const file = rel && !rel.includes("..") ? Bun.file(`${webDist}/${rel}`) : undefined
	if (file && (await file.exists())) {
		const immutable = rel.startsWith("assets/")
		return new Response(file, { headers: { "cache-control": immutable ? "public, max-age=31536000, immutable" : "no-cache" } })
	}
	if (/^\/(share|alerts\/chart|chat\/chart)\//.test(pathname)) return new Response("not available", { status: 404 })
	return new Response(Bun.file(`${webDist}/index.html`), { headers: { "cache-control": "no-cache" } })
}
const lookup = (host: string): number | undefined => {
	const routes = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {}
	return routes[host]
}
type WsData = { target: string; protocols: string[]; upstream?: WebSocket; queue: (string | Buffer)[] }
Bun.serve<WsData>({
	port: Number(process.env.PROXY_PORT ?? 8088),
	async fetch(req, server) {
		const url = new URL(req.url)
		if (webDist && url.hostname === webHost && req.headers.get("upgrade") === null) return serveWeb(url.pathname)
		const port = lookup(url.hostname)
		if (!port) return new Response(`no route for ${url.hostname}`, { status: 502 })
		if (req.headers.get("upgrade")?.toLowerCase() === "websocket") {
			const protocols = (req.headers.get("sec-websocket-protocol") ?? "").split(",").map((s) => s.trim()).filter(Boolean)
			const ok = server.upgrade(req, { data: { target: `ws://127.0.0.1:${port}${url.pathname}${url.search}`, protocols, queue: [] } })
			return ok ? undefined : new Response("upgrade failed", { status: 500 })
		}
		return fetch(`http://127.0.0.1:${port}${url.pathname}${url.search}`, {
			method: req.method, headers: req.headers, body: req.body, redirect: "manual", duplex: "half",
		} as RequestInit)
	},
	websocket: {
		open(ws) {
			const up = new WebSocket(ws.data.target, ws.data.protocols)
			ws.data.upstream = up
			up.onopen = () => { for (const m of ws.data.queue) up.send(m); ws.data.queue = [] }
			up.onmessage = (e) => ws.send(e.data as string)
			up.onclose = () => ws.close()
			up.onerror = () => ws.close()
		},
		message(ws, m) {
			const up = ws.data.upstream
			if (up && up.readyState === WebSocket.OPEN) up.send(m)
			else ws.data.queue.push(m)
		},
		close(ws) { ws.data.upstream?.close() },
	},
})
console.log("proxy up")
