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

    const bareMarker = '/bare/';
    const bareIndex = url.pathname.indexOf(bareMarker);
    
    if (bareIndex !== -1) {
        let targetUrl = url.pathname.slice(bareIndex + bareMarker.length) + url.search;
        
        if (targetUrl.startsWith('/')) {
            targetUrl = targetUrl.slice(1);
        }

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
            // Clone headers and set the outbound destination host
            const forwardHeaders = new Headers(request.headers);
            forwardHeaders.set('Host', new URL(targetUrl).host);
            
            // Remove cloudflare-specific headers that break downstream fetches
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

            // Reconstruct the response headers to clear out frame-blocking policies
            const responseHeaders = new Headers(upstreamResponse.headers);
            
            // CRITICAL: Strip out X-Frame-Options and Content-Security-Policy 
            // so the target website allows itself to sit inside Celestrium's iframe frame
            responseHeaders.delete('x-frame-options');
            responseHeaders.delete('content-security-policy');
            responseHeaders.delete('content-security-policy-report-only');

            // Inject open access CORS parameters
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

    // Fallback metadata response
    return new Response(JSON.stringify({ versions: ["3"] }), {
        status: 200,
        headers: { 'content-type': 'application/json', ...CORS_HEADERS }
    });
}