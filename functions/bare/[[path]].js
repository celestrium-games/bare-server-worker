import BareServer from 'https://cdn.jsdelivr.net/npm/@tomphttp/bare-server-worker@2.0.2/dist/index.js';

const bare = new BareServer('/bare/');

export async function onRequest(context) {
    const request = context.request;
    if (bare.shouldRoute(request)) {
        return bare.routeRequest(request);
    }
    return new Response('Not found', { status: 404 });
}