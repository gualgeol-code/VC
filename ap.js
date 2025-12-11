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
function execCommand(cmd, options = {}) {
    console.log(`Executing: ${cmd}`);
    try {
        return execSync(cmd, { stdio: 'inherit', ...options });
    } catch (error) {
        console.error(`Error executing command: ${cmd}`, error.message);
        if (error.stderr) {
            console.error('Stderr:', error.stderr.toString());
        }
        throw error;
    }
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        console.log(`Downloading ${url} to ${dest}`);
        const file = fs.createWriteStream(dest);
        const protocol = url.startsWith('https') ? https : http;
        
        const request = protocol.get(url, (response) => {
            console.log(`Response status: ${response.statusCode} for ${url}`);
            
            if (response.statusCode === 302 || response.statusCode === 301) {
                // Handle redirect
                const redirectUrl = response.headers.location;
                console.log(`Redirecting to: ${redirectUrl}`);
                downloadFile(redirectUrl, dest).then(resolve).catch(reject);
                return;
            }
            
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
                return;
            }
            
            const contentLength = response.headers['content-length'];
            let downloaded = 0;
            
            response.on('data', (chunk) => {
                downloaded += chunk.length;
                if (contentLength) {
                    const percent = (downloaded / contentLength * 100).toFixed(2);
                    process.stdout.write(`\rDownload progress: ${percent}%`);
                }
            });
            
            response.pipe(file);
            
            file.on('finish', () => {
                file.close();
                console.log('\nDownload completed successfully');
                resolve();
            });
        }).on('error', (err) => {
            fs.unlink(dest, () => {}); // Hapus file jika error
            reject(err);
        });
        
        request.setTimeout(30000, () => {
            request.destroy();
            reject(new Error(`Download timeout for ${url}`));
        });
    });
}

async function detectArchitecture() {
    // Gunakan uname untuk deteksi yang lebih akurat
    try {
        const arch = execSync('uname -m', { encoding: 'utf8' }).trim();
        
        if (arch === 'x86_64') {
            return { arch: 'x86_64', archAlt: 'amd64' };
        } else if (arch === 'aarch64' || arch === 'arm64') {
            return { arch: 'aarch64', archAlt: 'arm64' };
        } else {
            throw new Error(`Unsupported CPU architecture: ${arch}`);
        }
    } catch (error) {
        // Fallback ke process.arch
        const arch = process.arch;
        
        if (arch === 'x64') {
            return { arch: 'x86_64', archAlt: 'amd64' };
        } else if (arch === 'arm64') {
            return { arch: 'aarch64', archAlt: 'arm64' };
        } else {
            throw new Error(`Unsupported CPU architecture: ${arch}`);
        }
    }
}

