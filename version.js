/**
 * Version info - update BUILD_TIME with each release
 */
const VERSION = {
    number: '1.1.5',
    buildTime: '2026-02-17T14:30:00Z',

    // Format for display
    getDisplayString: function() {
        const date = new Date(this.buildTime);
        const formatted = date.toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false
        });
        return `v${this.number} (${formatted})`;
    }
};
