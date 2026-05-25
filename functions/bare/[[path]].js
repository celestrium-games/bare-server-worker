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

    // Handle preflight requests instantly
    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: CORS_HEADERS });
    }

    // FIXED: Dynamically extract the target URL directly after the /bare/ prefix
    const bareMarker = '/bare/';
    const bareIndex = url.pathname.indexOf(bareMarker);
    
    if (bareIndex !== -1) {
        let targetUrl = url.pathname.slice(bareIndex + bareMarker.length) + url.search;
        
        // Remove duplicate slashes if the frontend accidentally sends '//http...'
        if (targetUrl.startsWith('/')) {
            targetUrl = targetUrl.slice(1);
        }

        if (!targetUrl) {
            return new Response('Missing target website payload', { status: 400, headers: CORS_HEADERS });
        }

        // Standardize the protocol format
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
            return new Response(`Proxy Error: ${err.message}`, { status: 502, headers: CORS_HEADERS });
        }
    }

    // Return the official TompHTTP Version 3 metadata footprint to pass the initial UV handshake
    const metadataPayload = JSON.stringify({
        versions: ["3"],
        language: "javascript",
        memory: "cloudflare-edge"
    });

    return new Response(metadataPayload, {
        status: 200,
        headers: { 'content-type': 'application/json', ...CORS_HEADERS }
    });
}