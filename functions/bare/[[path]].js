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

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: CORS_HEADERS });
    }

    const bareIndex = url.pathname.indexOf('/bare/');
    if (bareIndex !== -1) {
        let targetUrl = url.pathname.slice(bareIndex + 6) + url.search;
        if (!targetUrl) return new Response('Missing target', { status: 400, headers: CORS_HEADERS });
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
            return new Response(`Error: ${err.message}`, { status: 502, headers: CORS_HEADERS });
        }
    }

    return new Response(JSON.stringify({ versions: ["3"] }), {
        status: 200,
        headers: { 'content-type': 'application/json', ...CORS_HEADERS }
    });
}