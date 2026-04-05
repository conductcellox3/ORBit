export function getTodayString(baseDate = new Date()) {
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

export function getMondayString(baseDate = new Date()) {
    const d = new Date(baseDate.getTime());
    const day = d.getDay();
    // Monday is 1. If today is Sunday (0), we need to go back 6 days.
    // Otherwise, we go back (day - 1) days.
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    return getTodayString(d);
}

export function getIsoWeekString(baseDate = new Date()) {
    const d = new Date(Date.UTC(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    const mondayStr = getMondayString(baseDate);
    // returns something like "2026-W14 (03-30)"
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')} (${mondayStr.substring(5)})`;
}