async function installAlpine() {
    console.log('Starting Alpine Linux installation...');
    
    const { arch, archAlt } = await detectArchitecture();
    console.log(`Detected architecture: ${arch} (${archAlt})`);
    
    const installedMarker = path.join(ROOTFS_DIR, '.installed');
    
    // Step 1: Download and extract root filesystem
    if (!fs.existsSync(installedMarker)) {
        console.log('Downloading Alpine Linux root filesystem...');
        
        const rootfsUrl = `https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/${arch}/alpine-minirootfs-${ALPINE_FULL_VERSION}-${arch}.tar.gz`;
        const rootfsPath = '/tmp/rootfs.tar.gz';
        
        try {
            await downloadFile(rootfsUrl, rootfsPath);
        } catch (error) {
            console.error(`Failed to download rootfs: ${error.message}`);
            // Coba versi alternatif
            const altRootfsUrl = `https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/releases/${arch}/alpine-minirootfs-${ALPINE_VERSION}.0-${arch}.tar.gz`;
            console.log(`Trying alternative URL: ${altRootfsUrl}`);
            await downloadFile(altRootfsUrl, rootfsPath);
        }
        
        console.log('Extracting Alpine Linux root filesystem...');
        if (!fs.existsSync(ROOTFS_DIR)) {
            fs.mkdirSync(ROOTFS_DIR, { recursive: true });
        }
        execCommand(`tar -xzf ${rootfsPath} -C ${ROOTFS_DIR}`);
        
        // Step 2: Download required packages
        console.log('Downloading required packages...');
        
        // URL yang benar untuk apk-tools-static
        // Perhatikan bahwa struktur URL Alpine bisa berbeda
        const apkToolsUrls = [
            `https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/main/${arch}/apk-tools-static-${APK_TOOLS_VERSION}.apk`,
            `https://dl-cdn.alpinelinux.org/alpine/latest-stable/main/${arch}/apk-tools-static-${APK_TOOLS_VERSION}.apk`,
            `https://dl-cdn.alpinelinux.org/alpine/edge/main/${arch}/apk-tools-static-${APK_TOOLS_VERSION}.apk`
        ];
        
        const gottyUrl = `https://github.com/sorenisanerd/gotty/releases/download/v1.5.0/gotty_v1.5.0_linux_${archAlt}.tar.gz`;
        
        let apkDownloaded = false;
        for (const url of apkToolsUrls) {
            try {
                console.log(`Trying to download apk-tools from: ${url}`);
                await downloadFile(url, '/tmp/apk-tools-static.apk');
                apkDownloaded = true;
                break;
            } catch (error) {
                console.log(`Failed: ${error.message}`);
            }
        }
        
        if (!apkDownloaded) {
            throw new Error('Could not download apk-tools-static from any mirror');
        }
        
        await downloadFile(gottyUrl, '/tmp/gotty.tar.gz');
        
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
        
        // Cek apakah file apk-tools ada sebelum mengekstrak
        if (!fs.existsSync('/tmp/apk-tools-static.apk')) {
            throw new Error('apk-tools-static.apk not found');
        }
        
        execCommand(`tar -xzf /tmp/apk-tools-static.apk -C /tmp/`);
        execCommand(`tar -xzf /tmp/gotty.tar.gz -C ${usrLocalBin}`);
        
        // Move proot to correct location
        fs.renameSync('/tmp/proot', path.join(usrLocalBin, 'proot'));
        
        // Install base system packages
        console.log('Installing base system packages...');
        const apkStaticPath = '/tmp/sbin/apk.static';
        if (!fs.existsSync(apkStaticPath)) {
            // Cari apk.static di lokasi alternatif
            const possiblePaths = [
                '/tmp/sbin/apk.static',
                '/tmp/usr/sbin/apk.static',
                '/tmp/bin/apk.static'
            ];
            
            let foundApkStatic = false;
            for (const possiblePath of possiblePaths) {
                if (fs.existsSync(possiblePath)) {
                    console.log(`Found apk.static at: ${possiblePath}`);
                    execCommand(`${possiblePath} -X "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/main/" -U --allow-untrusted --root ${ROOTFS_DIR} add alpine-base apk-tools`);
                    foundApkStatic = true;
                    break;
                }
            }
            
            if (!foundApkStatic) {
                throw new Error('apk.static not found after extraction');
            }
        } else {
            execCommand(`${apkStaticPath} -X "https://dl-cdn.alpinelinux.org/alpine/v${ALPINE_VERSION}/main/" -U --allow-untrusted --root ${ROOTFS_DIR} add alpine-base apk-tools`);
        }
        
        // Set permissions
        console.log('Setting up permissions...');
        fs.chmodSync(path.join(usrLocalBin, 'proot'), 0o755);
        
        const gottyPath = path.join(usrLocalBin, 'gotty');
        if (fs.existsSync(gottyPath)) {
            fs.chmodSync(gottyPath, 0o755);
        }
        
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
        console.log('Cleaning up temporary files...');
        const tempFiles = [
            '/tmp/apk-tools-static.apk',
            '/tmp/rootfs.tar.gz',
            '/tmp/gotty.tar.gz'
        ];
        
        for (const file of tempFiles) {
            try {
                if (fs.existsSync(file)) {
                    fs.unlinkSync(file);
                    console.log(`Removed: ${file}`);
                }
            } catch (error) {
                console.warn(`Warning: Could not remove ${file}:`, error.message);
            }
        }
        
        // Remove /tmp/sbin directory if exists
        const tmpSbin = '/tmp/sbin';
        if (fs.existsSync(tmpSbin)) {
            try {
                fs.rmSync(tmpSbin, { recursive: true });
                console.log(`Removed directory: ${tmpSbin}`);
            } catch (error) {
                console.warn(`Warning: Could not remove ${tmpSbin}:`, error.message);
            }
        }
        
        // Create installed marker
        fs.writeFileSync(installedMarker, `Alpine Linux ${ALPINE_VERSION} installed on ${new Date().toISOString()}\nArchitecture: ${arch}`);
        console.log('Installation complete!');
    } else {
        console.log('Alpine Linux already installed.');
        const markerContent = fs.readFileSync(installedMarker, 'utf8');
        console.log('Installation info:', markerContent);
    }
}

function displayWelcomeMessage() {
    console.log(`
 █████╗ ██╗     ██████╗ ██╗███╗   ██╗███████╗
██╔══██╗██║     ██╔══██╗██║████╗  ██║██╔════╝
███████║██║     ██████╔╝██║██╔██╗ ██║█████╗  
██╔══██║██║     ██╔═══╝ ██║██║╚██╗██║██╔══╝  
██║  ██║███████╗██║     ██║██║ ╚████║███████╗
╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝  ╚═══╝╚══════╝
 
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

Alpine Version: ${ALPINE_VERSION}
 
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
        
        console.log('Starting proot with args:', args);
        
        const prootProcess = spawn(prootPath, args, {
            stdio: 'inherit',
            env: { ...process.env, PATH: '/usr/local/bin:/usr/bin:/bin' }
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
            console.log('Found proot in host system');
            
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
        console.log('Alpine Linux Installer - Node.js Version');
        console.log('=========================================');
        
        // Ensure /home/container exists
        if (!fs.existsSync(ROOTFS_DIR)) {
            console.log(`Creating directory: ${ROOTFS_DIR}`);
            fs.mkdirSync(ROOTFS_DIR, { recursive: true });
        }
        
        await installAlpine();
        displayWelcomeMessage();
        await startProotEnvironment();
    } catch (error) {
        console.error('\n❌ An error occurred:', error.message);
        console.error('Stack trace:', error.stack);
        process.exit(1);
    }
}

// Run the main function
if (require.main === module) {
    main();
}

module.exports = { installAlpine, startProotEnvironment };
