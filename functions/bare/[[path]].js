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

    // 2. Check if this is an Ultraviolet traffic proxy request.
    // Ultraviolet v3 always sends an explicit 'x-bare-host' or 'x-proxy-url' header.
    const targetHeader = request.headers.get('x-bare-forward-url') || request.headers.get('x-bare-host');

    if (targetHeader || url.pathname.includes('/bare/')) {
        
        // Extract destination URL from either the path or the header parameters
        let targetUrl = '';
        const bareMarker = '/bare/';
        const bareIndex = url.pathname.indexOf(bareMarker);
        
        if (bareIndex !== -1) {
            targetUrl = url.pathname.slice(bareIndex + bareMarker.length) + url.search;
            if (targetUrl.startsWith('/')) targetUrl = targetUrl.slice(1);
        } else if (targetHeader) {
            targetUrl = targetHeader;
        }

        // If it's a bare metadata check with no real website attached, return the v3 signature
        if (!targetUrl || targetUrl === '' || targetUrl === '/' || targetUrl === 'undefined') {
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
            
            // Clean up caching and deployment loops
            forwardHeaders.delete('cf-connecting-ip');
            forwardHeaders.delete('cf-ipcountry');
            forwardHeaders.delete('cf-ray');
            forwardHeaders.delete('cf-visitor');

            const upstreamResponse = await fetch(targetUrl, {
                method: request.method,
                headers: forwardHeaders,
                body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : null,
                redirect: 'manual'
            });

            const responseHeaders = new Headers(upstreamResponse.headers);
            
            // Strip out frame restriction instructions so it displays in your UI frame
            responseHeaders.delete('x-frame-options');
            responseHeaders.delete('content-security-policy');
            responseHeaders.delete('content-security-policy-report-only');

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

    // 3. Fallback signature verification block
    return new Response(JSON.stringify({ versions: ["3"] }), {
        status: 200,
        headers: { 'content-type': 'application/json', ...CORS_HEADERS }
    });
}