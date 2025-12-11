// apn.js
const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const https = require('https');
const http = require('http');

// Konfigurasi
const ROOTFS_DIR = '/home/nextjs';
const ALPINE_VERSION = "3.18";
const ALPINE_FULL_VERSION = "3.18.3";
const APK_TOOLS_VERSION = "2.14.0-r2";
const PROOT_VERSION = "5.3.0";

// Utility functions
function execCommand(cmd) {
    try {
        return execSync(cmd, { stdio: 'inherit' });
    } catch (error) {
        console.error(`Error executing command: ${cmd}`, error);
        throw error;
    }
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const protocol = url.startsWith('https') ? https : http;
        
        protocol.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
                return;
            }
            
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {}); // Hapus file jika error
            reject(err);
        });
    });
}

async function detectArchitecture() {
    const arch = process.arch;
    
    if (arch === 'x64') {
        return { arch: 'x86_64', archAlt: 'amd64' };
    } else if (arch === 'arm64') {
        return { arch: 'aarch64', archAlt: 'arm64' };
    } else {
        throw new Error(`Unsupported CPU architecture: ${arch}`);
    }
}

async function installAlpine() {
    console.log('Starting Alpine Linux installation...');
    
    const { arch, archAlt } = await detectArchitecture();
    const installedMarker = path.join(ROOTFS_DIR, '.installed');
    
    // Step 1: Download and extract root filesystem
    if (!fs.existsSync(installedMarker)) {
        console.log('Downloading Alpine Linux root filesystem...');
        
        const rootfsUrl = `https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/${arch}/alpine-minirootfs-${ALPINE_FULL_VERSION}-${arch}.tar.gz`;
        const rootfsPath = '/tmp/rootfs.tar.gz';
        
        await downloadFile(rootfsUrl, rootfsPath);
        
        console.log('Extracting Alpine Linux root filesystem...');
        execCommand(`tar -xzf ${rootfsPath} -C ${ROOTFS_DIR}`);
        
        // Step 2: Download required packages
        console.log('Downloading required packages...');
        
        const apkToolsUrl = `https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/main/${arch}/apk-tools-static-${APK_TOOLS_VERSION}.apk`;
        const gottyUrl = `https://github.com/sorenisanerd/gotty/releases/download/v1.5.0/gotty_v1.5.0_linux_${archAlt}.tar.gz`;
        
        await Promise.all([
            downloadFile(apkToolsUrl, '/tmp/apk-tools-static.apk'),
            downloadFile(gottyUrl, '/tmp/gotty.tar.gz')
        ]);
        
        // Create directories
        const usrLocalBin = path.join(ROOTFS_DIR, 'usr/local/bin');
        if (!fs.existsSync(usrLocalBin)) {
            fs.mkdirSync(usrLocalBin, { recursive: true });
        }
        
        // Download proot
        console.log('Downloading proot...');
        const prootUrl = `https://github.com/proot-me/proot/releases/download/v${PROOT_VERSION}/proot-v${PROOT_VERSION}-${arch}-static`;
        await downloadFile(prootUrl, '/tmp/proot');
        
        // Extract packages
        console.log('Extracting packages...');
        execCommand(`tar -xzf /tmp/apk-tools-static.apk -C /tmp/`);
        execCommand(`tar -xzf /tmp/gotty.tar.gz -C ${usrLocalBin}`);
        
        // Move proot to correct location
        fs.renameSync('/tmp/proot', path.join(usrLocalBin, 'proot'));
        
        // Install base system packages
        console.log('Installing base system packages...');
        execCommand(`/tmp/sbin/apk.static -X "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/main/" -U --allow-untrusted --root ${ROOTFS_DIR} add alpine-base apk-tools`);
        
        // Set permissions
        console.log('Setting up permissions...');
        fs.chmodSync(path.join(usrLocalBin, 'proot'), 0o755);
        fs.chmodSync(path.join(usrLocalBin, 'gotty'), 0o755);
        
        // Verify installation
        console.log('Verifying installation...');
        const files = fs.readdirSync(usrLocalBin);
        console.log('Files in /usr/local/bin:', files);
        
        // Step 3: Finalize installation
        console.log('Finalizing installation...');
        
        // Create resolv.conf
        const etcDir = path.join(ROOTFS_DIR, 'etc');
        if (!fs.existsSync(etcDir)) {
            fs.mkdirSync(etcDir, { recursive: true });
        }
        
        fs.writeFileSync(
            path.join(etcDir, 'resolv.conf'),
            "nameserver 1.1.1.1\nnameserver 1.0.0.1"
        );
        
        // Clean up
        ['/tmp/apk-tools-static.apk', '/tmp/rootfs.tar.gz', '/tmp/sbin', '/tmp/gotty.tar.gz'].forEach(file => {
            try {
                if (fs.existsSync(file)) {
                    if (fs.statSync(file).isDirectory()) {
                        fs.rmSync(file, { recursive: true });
                    } else {
                        fs.unlinkSync(file);
                    }
                }
            } catch (error) {
                console.warn(`Warning: Could not clean up ${file}:`, error.message);
            }
        });
        
        // Create installed marker
        fs.writeFileSync(installedMarker, '');
        console.log('Installation complete!');
    } else {
        console.log('Alpine Linux already installed.');
    }
}

