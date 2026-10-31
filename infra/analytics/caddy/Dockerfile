# Caddy with the rate-limit module (stock Caddy cannot limit login attempts).
# Built on the instance by install.sh; versions come from ../versions.env.
ARG CADDY_VERSION
FROM caddy:${CADDY_VERSION}-builder-alpine AS builder
ARG RATELIMIT_REF
RUN xcaddy build --with github.com/mholt/caddy-ratelimit@${RATELIMIT_REF}

FROM caddy:${CADDY_VERSION}-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
