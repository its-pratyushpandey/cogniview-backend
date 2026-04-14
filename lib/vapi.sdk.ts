import Vapi from "@vapi-ai/web";

let vapiSingleton: Vapi | null = null;

function getWebToken(): string | null {
	const raw = process.env.NEXT_PUBLIC_VAPI_WEB_TOKEN;
	if (!raw) return null;

	const token = raw.trim().replace(/^"|"$/g, "").trim();
	if (!token) return null;

	if (token === "your_vapi_web_token_here" || token === "your_actual_vapi_web_token_here") return null;

	// Vapi keys can appear as a pk_ public key or a UUID-like web token depending on dashboard/version.
	const isPk = token.startsWith("pk_");
	const isUuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token);
	if (!isPk && !isUuidLike) return null;

	return token;
}

export function getVapi(): Vapi | null {
	if (typeof window === "undefined") return null;
	const token = getWebToken();
	if (!token) return null;
	if (!vapiSingleton) vapiSingleton = new Vapi(token);
	return vapiSingleton;
}
