/**
 * Version info - update BUILD_TIME with each release
 */
const VERSION = {
    number: '1.0.2',
    buildTime: '2025-02-14T19:45:00Z',

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
