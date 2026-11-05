#!/data/data/com.termux/files/usr/bin/sh
# Starts everything after the phone reboots. Requires the Termux:Boot app (F-Droid),
# opened once. Install with:
#
#   mkdir -p ~/.termux/boot
#   cp ~/Interactify/deploy/termux-boot.sh ~/.termux/boot/start-interactify
#   chmod +x ~/.termux/boot/start-interactify

# Keep Android from suspending Termux
termux-wake-lock

pgrep -x sshd >/dev/null || sshd
redis-cli ping >/dev/null 2>&1 || redis-server --daemonize yes

# Restores the server and cloudflare-tunnel processes saved by `pm2 save`
pm2 resurrect