function displayWelcomeMessage() {
    console.log(`
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

Current Alpine Host: Alpine Linux ${ALPINE_VERSION}
 
`);
}

async function startProotEnvironment() {
    const prootPath = path.join(ROOTFS_DIR, 'usr/local/bin/proot');
    
    console.log('Checking for proot...');
    try {
        const stats = fs.statSync(prootPath);
        console.log(`proot found: ${stats.size} bytes`);
    } catch (error) {
        console.log('proot not found at:', prootPath);
    }
    
    console.log('Starting PRoot environment...');
    
    if (fs.existsSync(prootPath)) {
        const args = [
            '--rootfs=' + ROOTFS_DIR,
            '--link2symlink',
            '--kill-on-exit',
            '--root-id',
            '--cwd=/root',
            '--bind=/proc',
            '--bind=/dev',
            '--bind=/sys',
            '--bind=/tmp',
            '/bin/sh'
        ];
        
        const prootProcess = spawn(prootPath, args, {
            stdio: 'inherit',
            env: process.env
        });
        
        prootProcess.on('close', (code) => {
            console.log(`PRoot process exited with code ${code}`);
            process.exit(code);
        });
        
    } else {
        console.log('ERROR: proot not found at', prootPath);
        console.log('Trying to use host\'s proot if available...');
        
        try {
            execSync('which proot', { stdio: 'pipe' });
            
            const args = [
                '--rootfs=' + ROOTFS_DIR,
                '--link2symlink',
                '--kill-on-exit',
                '--root-id',
                '--cwd=/root',
                '--bind=/proc',
                '--bind=/dev',
                '--bind=/sys',
                '--bind=/tmp',
                '/bin/sh'
            ];
            
            const prootProcess = spawn('proot', args, {
                stdio: 'inherit',
                env: process.env
            });
            
            prootProcess.on('close', (code) => {
                console.log(`PRoot process exited with code ${code}`);
                process.exit(code);
            });
            
        } catch (error) {
            console.log('No proot found. Entering chroot environment instead...');
            
            const chrootArgs = [ROOTFS_DIR, '/bin/sh'];
            const chrootProcess = spawn('chroot', chrootArgs, {
                stdio: 'inherit',
                env: process.env
            });
            
            chrootProcess.on('close', (code) => {
                console.log(`Chroot process exited with code ${code}`);
                process.exit(code);
            });
        }
    }
}

// Main execution
async function main() {
    try {
        // Ensure /home/container exists
        if (!fs.existsSync(ROOTFS_DIR)) {
            fs.mkdirSync(ROOTFS_DIR, { recursive: true });
        }
        
        await installAlpine();
        displayWelcomeMessage();
        await startProotEnvironment();
    } catch (error) {
        console.error('An error occurred:', error);
        process.exit(1);
    }
}

// Run the main function
main();
