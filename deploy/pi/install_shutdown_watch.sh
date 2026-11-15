#!/bin/sh
# FarmSense Brew: install the "shut down from the web app" watcher on the Pi.
# Run on the Pi as the farm user (it uses sudo):  sh install_shutdown_watch.sh
#   farmsense-shutdown-clean.service  at boot: delete any leftover request
#   farmsense-shutdown.path           then watch for a new request
#   farmsense-shutdown.service        act on it (farmsense-shutdown.sh)
set -e
HERE="$(cd "$(dirname "$0")" && pwd)"
VOL="$(podman volume inspect farmsense-brew_api-data --format '{{.Mountpoint}}')"
REQ="$VOL/control/shutdown.request"
podman exec farmsense-brew_api_1 mkdir -p /opt/farmsense/backend/data/control

sudo install -m 755 "$HERE/farmsense-shutdown.sh" /usr/local/sbin/farmsense-shutdown.sh

sudo tee /etc/systemd/system/farmsense-shutdown-clean.service >/dev/null <<EOF
[Unit]
Description=FarmSense: delete a leftover shutdown request at boot
Before=farmsense-shutdown.path

[Service]
Type=oneshot
ExecStart=/bin/rm -f $REQ

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/farmsense-shutdown.path >/dev/null <<EOF
[Unit]
Description=FarmSense: watch for a shutdown request from the web app
Wants=farmsense-shutdown-clean.service
After=farmsense-shutdown-clean.service

[Path]
PathExists=$REQ
Unit=farmsense-shutdown.service

[Install]
WantedBy=multi-user.target
EOF

sudo tee /etc/systemd/system/farmsense-shutdown.service >/dev/null <<EOF
[Unit]
Description=FarmSense: shut the Pi down when an admin asks for it

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/farmsense-shutdown.sh $REQ
EOF

sudo systemctl daemon-reload
sudo systemctl enable farmsense-shutdown-clean.service
sudo systemctl enable farmsense-shutdown.path
sudo systemctl restart farmsense-shutdown.path
systemctl is-active farmsense-shutdown.path
echo "Watching $REQ"
