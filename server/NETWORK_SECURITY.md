# Outbound source requests

Source adapters, HTML helpers, image downloads and media proxies use `publicFetch`.
Keep new source requests on this path rather than calling `fetch` directly.

The production server (including Electron), Vite development server and Vite preview
install the Node transport. It checks every DNS result inside the socket lookup,
then connects using those checked addresses without a second DNS resolution.
Literal non-public IPs, credentials in URLs, reserved/transition IP ranges and local
hostnames are rejected. Redirects are handled manually, limited to five hops and
validated again; HTTPS cannot redirect to HTTP. Credentials are removed when a
redirect changes origin. Existing public HTTP sources remain supported.

The common module also runs in the browser/Capacitor bundle. It validates URL
syntax and literal destinations but cannot control the native/browser DNS resolver.
Opaque redirects are rejected because their destination cannot be inspected.
Native WebView fetch bridges are outside the Node transport's protection.

FlareSolverr is a separate trust boundary: its configured service endpoint may
legitimately be localhost, so it does not use the public-source transport. Service
requests reject redirects. Target URLs are checked before delegation, including
DNS in Node; assets downloaded by this process use `publicFetch`. The solver's
own DNS, redirects and browser subresources must also be restricted on the solver
host (egress firewall or equivalent). Local validation cannot enforce the remote
solver's network policy.

Verification: `node --test server/tests/publicFetch.test.js
server/tests/urlSecurity.test.js server/tests/hlsProxy.test.js` (one command).
