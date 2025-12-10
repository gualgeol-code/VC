#!/bin/sh

#############################
# Alpine Linux Installation #
#############################

# Define the root directory to /home/container.
# We can only write in /home/container and /tmp in the container.
ROOTFS_DIR=/home/container

# Define the Alpine Linux version we are going to be using.
ALPINE_VERSION="3.18"
ALPINE_FULL_VERSION="3.18.3"
APK_TOOLS_VERSION="2.14.0-r2" # Make sure to update this too when updating Alpine Linux.
PROOT_VERSION="5.3.0" # Some releases do not have static builds attached.

# Detect the machine architecture.
ARCH=$(uname -m)

# Check machine architecture to make sure it is supported.
# If not, we exit with a non-zero status code.
if [ "$ARCH" = "x86_64" ]; then
  ARCH_ALT=amd64
elif [ "$ARCH" = "aarch64" ]; then
  ARCH_ALT=arm64
else
  printf "Unsupported CPU architecture: ${ARCH}"
  exit 1
fi

# Download & decompress the Alpine linux root file system if not already installed.
if [ ! -e $ROOTFS_DIR/.installed ]; then
    echo "Downloading Alpine Linux root filesystem..."
    # Download Alpine Linux root file system.
    wget -q -O /tmp/rootfs.tar.gz \
    "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/${ARCH}/alpine-minirootfs-${ALPINE_FULL_VERSION}-${ARCH}.tar.gz"
    
    echo "Extracting Alpine Linux root filesystem..."
    # Extract the Alpine Linux root file system.
    tar -xzf /tmp/rootfs.tar.gz -C $ROOTFS_DIR
fi

################################
# Package Installation & Setup #
################################

# Download static APK-Tools temporarily because minirootfs does not come with APK pre-installed.
if [ ! -e $ROOTFS_DIR/.installed ]; then
    echo "Downloading required packages..."
    
    # Download the packages from their sources.
    wget -q -O /tmp/apk-tools-static.apk "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/main/${ARCH}/apk-tools-static-${APK_TOOLS_VERSION}.apk"
    wget -q -O /tmp/gotty.tar.gz "https://github.com/sorenisanerd/gotty/releases/download/v1.5.0/gotty_v1.5.0_linux_${ARCH_ALT}.tar.gz"
    
    # Create directory for proot if it doesn't exist
    mkdir -p $ROOTFS_DIR/usr/local/bin
    
    echo "Downloading proot..."
    wget -q -O /tmp/proot "https://github.com/proot-me/proot/releases/download/v${PROOT_VERSION}/proot-v${PROOT_VERSION}-${ARCH}-static"
    
    echo "Extracting packages..."
    # Extract everything that needs to be extracted.
    tar -xzf /tmp/apk-tools-static.apk -C /tmp/
    tar -xzf /tmp/gotty.tar.gz -C $ROOTFS_DIR/usr/local/bin
    
    # Move proot to the correct location
    mv /tmp/proot $ROOTFS_DIR/usr/local/bin/proot
    
    echo "Installing base system packages..."
    # Install base system packages using the static APK-Tools.
    /tmp/sbin/apk.static -X "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/main/" -U --allow-untrusted --root $ROOTFS_DIR add alpine-base apk-tools
    
    echo "Setting up permissions..."
    # Make PRoot and GoTTY executable.
    chmod 755 $ROOTFS_DIR/usr/local/bin/proot $ROOTFS_DIR/usr/local/bin/gotty
    
    # Verify files exist
    echo "Verifying installation..."
    ls -la $ROOTFS_DIR/usr/local/bin/
fi

# Clean-up after installation complete & finish up.
if [ ! -e $ROOTFS_DIR/.installed ]; then
    echo "Finalizing installation..."
    
    # Add DNS Resolver nameservers to resolv.conf.
    mkdir -p ${ROOTFS_DIR}/etc
    printf "nameserver 1.1.1.1\nnameserver 1.0.0.1" > ${ROOTFS_DIR}/etc/resolv.conf
    
    # Wipe the files we downloaded into /tmp previously.
    rm -rf /tmp/apk-tools-static.apk /tmp/rootfs.tar.gz /tmp/sbin /tmp/gotty.tar.gz
    
    # Create .installed to later check whether Alpine is installed.
    touch $ROOTFS_DIR/.installed
    
    echo "Installation complete!"
fi

