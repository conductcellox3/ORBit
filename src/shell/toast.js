let activeToast = null;
let toastTimeout = null;

export function showToast(message, durationMs = 2000) {
    if (activeToast) {
        activeToast.remove();
        if (toastTimeout) clearTimeout(toastTimeout);
    }
    
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.className = 'orbit-toast';
    toast.style.position = 'absolute';
    toast.style.top = '60px'; // Just below topbar
    toast.style.left = '50%';
    toast.style.transform = 'translateX(-50%)';
    toast.style.backgroundColor = '#323232';
    toast.style.color = '#FFFFFF';
    toast.style.padding = '8px 16px';
    toast.style.borderRadius = '20px';
    toast.style.fontSize = '12px';
    toast.style.fontWeight = '500';
    toast.style.pointerEvents = 'none';
    toast.style.zIndex = '9999';
    toast.style.boxShadow = '0 2px 8px rgba(0,0,0,0.15)';
    toast.style.opacity = '1';
    toast.style.transition = 'opacity 0.2s ease';
    
    document.body.appendChild(toast);
    activeToast = toast;
    
    toastTimeout = setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => {
            if (activeToast === toast) {
                toast.remove();
                activeToast = null;
            }
        }, 200);
    }, durationMs);
}
