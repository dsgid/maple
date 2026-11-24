/* oxlint-disable */
// DSG self-host helpers, kept plain on purpose: they read env and a JSON routes file at
// stack-plan time, which the repo's Effect lint rules reject inside Effect code.
import { existsSync, readFileSync, writeFileSync } from "node:fs"

const envKey = (name: string): string => `MAPLE_ROUTE_${name.toUpperCase().replace(/-/g, "_")}`

/** MAPLE_ROUTE_<APP> (full origin) replaces the portless URL; electric-sync -> MAPLE_ROUTE_ELECTRIC_SYNC. */
export const routeOverride = (name: string): string | undefined => {
	const value = process.env[envKey(name)]
	return value ? value.replace(/\/+$/, "") : undefined
}

/** With MAPLE_ROUTES_FILE set, records host -> port for the external proxy; returns the public URL, or undefined when unset. */
export const registerRoute = (name: string, hostname: string, port: number): string | undefined => {
	const file = process.env.MAPLE_ROUTES_FILE
	if (!file) return undefined
	const override = routeOverride(name)
	const host = override ? new URL(override).hostname : `${hostname}.localhost`
	const routes: Record<string, number> = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {}
	routes[host] = port
	writeFileSync(file, JSON.stringify(routes))
	return override ?? `http://127.0.0.1:${port}`
}