# Print some useful information to the terminal before entering PRoot.
# This is to introduce the user with the various Alpine Linux commands.
clear && cat << EOF

 ‚Ėą‚Ėą‚ēó  ‚Ėą‚Ėą‚ēó ‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚ēó ‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚ēó ‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚ēó  ‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚ēó ‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚ēó 
 ‚Ėą‚Ėą‚ēĎ  ‚Ėą‚Ėą‚ēĎ‚Ėą‚Ėą‚ēĒ‚ēź‚ēź‚Ėą‚Ėą‚ēó‚Ėą‚Ėą‚ēĒ‚ēź‚ēź‚Ėą‚Ėą‚ēó‚Ėą‚Ėą‚ēĒ‚ēź‚ēź‚Ėą‚Ėą‚ēó‚Ėą‚Ėą‚ēĒ‚ēź‚ēź‚ēź‚Ėą‚Ėą‚ēó‚Ėą‚Ėą‚ēĒ‚ēź‚ēź‚Ėą‚Ėą‚ēó
 ‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚ēĎ‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚ēĎ‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚ēĒ‚ēĚ‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚ēĒ‚ēĚ‚Ėą‚Ėą‚ēĎ   ‚Ėą‚Ėą‚ēĎ‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚ēĒ‚ēĚ
 ‚Ėą‚Ėą‚ēĒ‚ēź‚ēź‚Ėą‚Ėą‚ēĎ‚Ėą‚Ėą‚ēĒ‚ēź‚ēź‚Ėą‚Ėą‚ēĎ‚Ėą‚Ėą‚ēĒ‚ēź‚ēź‚Ėą‚Ėą‚ēó‚Ėą‚Ėą‚ēĒ‚ēź‚ēź‚Ėą‚Ėą‚ēó‚Ėą‚Ėą‚ēĎ   ‚Ėą‚Ėą‚ēĎ‚Ėą‚Ėą‚ēĒ‚ēź‚ēź‚Ėą‚Ėą‚ēó
 ‚Ėą‚Ėą‚ēĎ  ‚Ėą‚Ėą‚ēĎ‚Ėą‚Ėą‚ēĎ  ‚Ėą‚Ėą‚ēĎ‚Ėą‚Ėą‚ēĎ  ‚Ėą‚Ėą‚ēĎ‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚ēĒ‚ēĚ‚ēö‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚Ėą‚ēĒ‚ēĚ‚Ėą‚Ėą‚ēĎ  ‚Ėą‚Ėą‚ēĎ
 ‚ēö‚ēź‚ēĚ  ‚ēö‚ēź‚ēĚ‚ēö‚ēź‚ēĚ  ‚ēö‚ēź‚ēĚ‚ēö‚ēź‚ēĚ  ‚ēö‚ēź‚ēĚ‚ēö‚ēź‚ēź‚ēź‚ēź‚ēź‚ēĚ  ‚ēö‚ēź‚ēź‚ēź‚ēź‚ēź‚ēĚ ‚ēö‚ēź‚ēĚ  ‚ēö‚ēź‚ēĚ
 
 Welcome to Alpine Linux minirootfs!
 This is a lightweight and security-oriented Linux distribution that is perfect for running high-performance applications.
 
 Here are some useful commands to get you started:
 
    apk add [package] : install a package
    apk del [package] : remove a package
    apk update : update the package index
    apk upgrade : upgrade installed packages
    apk search [keyword] : search for a package
    apk info [package] : show information about a package
    gotty -p [server-port] -w ash : share your terminal
 
 If you run into any issues make sure to report them on GitHub!
 https://github.com/RealTriassic/Harbor

Current Alpine Host: $(cat /etc/os-release | grep PRETTY_NAME | cut -d'"' -f2)
 
EOF

###########################
# Start PRoot environment #
###########################

echo "Checking for proot..."
ls -la $ROOTFS_DIR/usr/local/bin/proot

echo "Starting PRoot environment..."
# This command starts PRoot and binds several important directories
# from the host file system to our special root file system.
if [ -f "$ROOTFS_DIR/usr/local/bin/proot" ]; then
    $ROOTFS_DIR/usr/local/bin/proot \
    --rootfs="${ROOTFS_DIR}" \
    --link2symlink \
    --kill-on-exit \
    --root-id \
    --cwd=/root \
    --bind=/proc \
    --bind=/dev \
    --bind=/sys \
    --bind=/tmp \
    /bin/sh
else
    echo "ERROR: proot not found at $ROOTFS_DIR/usr/local/bin/proot"
    echo "Trying to use host's proot if available..."
    
    # Try to use proot from host system if available
    if command -v proot >/dev/null 2>&1; then
        proot \
        --rootfs="${ROOTFS_DIR}" \
        --link2symlink \
        --kill-on-exit \
        --root-id \
        --cwd=/root \
        --bind=/proc \
        --bind=/dev \
        --bind=/sys \
        --bind=/tmp \
        /bin/sh
    else
        echo "No proot found. Entering chroot environment instead..."
        chroot $ROOTFS_DIR /bin/sh
    fi
fi
