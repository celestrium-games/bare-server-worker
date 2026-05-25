const CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Allow-Headers': '*',
    'Access-Control-Expose-Headers': '*',
};

export async function onRequest(context) {
    const request = context.request;
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
        return new Response(null, { status: 200, headers: CORS_HEADERS });
    }

    // Bare v3 metadata endpoint - only when no x-bare-url header present
    if (url.pathname === '/bare/' || (url.pathname === '/bare/v3/' && !request.headers.get('x-bare-url'))) {
        return new Response(JSON.stringify({
            versions: ['v3'],
            language: 'ServiceWorker',
            memoryUsage: 0,
        }), {
            status: 200,
            headers: { 'content-type': 'application/json', ...CORS_HEADERS }
        });
    }

    // Bare v3 fetch endpoint
    if (url.pathname.startsWith('/bare/v3/')) {
        try {
            const targetUrl = request.headers.get('x-bare-url');
            if (!targetUrl) {
                return new Response('Missing x-bare-url header', { status: 400, headers: CORS_HEADERS });
            }

            const bareHeaders = request.headers.get('x-bare-headers');
            const forwardHeaders = bareHeaders ? JSON.parse(bareHeaders) : {};
            const passHeaders = request.headers.get('x-bare-pass-headers')?.split(',').map(h => h.trim()) || [];
            const passStatus = request.headers.get('x-bare-pass-status')?.split(',').map(s => parseInt(s.trim())) || [];

            for (const header of passHeaders) {
                const val = request.headers.get(header);
                if (val) forwardHeaders[header] = val;
            }

            const response = await fetch(targetUrl, {
                method: request.method,
                headers: forwardHeaders,
                body: ['GET', 'HEAD'].includes(request.method) ? null : request.body,
                redirect: 'follow',
            });

            const responseHeaders = new Headers(CORS_HEADERS);

            for (const [key, value] of response.headers.entries()) {
                if (['content-encoding', 'x-content-encoding', 'content-length'].includes(key)) continue;
                responseHeaders.set(key, value);
            }

            const bareResponseHeaders = {};
            for (const [key, value] of response.headers.entries()) {
                bareResponseHeaders[key] = value;
            }

            responseHeaders.set('x-bare-headers', JSON.stringify(bareResponseHeaders));
            responseHeaders.set('x-bare-status', String(response.status));
            responseHeaders.set('x-bare-status-text', response.statusText);

            return new Response(response.body, {
                status: passStatus.includes(response.status) ? response.status : 200,
                headers: responseHeaders,
            });

        } catch (err) {
            return new Response(`Error: ${err.message}`, { status: 500, headers: CORS_HEADERS });
        }
    }

    return new Response('Not found', { status: 404, headers: CORS_HEADERS });
}