#!/bin/sh
# FarmSense Brew: power the Pi off, or restart it, when an admin asks for it in
# the web app. Started by farmsense-shutdown.path when the api container writes
# control/shutdown.request into its data volume. Installed to /usr/local/sbin.
# The request is JSON; "action":"restart" means reboot, "funnel" restarts only the public link
# (Tailscale Funnel), anything else power off.
#
# Leftover requests (from a power cut in the split second between the web app
# asking and this script acting) are deleted at boot by
# farmsense-shutdown-clean.service BEFORE the watcher starts, so every request
# seen here was made while the Pi was running and is honoured at once.
# The result is written to control/shutdown.result for the web app to show.
REQ="$1"
[ -f "$REQ" ] || exit 0
DIR="$(dirname "$REQ")"
RES="$DIR/shutdown.result"
AGE=$(( $(date +%s) - $(stat -c %Y "$REQ") ))
WHO=$(tr -d '\n"' < "$REQ" | head -c 200)
if grep -q '"action" *: *"funnel"' "$REQ"; then
  ACTION=funnel
elif grep -q '"action" *: *"restart"' "$REQ"; then
  ACTION=restart
else
  ACTION=shutdown
fi
rm -f "$REQ"                       # always first: a request is used once, never again

result() {   # result <shutting_down|restarting|ignored> <reason>
  printf '{"at":%s,"result":"%s","reason":"%s","action":"%s"}\n' "$(date +%s)" "$1" "$2" "$ACTION" > "$RES.tmp"
  chmod 644 "$RES.tmp" && mv "$RES.tmp" "$RES"
}

# Same clock on both sides (the container shares the Pi's), so a request more
# than 2 minutes old really is old: the page stopped waiting long ago.
if [ "$AGE" -gt 120 ] || [ "$AGE" -lt -120 ]; then
  logger -t farmsense-shutdown "ignored an old $ACTION request (${AGE}s): $WHO"
  result ignored "The request was ${AGE} seconds old when the Pi saw it. Press the button again."
  exit 0
fi
if [ "$ACTION" = funnel ]; then
  logger -t farmsense-shutdown "restarting the public link, asked from the web app: $WHO"
  result restarting "Restarting the public link."
  tailscale funnel reset
  systemctl restart tailscaled
  sleep 15
  tailscale funnel --bg http://127.0.0.1:3001
  result done "The public link was restarted."
  exit 0
fi
sync
if [ "$ACTION" = restart ]; then
  logger -t farmsense-shutdown "restarting, asked from the web app: $WHO"
  result restarting "Restarting now."
  sync
  systemctl reboot
else
  logger -t farmsense-shutdown "shutting down, asked from the web app: $WHO"
  result shutting_down "Shutting down now."
  sync
  systemctl poweroff
fi
