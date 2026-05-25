// Optimized Ultraviolet v3 Handshake Receiver for Cloudflare Pages
const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
    'Access-Control-Allow-Credentials': 'true'
};

export async function onRequest(context) {
    const request = context.request;
    const url = new URL(request.url);

    // 1. Resolve browser preflight checks instantly
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: CORS_HEADERS });
    }

    // 2. Parse out the target proxy destination from the /bare/ path marker
    const bareMarker = '/bare/';
    const bareIndex = url.pathname.indexOf(bareMarker);
    
    if (bareIndex !== -1) {
        let targetUrl = url.pathname.slice(bareIndex + bareMarker.length) + url.search;
        
        if (targetUrl.startsWith('/')) {
            targetUrl = targetUrl.slice(1);
        }

        // If a request hits /bare/ but has no website attached, treat it as a v3 handshake check
        if (!targetUrl || targetUrl === '' || targetUrl === '/') {
            return new Response(JSON.stringify({
                versions: ["3"],
                language: "javascript",
                memory: "cloudflare-pages-functions"
            }), {
                status: 200,
                headers: { 'content-type': 'application/json', ...CORS_HEADERS }
            });
        }

        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
            targetUrl = 'https://' + targetUrl;
        }

        try {
            const forwardHeaders = new Headers(request.headers);
            forwardHeaders.set('Host', new URL(targetUrl).host);

            const upstreamResponse = await fetch(targetUrl, {
                method: request.method,
                headers: forwardHeaders,
                body: request.body,
                redirect: 'manual'
            });

            const responseHeaders = new Headers(upstreamResponse.headers);
            Object.keys(CORS_HEADERS).forEach(key => responseHeaders.set(key, CORS_HEADERS[key]));

            return new Response(upstreamResponse.body, {
                status: upstreamResponse.status,
                statusText: upstreamResponse.statusText,
                headers: responseHeaders
            });

        } catch (err) {
            return new Response(`Proxy Routing Error: ${err.message}`, { status: 502, headers: CORS_HEADERS });
        }
    }

    // 3. FALLBACK: Explicitly answer any root domain requests with the Bare Server v3 specifications payload
    const metadataPayload = JSON.stringify({
        versions: ["3"],
        language: "javascript",
        memory: "cloudflare-pages-functions"
    });

    return new Response(metadataPayload, {
        status: 200,
        headers: { 'content-type': 'application/json', ...CORS_HEADERS }
    });
}