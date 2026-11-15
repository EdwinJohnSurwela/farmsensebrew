#!/bin/sh
# FarmSense Brew: open the web app on the normal web port, so the address is
# just http://jpcf.local (no :3001). systemd-socket-proxyd passes port 80 to
# the api on 3001; the rootless container cannot listen on 80 itself.
# Run on the Pi as the farm user (it uses sudo):  sh install_port80.sh
# Undo: sudo systemctl disable --now farmsense-http.socket
set -e

sudo tee /etc/systemd/system/farmsense-http.socket >/dev/null <<'EOF'
[Unit]
Description=FarmSense: web app on the normal web port (80)

[Socket]
ListenStream=80

[Install]
WantedBy=sockets.target
EOF

sudo tee /etc/systemd/system/farmsense-http.service >/dev/null <<'EOF'
[Unit]
Description=FarmSense: pass port 80 to the web app on 3001
Requires=farmsense-http.socket
After=farmsense-http.socket

[Service]
ExecStart=/usr/lib/systemd/systemd-socket-proxyd 127.0.0.1:3001
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now farmsense-http.socket
echo "Done: http://$(hostname).local"
