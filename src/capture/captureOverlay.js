import { invoke, convertFileSrc } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { writeImage } from '@tauri-apps/plugin-clipboard-manager';

const appWindow = getCurrentWindow();

let isDragging = false;
let startX = 0;
let startY = 0;
let captureInfo = null;

const container = document.getElementById('overlay-container');
const selectionBox = document.getElementById('selection-box');
const darkMask = document.getElementById('dark-mask');
const helpText = document.querySelector('.help-text');

async function init(payloadInfo = null) {
    isDragging = false;
    selectionBox.style.left = '0px';
    selectionBox.style.top = '0px';
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.classList.remove('active');
    darkMask.classList.remove('hidden');
    helpText.style.display = 'block';

    try {
        if (payloadInfo && payloadInfo.info) {
            captureInfo = JSON.parse(payloadInfo.info);
        } else {
            const infoStr = localStorage.getItem('orbit_capture_info');
            if (infoStr) {
                captureInfo = JSON.parse(infoStr);
            }
        }
        
        if (captureInfo) {
            const imgUrl = convertFileSrc(captureInfo.temp_path) + '?t=' + Date.now();
            container.style.backgroundImage = `url("${imgUrl}")`;
        } else {
            console.error('No capture info found.');
            await cancel();
            return;
        }

        // We assume main window handles appWindow.show() before emitting init
        await appWindow.setFocus();
    } catch (e) {
        console.error(e);
        await cancel();
    }
}

// Ensure clean cancel
async function cancel() {
    try {
        await invoke('cancel_capture_session');
    } catch(e) {}
    localStorage.setItem('orbit_capture_result', JSON.stringify({
        status: 'cancelled',
        timestamp: Date.now()
    }));
    await appWindow.hide();
}

window.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape') {
        await cancel();
    }
});

container.addEventListener('mousedown', (e) => {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    
    selectionBox.style.left = `${startX}px`;
    selectionBox.style.top = `${startY}px`;
    selectionBox.style.width = '0px';
    selectionBox.style.height = '0px';
    selectionBox.classList.add('active');
    
    darkMask.classList.add('hidden');
    helpText.style.display = 'none';
});

container.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    
    const currentX = e.clientX;
    const currentY = e.clientY;
    
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);
    const left = Math.min(currentX, startX);
    const top = Math.min(currentY, startY);
    
    selectionBox.style.left = `${left}px`;
    selectionBox.style.top = `${top}px`;
    selectionBox.style.width = `${width}px`;
    selectionBox.style.height = `${height}px`;
});

container.addEventListener('mouseup', async (e) => {
    if (!isDragging) return;
    isDragging = false;
    
    // Get final selection
    const rectStr = selectionBox.getBoundingClientRect();
    
    // Discard empty/small selections (clicks)
    if (rectStr.width < 5 || rectStr.height < 5) {
        selectionBox.classList.remove('active');
        darkMask.classList.remove('hidden');
        helpText.style.display = 'block';
        return;
    }

    try {
        // Calculate DPI scaling
        // The overlay might be physically smaller/larger than the logical pixels if the OS scales.
        // xcap captures actual physical bounds / layout bounds depending on OS.
        // We scale based on window.innerWidth vs original_width.
        const scaleX = captureInfo.original_width / window.innerWidth;
        const scaleY = captureInfo.original_height / window.innerHeight;

        const selectionRect = {
            x: Math.max(0, Math.round(rectStr.left * scaleX)),
            y: Math.max(0, Math.round(rectStr.top * scaleY)),
            width: Math.min(captureInfo.original_width, Math.round(rectStr.width * scaleX)),
            height: Math.min(captureInfo.original_height, Math.round(rectStr.height * scaleY))
        };

        // Output path (Main Window generates filename but we can just ask backend or pass it)
        const assetsDir = captureInfo.assets_dir;
        
        // Hide window immediately to feel snappy
        await appWindow.hide();

        const savedPath = await invoke('finish_capture_session', { 
            rect: selectionRect,
            outPathAbs: captureInfo.out_path
        });

        // Try copying to clipboard wrapper
        try {
            await writeImage(captureInfo.out_path);
        } catch (clipErr) {
            console.error("Clipboard copy failed, continuing:", clipErr);
        }

        // Notify main window
        localStorage.setItem('orbit_capture_result', JSON.stringify({
            status: 'success',
            path: savedPath,
            relativeSrc: captureInfo.relative_src,
            originalWidth: selectionRect.width,
            originalHeight: selectionRect.height,
            selectionRect: {
                x: selectionRect.x + captureInfo.virtual_bounds.x,
                y: selectionRect.y + captureInfo.virtual_bounds.y,
                width: selectionRect.width,
                height: selectionRect.height
            },
            timestamp: Date.now()
        }));

    } catch (err) {
        console.error('Capture finish failed:', err);
        localStorage.setItem('orbit_capture_result', JSON.stringify({
            status: 'error',
            error: err.toString(),
            timestamp: Date.now()
        }));
        await cancel();
    }
});

// Setup
listen('init-capture', (event) => {
    if (event.payload) {
        init(event.payload);
    } else {
        init();
    }
});
