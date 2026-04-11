export const appSettings = {
    getShowLegacyArchive() {
        return localStorage.getItem('orbit_show_legacy_archive') === 'true';
    },
    setShowLegacyArchive(val) {
        localStorage.setItem('orbit_show_legacy_archive', val === true ? 'true' : 'false');
    },
    getDailyFolderId() {
        return localStorage.getItem('orbit_daily_board_folder_id') || null;
    },
    setDailyFolderId(val) {
        if (!val) localStorage.removeItem('orbit_daily_board_folder_id');
        else localStorage.setItem('orbit_daily_board_folder_id', val);
    },
    getWeeklyFolderId() {
        return localStorage.getItem('orbit_weekly_board_folder_id') || null;
    },
    setWeeklyFolderId(val) {
        if (!val) localStorage.removeItem('orbit_weekly_board_folder_id');
        else localStorage.setItem('orbit_weekly_board_folder_id', val);
    },
    getEmacsEditingEnabled() {
        return localStorage.getItem('orbit_emacs_editing') === 'true';
    },
    setEmacsEditingEnabled(val) {
        localStorage.setItem('orbit_emacs_editing', val === true ? 'true' : 'false');
    }
};
