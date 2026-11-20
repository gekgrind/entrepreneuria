# Disposable Ubuntu 24.04 test host for ops/vps (dummy credentials only).
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      systemd systemd-sysv dbus nginx git curl ca-certificates nodejs npm sudo \
      iproute2 procps tar openssl openssh-server python3 util-linux \
    && rm -rf /var/lib/apt/lists/* \
    && rm -f /etc/nginx/sites-enabled/default \
    && systemctl mask getty@tty1.service systemd-logind.service \
    && test -x /usr/bin/node
STOPSIGNAL SIGRTMIN+3
CMD ["/sbin/init"]
