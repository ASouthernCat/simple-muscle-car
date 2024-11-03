export default function isMobileDevice() {
    if (/Mobi|Android|iPhone/i.test(navigator.userAgent) ||
        'ontouchstart' in document.documentElement) {
        return true;
    }
    else {
        return false; //非移动设备
    }
}