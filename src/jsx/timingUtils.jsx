/**
 * Timing utilities for performance measurement in ExtendScript
 * Ensures compatibility with `.debug`
 */

/*************************************************************************
 * Ensure Debugging is Included Only Once
 *************************************************************************/

// Check if `DEBUG_LEVELS` exists before including `.debug`
if (typeof DEBUG_LEVELS === "undefined") {
    #include "../../.debug"
}

/**
 * Checkpoint object constructor
 * Stores timing data for performance tracking.
 */
function CheckPoint(label, time, sinceStart, sinceLast) {
    this.label = label;
    this.time = time;
    this.sinceStart = sinceStart;
    this.sinceLast = sinceLast;
}

/**
 * Get current time in milliseconds
 * Uses `.debug` function if available.
 * @returns {number} Current time in milliseconds
 */
function getCurrentTime() {
    return (typeof getCurrentTime === "function") ? getCurrentTime() : new Date().getTime();
}

/**
 * Format elapsed time in a readable format
 * Uses `.debug` function if available.
 * @param {number} startTime - Start time in milliseconds
 * @param {number} endTime - End time in milliseconds
 * @returns {string} Formatted elapsed time (e.g., "2.34s" or "450ms")
 */
function formatElapsedTime(startTime, endTime) {
    if (typeof formatElapsedTime === "function") {
        return formatElapsedTime(startTime, endTime);
    }

    var elapsed = endTime - startTime;
    return (elapsed < 1000) ? elapsed.toString() + "ms" : (elapsed / 1000).toFixed(2) + "s";
}

/**
 * Performance timer class for tracking multiple timing points
 * Now integrated with `.debug` settings.
 */
function PerformanceTimer(label) {
    this.label = label || "Timer";
    this.startTime = getCurrentTime();
    this.lastCheckpoint = this.startTime;
    this.checkpoints = new Array();
    this.checkpointCount = 0;

    /**
     * Add a checkpoint with a label
     * @param {string} label - Label for this checkpoint
     */
    this.checkpoint = function(label) {
        if (typeof TIMING_LEVELS === "undefined" || TIMING_LEVELS.FUNCTIONS < TIMING_LEVELS.OPERATIONS) {
            return; // Skip if timing is disabled in `.debug`
        }

        var currentTime = getCurrentTime();
        var sinceStart = formatElapsedTime(this.startTime, currentTime);
        var sinceLast = formatElapsedTime(this.lastCheckpoint, currentTime);
        
        // Create checkpoint object
        var cp = new CheckPoint(label, currentTime, sinceStart, sinceLast);
        this.checkpoints[this.checkpointCount] = cp;
        this.checkpointCount++;
        this.lastCheckpoint = currentTime;

        // Log checkpoint
        if (typeof writeToLog === "function") {
            writeToLog("[TIMER] " + this.label + " - " + label + 
                       " - Since start: " + sinceStart + 
                       ", Since last: " + sinceLast);
        }
    };

    /**
     * Get summary of all checkpoints
     * @returns {string} Formatted summary of all checkpoints.
     */
    this.getSummary = function() {
        if (typeof TIMING_LEVELS === "undefined" || TIMING_LEVELS.FUNCTIONS < TIMING_LEVELS.OPERATIONS) {
            return "Timing disabled by `.debug` settings.";
        }

        var result = "Performance Summary for " + this.label + ":\n";
        for (var i = 0; i < this.checkpointCount; i++) {
            var cp = this.checkpoints[i];
            result += "  " + cp.label + ":\n";
            result += "    Since start: " + cp.sinceStart + "\n";
            result += "    Since last: " + cp.sinceLast + "\n";
        }
        return result;
    };

    /**
     * Get total elapsed time since timer creation
     * @returns {string} Formatted elapsed time
     */
    this.getTotalTime = function() {
        if (typeof TIMING_LEVELS === "undefined" || TIMING_LEVELS.FUNCTIONS < TIMING_LEVELS.OPERATIONS) {
            return "Timing disabled by `.debug` settings.";
        }
        return formatElapsedTime(this.startTime, getCurrentTime());
    };

    // Log timer creation
    if (typeof writeToLog === "function") {
        writeToLog("[TIMER] Timer created: " + this.label);
    }
}
