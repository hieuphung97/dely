#!/usr/bin/env bash
# Everything the tool image carries, pinned and checked.
set -euxo pipefail

export DEBIAN_FRONTEND=noninteractive

cloud-init status --wait || true

sudo apt-get update
sudo apt-get install -y --no-install-recommends \
  ca-certificates curl gnupg jq git rsync \
  qemu-guest-agent \
  nodejs npm \
  xserver-xorg-core xserver-xorg-video-vesa xserver-xorg-video-qxl \
  xserver-xorg-input-libinput xinit openbox xterm xdotool \
  dbus-x11 x11-xserver-utils xdg-utils \
  libgtk-3-0t64 libnss3 libasound2t64 libatk-bridge2.0-0t64 libcups2t64 \
  libdrm2 libgbm1 libxkbcommon0 libpango-1.0-0 libxcomposite1 libxdamage1 \
  libxfixes3 libxrandr2 libsecret-1-0

# -- orca, at the pinned version and digest ------------------------------
curl -fsSL -o /tmp/orca.deb "${ORCA_URL}"
echo "${ORCA_SHA256}  /tmp/orca.deb" | sha256sum -c -
sudo apt-get install -y /tmp/orca.deb
rm -f /tmp/orca.deb
test -x /opt/Orca/resources/bin/orca-ide
sudo ln -sf /opt/Orca/resources/bin/orca-ide /usr/local/bin/orca

# -- claude code, at the pinned version ----------------------------------
sudo npm install -g --no-fund --no-audit "@anthropic-ai/claude-code@${CLAUDE_CODE_VERSION}"
claude --version

# -- a graphical session so the orca window has somewhere to appear -------
sudo tee /etc/systemd/system/dely-cycle-desktop.service > /dev/null <<UNIT
[Unit]
Description=Minimal graphical session for the dely cycle
After=systemd-user-sessions.service
Conflicts=getty@tty1.service

[Service]
User=${GUEST_USER}
PAMName=login
Type=simple
# Without a controlling terminal the display server cannot take the virtual
# terminal and dies with "Switching VT failed".
StandardInput=tty
StandardOutput=journal
StandardError=journal
TTYPath=/dev/tty1
TTYReset=yes
TTYVHangup=yes
TTYVTDisallocate=yes
Environment=XDG_RUNTIME_DIR=/run/user/1000
WorkingDirectory=/home/${GUEST_USER}
ExecStart=/usr/bin/startx /usr/bin/openbox-session -- :0 vt1
Restart=on-failure
RestartSec=5

[Install]
WantedBy=graphical.target
UNIT

# The application is deliberately NOT started by the window manager. Launched
# from the autostart it left only a crash directory and a stale singleton lock
# and the runtime never appeared; launched as a detached command once the
# display is up, it reaches "ready". Starting it is the runner's step, so it is
# one observable command with a recorded outcome.

sudo systemctl set-default graphical.target
sudo systemctl enable dely-cycle-desktop.service
sudo systemctl enable qemu-guest-agent

# -- record what this image is ------------------------------------------
sudo tee /etc/dely-cycle-image > /dev/null <<MANIFEST
orca_version=$(dpkg-query -W -f='${Version}' orca-ide)
claude_code_version=$(claude --version | awk '{print $1}')
node_version=$(node --version)
ubuntu=$(lsb_release -ds)
built_at=$(date -u +%Y-%m-%dT%H:%M:%SZ)
MANIFEST
sudo chmod 0444 /etc/dely-cycle-image
cat /etc/dely-cycle-image

# -- leave no build credential behind ------------------------------------
sudo rm -f "/home/${GUEST_USER}/.ssh/authorized_keys"
sudo rm -rf "/home/${GUEST_USER}/.ssh"
# Nothing the application wrote during the build belongs in the image.
sudo rm -rf "/home/${GUEST_USER}/.config/orca"
sudo cloud-init clean --logs --seed
sudo rm -rf /var/lib/cloud/instances /var/lib/cloud/instance
sudo truncate -s 0 /etc/machine-id
sudo rm -f /var/lib/dbus/machine-id
sudo apt-get clean
sudo rm -rf /var/lib/apt/lists/*
echo "provisioning complete"
