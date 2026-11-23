// Host-header reverse proxy with WebSocket support: MAPLE_ROUTES_FILE maps host -> loopback port.
import { existsSync, readFileSync } from "node:fs"
const file = process.env.MAPLE_ROUTES_FILE!
const lookup = (host: string): number | undefined => {
	const routes = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {}
	return routes[host]
}
type WsData = { target: string; protocols: string[]; upstream?: WebSocket; queue: (string | Buffer)[] }
Bun.serve<WsData>({
	port: Number(process.env.PROXY_PORT ?? 8088),
	async fetch(req, server) {
		const url = new URL(req.url)
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
