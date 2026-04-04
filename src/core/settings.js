export const appSettings = {
    getShowLegacyArchive() {
        return localStorage.getItem('orbit_show_legacy_archive') === 'true';
    },
    setShowLegacyArchive(val) {
        localStorage.setItem('orbit_show_legacy_archive', val === true ? 'true' : 'false');
    }
};
