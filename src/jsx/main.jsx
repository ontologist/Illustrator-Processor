#target illustrator

// Debug Log Manager
// Base logging setup - your original functions
var logFile = null; // Global log file variable for logging

/**
 * Initializes the log file in the Desktop/ExtendScript-logs directory.
 */
function initLogFile() {
    try {
        var now = new Date();
        var datePart = now.getYear() + 1900 + "-" + ("0" + (now.getMonth() + 1)).slice(-2) + "-" + ("0" + now.getDate()).slice(-2);
        var timePart = ("0" + now.getHours()).slice(-2) + "-" + ("0" + now.getMinutes()).slice(-2) + "-" + ("0" + now.getSeconds()).slice(-2);
        var logFolder = new Folder("~/Desktop/extendscript-logs");
        if (!logFolder.exists) {
            logFolder.create();
        }
        var logFileName = "illustrator-debug-" + datePart + "_" + timePart + ".log";
        logFile = new File(logFolder.fsName + "/" + logFileName);
        logFile.encoding = "UTF-8";
        logFile.lineFeed = "Unix";
        logFile.open("w"); // Open in write mode
        logFile.writeln("Log session started: " + now);
        logFile.close();
    } catch (error) {
        alert("Error initializing log file: " + error.message);
    }
}

/**
 * Logs messages to a log file.
 *
 * @param {...*} args - The values to log.
 */
function writeToLog() {
    try {
        if (!logFile) {
            initLogFile();
        }

        var message = "";
        for (var i = 0; i < arguments.length; i++) {
            message += (i > 0 ? " " : "") + DebugLogManager.safeString(arguments[i]);
        }

        logFile.open("a");
        logFile.encoding = "UTF-8";
        logFile.lineFeed = "Unix";
        logFile.writeln(new Date() + " - " + message + "\n\n");
        logFile.close();
    } catch (error) {
        alert("Error writing to log: " + error.message);
    }
}

// ExtendScript-Compatible Alternative
function serialize(obj) {
    var str = "{";
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            str += key + ": " + obj[key] + ", ";
        }
    }
    return str.slice(0, -2) + "}";
}

/**
 * Serializes the confirmed overlaps into a structured list format.
 * @param {Object} confirmedOverlaps - Object containing part names as keys and LED info as values.
 * @returns {String} - Serialized string representation of the overlaps.
 */
function serializeConfirmedOverlaps(confirmedOverlaps) {
    try {
        if (!confirmedOverlaps || typeof confirmedOverlaps !== "object") {
            DebugLogManager.error("[SERIALIZE] Invalid confirmedOverlaps data.");
            return "[]"; // Return empty list format
        }

        var serializedList = "[";
        var partCount = 0;

        for (var partName in confirmedOverlaps) {
            if (!confirmedOverlaps.hasOwnProperty(partName)) continue;

            var ledEntries = [];
            var ledCount = confirmedOverlaps[partName].length; // Count LEDs per part

            for (var i = 0; i < ledCount; i++) {
                var ledEntry = confirmedOverlaps[partName][i];
                var ledName = ledEntry.name; // Keep "LED_xxxx" format
                var confidence = ledEntry.confidence.split("%")[0]; // Remove percentage sign safely

                ledEntries.push("[" + ledName + ", confidence: " + confidence + "]");
            }

            serializedList += "\n  " + partName + " (LED Count: " + ledCount + "): [" + ledEntries.join(", ") + "],";
            partCount++;
        }

        if (partCount === 0) {
            DebugLogManager.warn("[SERIALIZE] No confirmed overlaps found.");
            return "[]";
        }

        serializedList = serializedList.replace(/,$/, ""); // Remove trailing comma
        serializedList += "\n]";

        DebugLogManager.info("[SERIALIZE] Serialized confirmed overlaps successfully.");
        DebugLogManager.info("[SERIALIZE] Total Parts Processed: " + partCount);
        
        return serializedList;

    } catch (error) {
        DebugLogManager.error("[SERIALIZE] Error serializing confirmed overlaps: " + error.toString());
        return "[]";
    }
}



var MeasurementManager = {
    POINTS_TO_MM: 0.352778,
    POINTS_TO_CM: 0.0352778,

    getPathMeasurements: function(item) {
        try {
            if (!item) return null;

            // Ensure fill is applied before measuring area
            this.ensureRGBFill(item);

            return {
                width: {
                    pt: item.width, // ✅ Native .width
                    mm: this.pointsToMM(item.width),
                    cm: this.pointsToCM(item.width)
                },
                height: {
                    pt: item.height, // ✅ Native .height
                    mm: this.pointsToMM(item.height),
                    cm: this.pointsToCM(item.height)
                },
                area: {
                    pt: Math.abs(item.area), // ✅ Native .area
                    mm: this.squarePointsToMMSQ(item.area),
                    cm: this.squarePointsToCMSQ(item.area)
                }
            };
        } catch (e) {
            DebugLogManager.error("Error getting path measurements:", e.toString());
            return null;
        }
    },

    ensureRGBFill: function(item) {
        try {
            if (!item || (item.typename !== "PathItem" && item.typename !== "CompoundPathItem")) {
                return;
            }

            if (!item.filled || !(item.fillColor instanceof RGBColor)) {
                var blackColor = new RGBColor();
                blackColor.red = 0;
                blackColor.green = 0;
                blackColor.blue = 0;

                item.filled = true;
                item.fillColor = blackColor;

                DebugLogManager.info("[FIX] Applied black RGB fill to: " + item.name);
            }
        } catch (e) {
            DebugLogManager.error("Error in ensureRGBFill:", e.toString());
        }
    },

    getVertices: function(item) {
        try {
            if (!item || (item.typename !== "PathItem" && item.typename !== "CompoundPathItem")) return [];

            var vertices = [];
            for (var i = 0; i < item.pathPoints.length; i++) {
                vertices.push({
                    x: item.pathPoints[i].anchor[0],
                    y: item.pathPoints[i].anchor[1]
                });
            }

            return vertices;
        } catch (e) {
            DebugLogManager.error("Error getting vertices:", e.toString());
            return [];
        }
    },

    // Conversion methods for linear measurements
    pointsToMM: function(points) {
        return points * this.POINTS_TO_MM;
    },

    pointsToCM: function(points) {
        return points * this.POINTS_TO_CM;
    },

    // Methods for area conversions (squared conversion factors)
    squarePointsToMMSQ: function(points) {
        return points * Math.pow(this.POINTS_TO_MM, 2);
    },

    squarePointsToCMSQ: function(sqPoints) {
        return sqPoints * Math.pow(this.POINTS_TO_CM, 2);
    }
};


// Debug Log Manager
var DebugLogManager = {
    enabled: true,
    
    // Safely convert any value to string for logging
    safeString: function(value) {
        if (value === null) return "null";
        if (value === undefined) return "undefined";
        if (value instanceof Error) {
            return "[Error: " + value.message + "]";
        }
        if (typeof value === "object") {
            try {
                var str = "{";
                for (var prop in value) {
                    if (value.hasOwnProperty(prop)) {
                        if (str.length > 1) str += ", ";
                        str += prop + ": " + this.safeString(value[prop]);
                    }
                }
                return str + "}";
            } catch(e) {
                return "[Object]";
            }
        }
        return String(value);
    },
    
    // Log with level prefix
    _log: function(level) {
        if (!this.enabled) return;
        
        try {
            var args = [];
            args.push("[" + level + "]");
            
            // Convert all arguments after the level to safe strings
            for (var i = 1; i < arguments.length; i++) {
                args.push(this.safeString(arguments[i]));
            }
            
            writeToLog.apply(null, args);
        } catch(e) {
            alert("Logging error: " + e.message);
        }
    },
    
    error: function() {
        var args = ["ERROR"];
        for (var i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
        }
        this._log.apply(this, args);
    },
    
    warn: function() {
        var args = ["WARN"];
        for (var i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
        }
        this._log.apply(this, args);
    },
    
    info: function() {
        var args = ["INFO"];
        for (var i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
        }
        this._log.apply(this, args);
    },
    
    debug: function() {
        var args = ["DEBUG"];
        for (var i = 0; i < arguments.length; i++) {
            args.push(arguments[i]);
        }
        this._log.apply(this, args);
    }
};


// Constants
var LOG_KEYS = {
    DOC_PATH: 'Document path',
    DOC_NAME: 'Document name',
    EXPORT_PATH: 'Export path',
    LAYER_COUNT: 'Number of layers',
    LAYER_NAME: 'Processing layer',
    LAYER_CHARS: 'Layer chars',
    TARGET_FOUND: 'Found target layer',
    AREA_POINTS: 'Area (ptsq)',
    AREA_MM: 'Area (mmsq)',
    AREA_CM: 'Area (cmsq)',
    HEIGHT_POINTS: 'Max Height (points)',
    HEIGHT_MM: 'Max Height (mm)',
    HEIGHT_CM: 'Max Height (cm)',
    LED_COUNT: 'LED Group Count',

    SHAPES_LAYER: 'Shapes layer',
    TARGET_LAYER: 'Target layer',
    LED_LAYER: 'LED layer',
  
    SHAPE_NAME_ROOT: 'Part_',
    SHAPE_PATH: 'Part_path_',
    SHAPE_HEIGHT_PT: 'Part_height_(pt)_',
    SHAPE_HEIGHT_MM: 'Part_height_(mm)_',
    SHAPE_HEIGHT_CM: 'Part_height_(cm)_',
    SHAPE_WIDTH_PT: 'Part_width_(pt)_',
    SHAPE_WIDTH_MM: 'Part_width_(mm)_',
    SHAPE_WIDTH_CM: 'Part_width_(cm)_',
    SHAPE_AREA_PTSQ: 'Part_area_(ptsq)_',
    SHAPE_AREA_MMSQ: 'Part_area_(mmsq)_',
    SHAPE_AREA_CMSQ: 'Part_area_(cmsq)_',
    SHAPE_LED_COUNT: 'Part_led_count_',
    SHAPE_LED_LIST: 'Part_led_list_',
    SHAPE_LED_CONFIDENCE: 'Part_leds_conf_',
    SHAPE_PNG_PATH: 'Part_png_path_',
    SHAPE_POS_PNG_PATH: 'Part_pos_png_path_',
    SHAPE_LEDS_PNG_PATH: 'Part_leds_png_path_',
    SHAPE_B64_PATH: 'Part_b64_path_',
    SHAPE_POS_B64_PATH: 'Part_pos_b64_path_',
    SHAPE_LEDS_B64_PATH: 'Part_leds_b64_path_'

};

// Constants
var CONSTANTS = {
    DEFAULT_TARGET_CHARS: [25903, 32102, 12487, 12540, 12479], // '支給データ'
    PADDING: 10,
    USER_INTERACTION: UserInteractionLevel.DONTDISPLAYALERTS
};

// Preferences Manager
var PreferencesManager = {
    init: function () {
    DebugLogManager.info("Initializing the Preferences Manager...");
        app.userInteractionLevel = CONSTANTS.USER_INTERACTION;
        this.setTextPreferences();
        this.setGeneralPreferences();
    },
    
    setTextPreferences: function() {
    try {
        DebugLogManager.info("Setting text preferences...");
        
        // Set preferences in a defined order with error checking
        if (app.preferences){
            app.preferences.setIntegerPreference('ShowLegacyTextDialog', 0);
            app.preferences.setBooleanPreference('ShowLegacyTextDialog', false);
            app.preferences.setIntegerPreference('AutoUpdateLegacyText', 1);
            app.preferences.setBooleanPreference('AutoUpdateLegacyText', true);
            DebugLogManager.info("app.preferences set successfully.")
        } else {
            DebugLogManager.error("app.preferences is not available: ", e.toString());
        }
        
    } catch(e) {
        DebugLogManager.error("Error setting text preferences:", e.toString());
    }
},
    
    setGeneralPreferences: function() {
        DebugLogManager.info("DebugLogManager.setGeneralPreferences...");
        app.preferences.setIntegerPreference('ShowPreserveTextDialog', 0);
        app.preferences.setBooleanPreference('ShowPreserveTextDialog', false);
        app.preferences.setIntegerPreference('ShowOptionsDialog', 0);
    }
};

/**
 * SortingManager - Sorts items based on their position using a grid-based approach.
 * 
 * @param {Array} items - Array of Illustrator items to sort.
 * @param {Number} xTolerance - Tolerance value for x-position to group items into columns.
 * @returns {Array} - Sorted array of items.
 */
var SortingManager = {
    sortPartsByGrid: function (parts, xTolerance) {
        return this.sortByGrid(parts, xTolerance);
    },
    sortLEDsByGrid: function (leds, xTolerance) {
        return this.sortByGrid(leds, xTolerance);
    },
    sortByGrid: function (items, xTolerance) {
        xTolerance = xTolerance || 20;
        
        // Create array of items with their positions
        var itemsWithPos = [];
        for (var i = 0; i < items.length; i++) {
            itemsWithPos.push({
                item: items[i],
                x: items[i].position[0],
                y: items[i].position[1]
            });
        }
        
        // First, group items into columns
        var columns = {};    // Object to hold columns
        var columnKeys = []; // Array to track column x-positions
        
        // Group items into columns based on x-position
        for (var i = 0; i < itemsWithPos.length; i++) {
            var itemData = itemsWithPos[i];
            var foundColumn = false;
            
            // Check if this item belongs to an existing column
            for (var j = 0; j < columnKeys.length; j++) {
                if (Math.abs(itemData.x - columnKeys[j]) <= xTolerance) {
                    var key = columnKeys[j].toString();
                    columns[key].push(itemData);
                    foundColumn = true;
                    break;
                }
            }
            
            // If no matching column found, create new column
            if (!foundColumn) {
                var newKey = itemData.x.toString();
                columnKeys.push(itemData.x);
                columns[newKey] = [itemData];
            }
        }
        
        // Sort column keys from left to right
        columnKeys.sort(function(a, b) {
            return a - b;
        });
        
        // Sort items within each column from top to bottom and combine results
        var sortedItems = [];
        for (var i = 0; i < columnKeys.length; i++) {
            var columnKey = columnKeys[i].toString();
            var columnItems = columns[columnKey];
            
            // Sort this column's items from top to bottom
            columnItems.sort(function(a, b) {
                return b.y - a.y;  // Larger Y value = higher = should come first
            });
            
            // Add sorted items from this column to final array
            for (var j = 0; j < columnItems.length; j++) {
                sortedItems.push(columnItems[j].item);
            }
        }
        
        return sortedItems;
    }
};

/**
 * Manages detection of overlapping items using both bounding box and refined geometry checks.
 * 境界ボックスと詳細な形状チェックの両方を使用して、アイテムの重なりを検出する。
 */
var OverlapDetectionManager = {

                
    // Initialize tracking structures - maintain original tracking
    _mngName: "[OVERLAP]",
    _processResults: {
        pass1_bbox_overlaps: [],
        pass1_confirmed: [],
        pass1_unassigned: [],
        pass1_multi_assigned: [],
        pass2_confirmed: [],
        pass2_unassigned: [],
        pass2_multi_assigned: []
    },
    _cachedLedAssignments: [],

     /**
     * Retrieves the bounding box of a given item.
     * 指定されたアイテムのバウンディングボックスを取得する。
     *
     * @param {PageItem} item - The Illustrator item to analyze. / 解析する Illustrator のアイテム。
     * @returns {Object} Bounding box dimensions {x, y, width, height}. / バウンディングボックスの寸法 {x, y, width, height}。
     */
    getBoundingBox: function (item) {
        var bounds, x, y, width, height;

        try {
            if (!item || !item.visibleBounds) {
                throw new Error("[ERROR] Invalid item provided to getBoundingBox / 無効なアイテムが getBoundingBox に提供されました");
            }

            bounds = item.visibleBounds; // [left, top, right, bottom]

            x = bounds[0]; // Left
            y = bounds[1]; // Top
            width = bounds[2] - bounds[0]; // Right - Left
            height = Math.abs(bounds[3] - bounds[1]); // Bottom - Top (absolute to avoid negative height)

            //DebugLogManager.info("[OverlapDetectionManager] Bounding Box for '" + item.name + "' → X:", x, " Y:", y, " Width:", width, " Height:", height);

        } catch (error) {
            DebugLogManager.error("[OverlapDetectionManager] Failed to get bounding box for item: " + (item.name || "Unnamed") + " - " + error);
            return null;
        }

        return { x: x, y: y, width: width, height: height };
    },

    /**
     * Checks if two bounding boxes overlap.
     * 2 つのバウンディングボックスが重なっているかをチェックする。
     *
     * @param {Object} box1 - First bounding box {x, y, width, height}. / 最初のバウンディングボックス {x, y, width, height}。
     * @param {Object} box2 - Second bounding box {x, y, width, height}. / 2 番目のバウンディングボックス {x, y, width, height}。
     * @returns {boolean} True if overlapping, false otherwise. / 重なっていれば true、そうでなければ false。
     */
    isBoundingBoxOverlapping: function (box1, box2) {
        try {
            if (!box1 || !box2) {
                throw new Error("[ERROR] Invalid bounding boxes provided to isBoundingBoxOverlapping / 無効なバウンディングボックスが提供されました");
            }

            var overlap = !(
                box1.x + box1.width < box2.x ||  // Box1's right edge is left of Box2's left edge
                box2.x + box2.width < box1.x ||  // Box2's right edge is left of Box1's left edge
                box1.y - box1.height > box2.y || // Box1's bottom is above Box2's top
                box2.y - box2.height > box1.y    // Box2's bottom is above Box1's top
            );

            //DebugLogManager.info("[OverlapDetectionManager] Bounding Box Overlap Check → Result:", overlap);
            return overlap;

        } catch (error) {
            DebugLogManager.error("[OverlapDetectionManager] Failed bounding box overlap check: " + error);
            return false;
        }
    },
    
    /**
     * Identifies candidate LED items using a simple bounding box overlap check.
     * シンプルな境界ボックスの重なりチェックを使用して、候補となる LED アイテムを識別する。
     *
     * @param {PathItem|CompoundPathItem} partItem - The target part item. / 対象のパーツアイテム。
     * @param {Array} ledItems - The list of LED group items. / LED グループアイテムのリスト。
     * @returns {Array} The list of LEDs that pass the bounding box check. / 境界ボックスチェックを通過した LED のリスト。
     */
    simpleBoundingBoxOverlap: function (partItems, ledItems) {
        var candidateLEDs = {};
        for (var j = 0; j < partItems.length; j++) {
            var part = partItems[j];
            var partName = part.name;

            for (var i = 0; i < ledItems.length; i++) {
                var led = ledItems[i];
                var ledName = led.name;

                if (this.isBoundingBoxOverlapping(this.getBoundingBox(led), this.getBoundingBox(part))) {
                    if (!candidateLEDs[partName]) {
                        candidateLEDs[partName] = [];
                    }
                    candidateLEDs[partName].push(ledName);
                    //DebugLogManager.info("Bounding box of " + ledName + " overlaps with bounding box of " + partName);
                }
            }
        }
        return candidateLEDs;
    },

    /**
 * Refines overlap by verifying LED vertices inside parts and reassigning unassigned LEDs from bboxResults.
 * Uses sortedParts and sortedLEDs for efficient iteration.
 * 
 * @param {Array} sortedParts - List of ordered parts (PathItems/CompoundPathItems)
 * @param {Array} sortedLEDs - List of ordered LEDs (GroupItems)
 * @param {Object} bboxResults - Original bounding box overlaps mapping parts to LEDs
 * @returns {Object} - Refined overlap mapping with confirmed and fallback reassigned LEDs
 */
    refineOverlapWithGeometry: function (parts, leds, candidateLEDs) {
 try {
        DebugLogManager.info("[REFINE] Starting refinement of bounding box overlaps...");

        var confirmedOverlaps = {}; // Stores final refined results
     var unassignedLEDs = {}; // Tracks unassigned LEDs
     var bboxResults = candidateLEDs;
     var sortedParts = parts;
     var sortedLEDs = leds;

        // **Clear the cached LED count and list before new processing**
        OverlapDetectionManager._cachedLedCounts = [];

        // **Initialize confirmedOverlaps structure and track all initially assigned LEDs**
        for (var i = 0; i < parts.length; i++) {
            var partName = "Part_" + ("00000" + (i + 1)).slice(-5);
            confirmedOverlaps[partName] = [];

            if (bboxResults.hasOwnProperty(partName)) {
                for (var j = 0; j < bboxResults[partName].length; j++) {
                    var ledName = bboxResults[partName][j]; 
                    unassignedLEDs[ledName] = partName; 
                }
            }
        }

        // **Loop through each part efficiently**
        for (var i = 0; i < sortedParts.length; i++) {
            var part = sortedParts[i];
            var partName = "Part_" + ("00000" + (i + 1)).slice(-5);

            if (!bboxResults.hasOwnProperty(partName)) continue;

            var partVertices = PathManager.getPathVertices(part);

            // **Loop through LEDs assigned in bboxResults for this part**
            for (var j = 0; j < bboxResults[partName].length; j++) {
                var ledName = bboxResults[partName][j]; 
                var ledIndex = parseInt(ledName.replace("LED_", ""), 10) - 1;
                
                if (ledIndex < 0 || ledIndex >= sortedLEDs.length) {
                    DebugLogManager.warn("[REFINE] Skipping " + ledName + " (Invalid index: " + ledIndex + ")");
                    continue;
                }

                var led = sortedLEDs[ledIndex];

                var ledVertices = LEDManager.getLEDVertices(led);
                var insideCount = 0;

                // **Check if LED vertices are inside the part**
                for (var v = 0; v < ledVertices.length; v++) {
                    if (this.isPointInPolygon(ledVertices[v], partVertices)) {
                        insideCount++;
                    }
                }

                var confidence = ledVertices.length > 0 ? (insideCount / ledVertices.length) * 100 : 0;

                if (insideCount > 0) {
                    confirmedOverlaps[partName].push({
                        name: ledName, 
                        confidence: confidence.toFixed(2) + "%",
                        insideCount: insideCount,
                        totalVertices: ledVertices.length
                    });

                    delete unassignedLEDs[ledName]; 

                    DebugLogManager.info("[CONFIRM] " + ledName +
                        " confirmed inside " + partName +
                        " with confidence: " + confidence.toFixed(2) + "%");
                }
            }
        }

        // **Fallback Assignment: Reassign any unassigned LEDs to their original bboxResults Part**
        for (var unassignedLED in unassignedLEDs) {
            if (!unassignedLEDs.hasOwnProperty(unassignedLED)) continue;

            var originalPart = unassignedLEDs[unassignedLED]; 
            confirmedOverlaps[originalPart].push({
                name: unassignedLED, 
                confidence: "Fallback Reassignment"
            });

            DebugLogManager.warn("[FALLBACK] " + unassignedLED +
                " reassigned to " + originalPart + " (Fallback from bboxResults)");
        }

        DebugLogManager.info("[REFINE] Refinement completed.");

        // **🚀 NEW: Cache LED Count and List for Later Logging**
        OverlapDetectionManager.cacheLedCounts(sortedParts, confirmedOverlaps);

        this._processResults.pass1_confirmed = confirmedOverlaps;

        return confirmedOverlaps;

    } catch (error) {
        DebugLogManager.error("[REFINE] Error in refineOverlapWithGeometry: " + error.toString());
        return {};
    }
    },


/**
 * Caches Part_led_count_idx and Part_led_list_idx for later logging.
 * 
 * @param {Array} sortedParts - List of ordered parts.
 * @param {Object} confirmedResults - Mapping of parts to confirmed LEDs.
 */
cacheLedCounts: function (sortedParts, confirmedResults) {
    try {
        DebugLogManager.info("[CACHE] Caching confirmed LED counts and lists...");

        var cachedLogs = [];

        for (var i = 0; i < sortedParts.length; i++) {
            var partName = "Part_" + ("00000" + (i + 1)).slice(-5);
            var shapeIndex = ("00000" + (i + 1)).slice(-5); // 5-digit index
            
            var ledList = [];
            var ledCount = 0;

            if (confirmedResults.hasOwnProperty(partName)) {
                ledCount = confirmedResults[partName].length;
                for (var j = 0; j < confirmedResults[partName].length; j++) {
                    ledList.push(confirmedResults[partName][j].name);
                }
            }

            var logEntry = "Part_led_count_" + shapeIndex + ": " + ledCount + "\n";
            logEntry += "Part_led_list_" + shapeIndex + ": " + (ledList.length > 0 ? ledList.join(", ") : "") + "\n";
            
            cachedLogs.push(logEntry);
        }

        // Store cached logs
        OverlapDetectionManager._cachedLedCounts = cachedLogs;
        DebugLogManager.info("[CACHE] Cached LED logs successfully.");

    } catch (error) {
        DebugLogManager.error("[CACHE] Error caching LED counts and lists: " + error.toString());
    }
},

/**
 * Appends cached Part_led_count_idx and Part_led_list_idx to _output_log.txt.
 */
appendLedCountsToLog: function () {
    try {
        DebugLogManager.info("[LOGGING] Appending cached LED counts and lists to output log...");

        if (OverlapDetectionManager._cachedLedCounts.length === 0) {
            DebugLogManager.warn("[LOGGING] No cached LED data found.");
            return;
        }

        var logContent = OverlapDetectionManager._cachedLedCounts.join("\n");

        // **Use WriteToFile to append to the log file**
        WriteToFile(logContent);

        DebugLogManager.info("[LOGGING] Successfully appended LED data to log file.");

    } catch (error) {
        DebugLogManager.error("[LOGGING] Error appending LED counts to output log: " + error.toString());
    }
},

    /**
     * Refines the overlap by checking actual LED vertices inside the part.
     * LED の頂点が Part の内部にあるかをチェックし、重なりを精査する。
     *
     * @param {Object} partsToLEDs - Mapping of part names to LED names. / Part 名と LED 名のマッピング。
     * @param {Array} myPaths - Array of PathItems representing parts. / Part を表す PathItem の配列。
     * @param {Array} myLeds - Array of GroupItems representing LEDs. / LED を表す GroupItem の配列。
     * @returns {Object} Refined mapping of parts to LEDs with insideness percentages. / 精査された Part-LED マッピング（内部割合付き）。
     */
    __refineOverlapWithGeometry: function(parts, leds, candidateLEDs) {
        var refinedResults = {};
        
        try {
            DebugLogManager.info("[OverlapDetectionManager] Starting geometric overlap refinement...");

            for (var i = 0; i < parts.length; i++) {
                var part = parts[i];
                var partVertices = PathManager.getPathVertices(part);
                refinedResults[part.name] = [];

                if (!part || !partVertices) {
                    DebugLogManager.warning("[OverlapDetectionManager] Invalid part or vertices for " + (part ? part.name : "unknown part"));
                    continue;
                }

                for (var j = 0; j < candidateLEDs.length; j++) {
                    var led = candidateLEDs[j];
                    
                    if (!led) {
                        DebugLogManager.warning("[OverlapDetectionManager] LED not found");
                        continue;
                    }

                    // Get LED vertices using LEDManager
                    var ledVertices = LEDManager.getLEDVertices(led);
                    var insideCount = 0;

                    if (!ledVertices || ledVertices.length === 0) {
                        DebugLogManager.warning("[OverlapDetectionManager] No vertices found for LED " + led.name);
                        continue;
                    }

                    // Check each vertex of the LED against the part geometry
                    for (var k = 0; k < ledVertices.length; k++) {
                        if (this.isPointInPolygon(ledVertices[k], partVertices)) {
                            insideCount++;
                        }
                    }

                    // Calculate confidence based on number of vertices inside
                    var confidence = (ledVertices.length > 0) ? (insideCount / ledVertices.length) * 100 : 0;
                    
                    // Only include LEDs that have at least one vertex inside
                    if (confidence > 0) {
                        refinedResults[part.name].push({
                            name: led.name,
                            confidence: confidence,
                            insideCount: insideCount,
                            totalVertices: ledVertices.length
                        });

                        DebugLogManager.info("[GEOMETRY] LED " + led.name + 
                                        " overlaps with " + part.name + 
                                        " with confidence " + confidence.toFixed(2) + "% (" + 
                                        insideCount + "/" + ledVertices.length + " vertices inside)");
                    }
                }

                // Sort LEDs by confidence
                refinedResults[part.name].sort(function(a, b) {
                    return b.confidence - a.confidence;
                });

                DebugLogManager.info("[GEOMETRY] Found " + refinedResults[part.name].length + 
                                " overlapping LEDs for " + part.name);
            }

            DebugLogManager.info("[OverlapDetectionManager] Geometric overlap refinement completed.");
        
        } catch (error) {
            DebugLogManager.error("[GEOMETRY] Error in refineOverlapWithGeometry: " + error);
        }

        return refinedResults;
    },

    // Add to OverlapDetectionManager
    /**
     * Logs interlaced comparison of items with limits
     */
    _logInterlacedComparison: function(processingItems, tempItems, type, limit) {
        try {
            var maxItems = Math.min(processingItems.length, tempItems.length, limit);
            
            DebugLogManager.info("\n=== " + type + " Position Comparison (showing first " + maxItems + " items) ===");
            
            for (var i = 0; i < maxItems; i++) {
                var procItem = processingItems[i];
                var tempItem = tempItems[i];
                var procBBox = this.getBoundingBox(procItem);
                var tempBBox = this.getBoundingBox(tempItem);
                
                if (procBBox && tempBBox) {
                    DebugLogManager.info(
                        "MyList:  " + type + " " + (i + 1) + ": " + 
                        procItem.name + " at (x: " + procBBox.x.toFixed(2) + 
                        ", y: " + procBBox.y.toFixed(2) + ")"
                    );
                    DebugLogManager.info(
                        "LayerList: " + type + " " + (i + 1) + ": " + 
                        tempItem.name + " at (x: " + tempBBox.x.toFixed(2) + 
                        ", y: " + tempBBox.y.toFixed(2) + ")\n"
                    );
                }
            }

            if (processingItems.length !== tempItems.length) {
                DebugLogManager.warn(
                    "Note: Item count mismatch - Processing list: " + 
                    processingItems.length + ", Temp layer: " + tempItems.length
                );
            }
        } catch (error) {
            DebugLogManager.error("[VISUAL CHECK] Error in interlaced logging:", error);
        }
    },

    /**
     * Compare items in list with items in tempLayer
     */
    _verifyTempLayerMatch: function(items, type, tempLayer) {
        try {
            DebugLogManager.info("[TEMP LAYER CHECK] Verifying " + type + " in temp layer");
            
            // Get items from temp layer based on type
            var tempItems = [];
            for (var i = 0; i < tempLayer.pageItems.length; i++) {
                var item = tempLayer.pageItems[i];
                if ((type === "Parts" && (item.typename === "PathItem" || item.typename === "CompoundPathItem")) ||
                    (type === "LEDs" && item.typename === "GroupItem")) {
                    tempItems.push(item);
                }
            }

            // Log interlaced comparison with appropriate limits
            var limit = (type === "Parts") ? 10 : 20;
            this._logInterlacedComparison(items, tempItems, type, limit);

        } catch (error) {
            DebugLogManager.error("[TEMP LAYER CHECK] Error verifying temp layer:", error);
        }
    },

    // Add to OverlapDetectionManager
    /**
     * Checks ordering direction of items
     * Returns: 1 for top-left to bottom-right
     *         -1 for bottom-right to top-left
     *          0 if no clear ordering
     */
    _checkOrderingDirection: function(items) {
        try {
            if (!items || items.length < 2) return 1;

            var forwardCount = 0;
            var reverseCount = 0;
            var tolerance = 5; // points

            // Check first few items to determine likely direction
            var checkItems = Math.min(5, items.length - 1);
            for (var i = 0; i < checkItems; i++) {
                var current = items[i];
                var next = items[i + 1];
                
                var currentBBox = this.getBoundingBox(current);
                var nextBBox = this.getBoundingBox(next);
                
                if (!currentBBox || !nextBBox) continue;

                var yDiff = currentBBox.y - nextBBox.y;
                
                if (Math.abs(yDiff) <= tolerance) {
                    // On same row, check x direction
                    if (currentBBox.x < nextBBox.x) forwardCount++;
                    if (currentBBox.x > nextBBox.x) reverseCount++;
                } else {
                    // Different rows, check y direction
                    if (currentBBox.y > nextBBox.y) forwardCount++;
                    if (currentBBox.y < nextBBox.y) reverseCount++;
                }
            }

            if (forwardCount > reverseCount) return 1;
            if (reverseCount > forwardCount) return -1;
            return 0;
        } catch (error) {
            DebugLogManager.error("[SPATIAL] Error checking ordering direction:", error);
            return 0;
        }
    },

    /**
     * Verifies if items are ordered from top-left to bottom-right
     * Now checks for both forward and reverse ordering
     */
    _verifySpatialOrder: function(items) {
        try {
            if (!items || items.length < 2) return true;

            // First check the ordering direction
            var direction = this._checkOrderingDirection(items);
            
            if (direction === -1) {
                DebugLogManager.warn("[SPATIAL] Items appear to be in reverse order (bottom-right to top-left)");
                // Could add code here to reverse the array if needed
                return false;
            }
            
            if (direction === 0) {
                DebugLogManager.warn("[SPATIAL] No clear spatial ordering detected");
                return false;
            }

            // Proceed with forward order verification
            for (var i = 0; i < items.length - 1; i++) {
                var current = items[i];
                var next = items[i + 1];
                
                var currentBBox = this.getBoundingBox(current);
                var nextBBox = this.getBoundingBox(next);
                
                if (!currentBBox || !nextBBox) {
                    DebugLogManager.error("[SPATIAL] Could not get bounding box for items at index " + i);
                    continue;
                }

                var tolerance = 5; // points
                var yDiff = Math.abs(currentBBox.y - nextBBox.y);
                
                if (yDiff <= tolerance) {
                    // If on same row, check x ordering (left to right)
                    if (currentBBox.x > nextBBox.x) {
                        DebugLogManager.warn("[SPATIAL] Items on same row not ordered left-to-right: " + 
                            current.name + " (" + currentBBox.x.toFixed(2) + ") -> " + 
                            next.name + " (" + nextBBox.x.toFixed(2) + ")");
                        return false;
                    }
                } else if (currentBBox.y < nextBBox.y) {
                    // If different rows, previous should be higher (y decreases top to bottom)
                    DebugLogManager.warn("[SPATIAL] Items not ordered top-to-bottom: " + 
                        current.name + " (" + currentBBox.y.toFixed(2) + ") -> " + 
                        next.name + " (" + nextBBox.y.toFixed(2) + ")");
                    return false;
                }
            }
            
            return true;
        } catch (error) {
            DebugLogManager.error("[SPATIAL] Error verifying spatial order:", error);
            return false;
        }
    },

    /**
     * Verify spatial ordering of both parts and LEDs
     */
    _verifyAllSpatialOrdering: function(partItems, ledItems) {
        DebugLogManager.info("[SPATIAL] Checking spatial ordering for " + 
            partItems.length + " parts and " + ledItems.length + " LEDs");
        
        var partsOrdered = this._verifySpatialOrder(partItems);
        var ledsOrdered = this._verifySpatialOrder(ledItems);
        
        if (!partsOrdered) {
            DebugLogManager.warn("[SPATIAL] Parts are not in expected top-left to bottom-right order!");
        }
        if (!ledsOrdered) {
            DebugLogManager.warn("[SPATIAL] LEDs are not in expected top-left to bottom-right order!");
        }
        
        return {
            ordered: partsOrdered && ledsOrdered,
            partsOrdered: partsOrdered,
            ledsOrdered: ledsOrdered
        };
    },


    /**
     * Helper function to count object properties in ExtendScript
     */
    _countProperties: function(obj) {
        var count = 0;
        for (var prop in obj) {
            if (obj.hasOwnProperty(prop)) {
                count++;
            }
        }
        return count;
    },

    /**
     * Main detection function with spatial verification
     */
    // Add to OverlapDetectionManager
    _detectOverlap: function(partItems, ledItems) {
        try {
            DebugLogManager.info("[DETECT] Starting overlap detection with caching");
            
            // Reset process results
            this._processResults = {
                pass1_bbox_overlaps: {},
                pass1_confirmed: {},
                pass1_unassigned: [],
                pass1_multi_assigned: {},
                pass2_confirmed: {},
                pass2_unassigned: [],
                pass2_multi_assigned: {}
            };

            // PASS 1
            DebugLogManager.info("[PASS1] Starting pass 1 processing");
            
            // Step 1: Bounding box overlap
            var bboxResults = this.simpleBoundingBoxOverlap(partItems, ledItems);
            DebugLogManager.info("[PASS1] Completed bounding box overlap detection");
            
            // Log bbox overlap results
            for (var partName in bboxResults) {
                if (bboxResults.hasOwnProperty(partName)) {
                    var overlaps = bboxResults[partName];
                     
                    DebugLogManager.info("[BBOX] Part " + partName + " overlaps with " + 
                        overlaps.length + " LEDs: " + overlaps.join(", "));
                }
            }
            
            // Step 2: Geometry refinement
            var confirmedResults = this.refineOverlapWithGeometry(bboxResults, partItems, ledItems);
            DebugLogManager.info("[PASS1] Completed geometry refinement");
            
            // Count multi-assigned LEDs
            var multiAssignCount = 0;
            for (var ledName in this._processResults.pass1_multi_assigned) {
                if (this._processResults.pass1_multi_assigned.hasOwnProperty(ledName)) {
                    multiAssignCount++;
                }
            }

            // Log summary
            DebugLogManager.info("[SUMMARY] Pass 1 Results:");
            DebugLogManager.info("  - Total Parts: " + partItems.length);
            DebugLogManager.info("  - Total LEDs: " + ledItems.length);
            DebugLogManager.info("  - Unassigned LEDs: " + this._processResults.pass1_unassigned.length);
            DebugLogManager.info("  - Multi-assigned LEDs: " + multiAssignCount);

            return {
                pass1: {
                    bbox_overlaps: this._processResults.pass1_bbox_overlaps,
                    confirmed: this._processResults.pass1_confirmed,
                    unassigned: this._processResults.pass1_unassigned,
                    multi_assigned: this._processResults.pass1_multi_assigned
                }
            };

        } catch (error) {
            DebugLogManager.error("[DETECT] Error in detectOverlap: " + error.toString());
            return null;
        }
    },

        /**
         * Detects overlapping LED items by performing both bounding box and geometry-based filtering.
         * 境界ボックスと形状ベースのフィルタリングの両方を実行して、重なりのある LED アイテムを検出する。
         *
         * @param {PathItem|CompoundPathItem} partItem - The target part item. / 対象のパーツアイテム。
         * @param {Array} ledItems - The list of all LED items. / すべての LED アイテムのリスト。
         * @returns {Array} The final list of LEDs that are confirmed to overlap. / 重なりが確認された LED の最終リスト。
         */
    /*
        detectOverlap: function (partItems, ledItems) {
            try {
                DebugLogManager.info("[INFO] Starting full overlap detection process for: " + partItems);

                var candidateLEDs = this.simpleBoundingBoxOverlap(partItems, ledItems);
                DebugLogManager.info("detectOverlap candidateLEDs: " + candidateLEDs);
                var confirmedLEDs = this.refineOverlapWithGeometry(candidateLEDs, partItems, ledItems);
                DebugLogManager.info("detectOverlap confirmedLEDs: " + confirmedLEDs);
                
                DebugLogManager.info("[INFO] Total confirmed overlapping LEDs: " + confirmedLEDs.length);
                return confirmedLEDs;

            } catch (error) {
                DebugLogManager.error("[ERROR] Failed in detectOverlap: " + error);
                return [];
            }
        },
    /*
        /**
         * Checks if a point is inside a polygon.
         */
        isPointInPolygon: function (point, vertices) {
            var x = point[0], y = point[1];
            var inside = false;

            for (var i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
                var xi = vertices[i][0], yi = vertices[i][1];
                var xj = vertices[j][0], yj = vertices[j][1];

                var intersect = ((yi > y) !== (yj > y)) &&
                    (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
                if (intersect) inside = !inside;
            }

            return inside;
        },



    // Update in OverlapDetectionManager
    // In OverlapDetectionManager
    detectOverlap: function (parts, leds) {
        var lgm = LogManager;
        var dlm = DebugLogManager;
        try {
            DebugLogManager.info("[DETECT] Starting overlap detection with caching");


            // PASS 1: Bounding box detection
            var bboxResults = this.simpleBoundingBoxOverlap(parts, leds);
            DebugLogManager.info("[PASS1] Completed bounding box overlap detection");
            
            // Log bbox overlap results
            for (var partName in bboxResults) {
                if (bboxResults.hasOwnProperty(partName)) {
                    var overlaps = bboxResults[partName];
                    DebugLogManager.info("[PASS1][BBOX] Part " + partName + " overlaps with " + 
                        overlaps.length + " LEDs: " + overlaps.join(", "));
                    
                    // Cache results and log structured format
                    // 結果をキャッシュし、構造化された形式でログを記録
                    this.cacheBBoxResults(partName, overlaps, this);
                }
            }
            
            // Store in process results
            //this._processResults.pass1_bbox_overlaps = bboxResults;
            
            // Initialize unassigned LEDs list
            for (var i = 0; i < leds.length; i++) {
                this._processResults.pass1_unassigned.push(leds[i].name);
            }

            // Step 2: Geometry refinement
            var confirmedResults = this.refineOverlapWithGeometry(parts, leds, bboxResults);
            DebugLogManager.info("[PASS1] Completed geometry refinement");
            
            // Track multi-assigned LEDs
            var ledAssignments = {};
            for (var partName in confirmedResults) {
                if (confirmedResults.hasOwnProperty(partName)) {
                    var ledInfo = confirmedResults[partName];
                    for (var j = 0; j < ledInfo.length; j++) {
                        var ledName = ledInfo[j].name;
                        if (!ledAssignments[ledName]) {
                            ledAssignments[ledName] = [];
                        }
                        ledAssignments[ledName].push(partName);
                    }
                }
            }

            // Update process results
            for (var ledName in ledAssignments) {
                if (ledAssignments.hasOwnProperty(ledName)) {
                    if (ledAssignments[ledName].length > 1) {
                        this._processResults.pass1_multi_assigned[ledName] = ledAssignments[ledName];
                    }
                    
                    // Remove from unassigned if it was assigned
                    var unassignedIndex = this.findInArray(this._processResults.pass1_unassigned, ledName);
                    if (unassignedIndex > -1) {
                        this._processResults.pass1_unassigned.splice(unassignedIndex, 1);
                    }
                }
            }

            // PASS 2: Process unassigned LEDs
            if (this._processResults.pass1_unassigned.length > 0) {
                var pass2Results = this.processUnassignedLEDs(
                    this._processResults.pass1_unassigned,
                    parts,
                    leds,
                    this._processResults.pass1_bbox_overlaps
                );
                
                // Merge pass2 results
                for (var partName in pass2Results) {
                    if (pass2Results.hasOwnProperty(partName)) {
                        if (!confirmedResults[partName]) {
                            confirmedResults[partName] = {
                                leds: [],
                                ledCount: 0
                            };
                        }
                        confirmedResults[partName].leds = confirmedResults[partName].concat(pass2Results[partName]);
                        confirmedResults[partName].ledCount = confirmedResults[partName].leds.length;
                    }
                }
            }

            return confirmedResults;

        } catch (error) {
            DebugLogManager.error("[DETECT] Error in detectOverlap: " + error.toString());
            return null;
        }
    },

        /**
     * Caches bounding box results and logs them in a structured format
     * バウンディングボックスの結果をキャッシュし、構造化された形式でログを記録します
     * 
     * @param {string} partName - Name of the part (e.g., "Part_00001")
     *                           パーツの名前（例：「Part_00001」）
     * @param {Array} ledList - Array of overlapping LED IDs
     *                         重複するLEDのID配列
     * @param {Object} context - Context object containing pass1_bbox_overlaps array
     *                          pass1_bbox_overlaps配列を含むコンテキストオブジェクト
     */
    cacheBBoxResults: function(partName, ledList, context) {
        // Create simplified data structure for this part
        // このパーツ用の簡略化されたデータ構造を作成
        var partData = {
            name: partName,
            ledCount: ledList.length,
            ledList: ledList
        };
        
        // Initialize array if it doesn't exist
        // 配列が存在しない場合は初期化
        if (!this._processResults.pass1_bbox_overlaps) {
            this._processResults.pass1_bbox_overlaps = [];
        }
        
        // Add part data to collection
        // パーツデータをコレクションに追加
        this._processResults.pass1_bbox_overlaps.push(partData);
        
        // Log structured analysis
        // 構造化された分析をログに記録
        LogManager.logStructuredBBoxAnalysis(partName, ledList);
    },

    processUnassignedLEDs: function(unassignedLEDs, parts, allLeds, bboxResults) {
        var results = {};
        try {
            for (var i = 0; i < unassignedLEDs.length; i++) {
                var ledName = unassignedLEDs[i];
                var led = null;
                
                // Find LED object
                for (var j = 0; j < allLeds.length; j++) {
                    if (allLeds[j].name === ledName) {
                        led = allLeds[j];
                        break;
                    }
                }
                
                if (!led) continue;

                // Find parts that had bbox overlap with this LED
                var candidateParts = [];
                for (var partName in bboxResults) {
                    if (bboxResults.hasOwnProperty(partName)) {
                        if (this.findInArray(bboxResults[partName], ledName) > -1) {
                            // Find part object
                            for (var k = 0; k < parts.length; k++) {
                                if (parts[k].name === partName) {
                                    candidateParts.push(parts[k]);
                                    break;
                                }
                            }
                        }
                    }
                }

                if (candidateParts.length === 1) {
                    // Single part assignment
                    var partName = candidateParts[0].name;
                    if (!results[partName]) {
                        results[partName] = { leds: [], ledCount: 0 };
                    }
                    results[partName].leds.push({
                        name: led.name,
                        confidence: 100 // Full confidence for single assignment
                    });
                    results[partName].ledCount = results[partName].leds.length;
                } else if (candidateParts.length > 1) {
                    // Multiple parts - use geometric refinement
                    var geometricResults = this.refineOverlapWithGeometry(candidateParts, [led], null);
                    
                    // Assign to part with highest confidence
                    var highestConfidence = 0;
                    var bestPart = null;
                    
                    for (var partName in geometricResults) {
                        if (geometricResults.hasOwnProperty(partName) && 
                            geometricResults[partName].length > 0) {
                            var confidence = geometricResults[partName][0].confidence;
                            if (confidence > highestConfidence) {
                                highestConfidence = confidence;
                                bestPart = partName;
                            }
                        }
                    }
                    
                    if (bestPart) {
                        if (!results[bestPart]) {
                            results[bestPart] = { leds: [], ledCount: 0 };
                        }
                        results[bestPart].leds.push({
                            name: led.name,
                            confidence: highestConfidence
                        });
                        results[bestPart].ledCount = results[bestPart].leds.length;
                    }
                }
            }
        } catch (error) {
            DebugLogManager.error("[PASS2] Error processing unassigned LEDs:", error);
        }
        
        return results;
    },


    // Update refineOverlapWithGeometry to include confidence calculation
    _refineOverlapWithGeometry: function(parts, candidateLEDs) {
        var refinedResults = {};
        
        try {
            for (var i = 0; i < parts.length; i++) {
                var part = parts[i];
                var partVertices = PathManager.getPathVertices(part);
                refinedResults[part.name] = [];

                for (var j = 0; j < candidateLEDs.length; j++) {
                    var led = candidateLEDs[j];
                    var ledVertices = LEDManager.getLEDVertices(led);
                    var insideCount = 0;

                    for (var k = 0; k < ledVertices.length; k++) {
                        if (this.isPointInPolygon(ledVertices[k], partVertices)) {
                            insideCount++;
                        }
                    }

                    var confidence = (ledVertices.length > 0) ? (insideCount / ledVertices.length) * 100 : 0;
                    if (confidence > 0) {
                        refinedResults[part.name].push({
                            name: led.name,
                            confidence: confidence
                        });
                    }
                }
            }
        } catch (error) {
            DebugLogManager.error("[GEOMETRY] Error in refineOverlapWithGeometry: " + error);
        }

        return refinedResults;
    },

    // Replace in OverlapDetectionManager
    findInArray: function(array, item) {
        for (var i = 0; i < array.length; i++) {
            if (array[i] === item) {
                return i;
            }
        }
        return -1;
    }

};


/**
 * ItemIdentificationManager: Identifies Parts and LEDs in given layers.
 * アイテム識別マネージャー: 指定されたレイヤー内の PartItem および LED を識別。
 */
var ItemIdentificationManager = {
    
    /**
     * Recursively extracts all paths from an item in a flat list
     * @param {Object} item - The item to extract paths from
     * @returns {Array} Array of extracted PathItems and CompoundPathItems
     */
    extractPaths: function(item) {
        try {
            DebugLogManager.info("Starting path extraction for item type:", item.typename);
            var collectedPaths = [];
            var stack = [item];
            
            while (stack.length > 0) {
                var currentItem = stack.pop();
                
                if (!currentItem) {
                    continue;
                }
                
                //DebugLogManager.info("Processing item of type:", currentItem.typename);
                
                if (currentItem.typename === "PathItem" || 
                    currentItem.typename === "CompoundPathItem") {
                    collectedPaths.push(currentItem);
                    //DebugLogManager.info("Added path to collection");
                    
                } else if (currentItem.typename === "GroupItem" && currentItem.pageItems) {
                    // Add all pageItems to the stack
                    for (var i = 0; i < currentItem.pageItems.length; i++) {
                        stack.push(currentItem.pageItems[i]);
                    }
                    DebugLogManager.info("Added", currentItem.pageItems.length, "group items to stack");
                }
            }
            
            DebugLogManager.info("Path extraction complete. Found", collectedPaths.length, "paths");
            return collectedPaths;
            
        } catch(e) {
            DebugLogManager.error("Error in extractPaths:", e.toString());
            return [];
        }
    },
    
    /**
     * Identifies and sorts PartItems from a layer using `sortByPosition`.
     * @param {Layer} partLayer - The layer containing parts
     * @returns {Array} The sorted PartItems
     */
    identifyPartsAndSort: function(partLayer) {
        try {
            if (!partLayer) {
                throw new Error("Invalid part layer");
            }

            DebugLogManager.info("Identifying PartItems in layer:", partLayer.name);
            
            // Extract all parts from the layer's contents
            var parts = [];
            for (var i = 0; i < partLayer.pageItems.length; i++) {
                var extractedParts = this.extractPaths(partLayer.pageItems[i]);
                for (var j = 0; j < extractedParts.length; j++) {
                    parts.push(extractedParts[j]);
                }
            }

            DebugLogManager.info("Found", parts.length, "parts before sorting");
            
            // Sort the collected paths
            parts = SortingManager.sortPartsByGrid(parts);
            
            DebugLogManager.info("Identified and sorted", parts.length, "PartItems");
            return parts;
            
        } catch(e) {
            DebugLogManager.error("Failed to identify parts:", e.toString());
            return [];
        }
    },

    /**
     * Identifies and sorts LED GroupItems from a layer.
     * @param {Layer} ledLayer - The layer containing LED items
     * @returns {Array} The sorted LED items
     */
    identifyLedsAndSort: function(ledLayer) {
        var leds = [];
        try {
            if (!ledLayer) {
                throw new Error("Invalid LED layer");
            }

            DebugLogManager.info("Identifying LED GroupItems in layer:", ledLayer.name);
            for (var i = 0; i < ledLayer.groupItems.length; i++) {
                leds.push(ledLayer.groupItems[i]);
            }

            leds = SortingManager.sortLEDsByGrid(leds);
            DebugLogManager.info("Found and sorted", leds.length, "LED GroupItems");
            
        } catch(e) {
            DebugLogManager.error("Failed to identify LEDs:", e.toString());
        }
        return leds;
    },


    /**
     * Finds a part by name in identified parts.
     */
    findPartByName: function (name) {
        for (var i = 0; i < this.identifiedParts.length; i++) {
            if (this.identifiedParts[i].name === name) {
                return this.identifiedParts[i];
            }
        }
        return null;
    },

    /**
     * Finds an LED by name in identified LEDs.
     */
    findLEDByName: function (name) {
        for (var i = 0; i < this.identifiedLeds.length; i++) {
            if (this.identifiedLeds[i].name === name) {
                return this.identifiedLeds[i];
            }
        }
        return null;
    }
};

// Document Manager
var DocumentManager = {
    _mngName: "[DOCUMENTMANAGER]",
    _doc: app.activeDocument,

    getActiveDocument: function () {
        try {
            var funName = this._mngName + ".getActiveDocument: ";
            DebugLogManager.info(funName + "...");
            var doc = app.activeDocument;
            if (!doc) {
                DebugLogManager.error(funName + "could not retrieve document. Returning null.");
                return null;
            }
            return doc;
        } catch (e) {
            DebugLogManager.error(funName + "could not retrieve document: " + e.toString()); 
            return null;
        }
    },
    
    /**
     * Updates legacy text objects in the active Illustrator document without triggering dialog boxes.
     * アクティブな Illustrator ドキュメント内のレガシーテキストオブジェクトを更新し、ダイアログを表示しないようにする。
     *
     * Illustrator does not provide a built-in legacy text update function.
     * Instead, this function forces a reflow by slightly modifying and restoring text.
     *
     * Illustrator にはレガシーテキストの更新機能が組み込まれていない。
     * そのため、この関数はテキストをわずかに変更して戻すことで、リフローを強制する。
     *
     * Dialog boxes are **completely suppressed** using `app.userInteractionLevel = DONTDISPLAYALERTS`.
     * ダイアログは `app.userInteractionLevel = DONTDISPLAYALERTS` を使用して完全に抑制される。
     *
     * @returns {boolean} `true` if legacy text was updated successfully, `false` if an error occurred.
     *                    レガシーテキストが正常に更新された場合は `true`、エラーが発生した場合は `false`。
     */
    handleLegacyText: function () {
        try {
            DebugLogManager.info("[INFO] Checking for legacy text items...");

            // Suppress all Illustrator pop-ups
            var originalInteractionLevel = app.userInteractionLevel;
            app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

            var doc = app.activeDocument;
            var textFrames = doc.textFrames;
            var updatedCount = 0;

            for (var i = 0; i < textFrames.length; i++) {
                var textItem = textFrames[i];

                // Force Illustrator to reprocess the text by adding/removing a space
                var originalText = textItem.contents;
                textItem.contents = originalText + " "; // Add a space
                textItem.contents = originalText; // Revert to original
            
                updatedCount++;
            }

            DebugLogManager.info("[SUCCESS] Updated " + updatedCount + " legacy text items.");

            // Restore user interaction level
            app.userInteractionLevel = originalInteractionLevel;
            return true;

        } catch (e) {
            DebugLogManager.error("[ERROR] Legacy text handling failed: " + e.toString());

            // Ensure user interaction level is restored even on error
            app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;
            return false;
        }
    }
};


// Layer Manager
var LayerManager = {
    _mngName: "[LAYERMANAGER]",
    _targetLayer: null, // This is initialized in main 
    _ledLayer: null,
    _tempLayer: null,

    init: function () {
        var funName = this._mngName + "[init] "; 
        DebugLogManager.info(funName + "Starting...");
        try {
            var doc = DocumentManager._doc;
            var layerChars = this.stringToCharCodes("LED");
            this._ledLayer = this.findLayerByChars(doc, layerChars);
            this._tempLayer = DocumentManager._doc.layers.add();
            this._tempLayer.name = "Temp_Union_Layer";
            DebugLogManager.info(funName + "Added tempLayer " + this._tempLayer.name + " and _ledLayer " + this._ledLayer.name);
            return true;
        } catch (e) {
            DebugLogManager.error(funName + "Caught exception: " + e.toString());
            return false;
        }
    },

    findLayerByName: function (doc, name) {
        DebugLogManager.info("LayerManager.findLayerByName: doc = " + doc + ", name = " + name);
        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === name) {
                return doc.layers[i];
            }
        }
        return null;
    },
    
    findLayerByChars: function(doc, targetChars) {
        DebugLogManager.info("LayerManager.findLayerByChars: doc = " + doc + ", targetChars = " + targetChars);
        for (var i = 0; i < doc.layers.length; i++) {
            var layer = doc.layers[i];
            var layerChars = [];
            for (var j = 0; j < layer.name.length; j++) {
                layerChars.push(layer.name.charCodeAt(j));
            }
            
            if (this.compareCharArrays(layerChars, targetChars)) {
                return layer;
            }
        }
        return null;
    },
    
    compareCharArrays: function(arr1, arr2) {
        //DebugLogManager.info("LayerManager.compareCharArrays: arr1 = " + arr1 + ", arr2 = " + arr2);
        if (arr1.length !== arr2.length) return false;
        for (var i = 0; i < arr1.length; i++) {
            if (arr1[i] !== arr2[i]) return false;
        }
        return true;
    },
    
    getLayerArea: function(layer){
        DebugLogManager.info("LayerManager.getLayerArea: layer = " + layer); 
        try {
            var totalArea = 0;
            
            if (layer.pageItems && layer.pageItems.length > 0) {
                for (var i = 0; i < layer.pageItems.length; i++) {
                    totalArea += PathManager.getPathArea(layer.pageItems[i]).pt;
                }
            }
            
            if (layer.layers && layer.layers.length > 0) {
                for (var i = 0; i < layer.layers.length; i++) {
                    totalArea += this.getLayerArea(layer.layers[i]);
                }
            }
            
            return totalArea;
        } catch(e) {
            DebugLogManager.error("Error calculating layer area:", e.toString());
            return 0;
        }
    },
    /**
     * Converts a string to an array of character codes
     * @param {string} str - The string to convert
     * @returns {number[]} Array of character codes
     */
    stringToCharCodes: function (str) {
        try {
            var codes = [];
            for (var i = 0; i < str.length; i++) {
                codes.push(str.charCodeAt(i));
            }
            return codes;
        } catch (error) {
            $.writeln("Error converting string to char codes: " + error);
            return null;
        }
    },

    /**
     * Converts array of character codes back to a string (for validation/debugging)
     * @param {number[]} codes - Array of character codes
     * @returns {string} The reconstructed string
     */
    charCodesToString: function(codes) {
        try {
            return String.fromCharCode.apply(null, codes);
        } catch (error) {
            $.writeln("Error converting char codes to string: " + error);
            return null;
        }
    },

    moveSortedParts: function (sourceLayer, tempLayer) {
        try {
            var parts = [];
            parts = ItemIdentificationManager.identifyPartsAndSort(sourceLayer);
            DebugLogManager.info("IdentificationManager.identifyPartsAndSort: " + sourceLayer.name + " parts: " + parts);

            var movedParts = [];
            LogManager._data.parts = [];

            // ✅ Parts are already sorted correctly, reverse the iteration order
            for (var i = parts.length - 1; i >= 0; i--) {
                var newPart = parts[i].duplicate(tempLayer, ElementPlacement.PLACEATBEGINNING);
                movedParts.push(newPart);

                var num = parts.length - i; // ✅ Ensure numbering starts from 1
                var numStr = "00000" + num; // ✅ Add leading zeros
                var partNumber = numStr.slice(-5); // ✅ Extract last 4 characters

                newPart.name = "Part_" + partNumber; // ✅ Assign correct name

                // ✅ Store reference for later use
                LogManager._data.parts.push(newPart);
            }
 
            // Verify ordering after moving
            //DebugLogManager.info("Verifying part ordering after move to temp layer...");
            //OverlapDetectionManager._verifyTempLayerMatch(parts, "Parts", tempLayer);


            return movedParts;
        } catch (e) {
            DebugLogManager.error("Error in moveSortedParts: movedParts " + movedParts + e);
            return [];
        }

        return movedParts;
    },


    moveSortedLeds: function (ledLayer, tempLayer) {
        try {
            var leds = [];
            leds = ItemIdentificationManager.identifyLedsAndSort(ledLayer);
            DebugLogManager.info("IdentificationManager.identifyLedsAndSort: " + ledLayer.name + " leds: " + leds);

            var movedLeds = [];
            LogManager._data.leds = []; // ✅ Store LEDs here

            // ✅ Iterate in reverse order to preserve stacking order in tempLayer
            for (var i = leds.length - 1; i >= 0; i--) {
                var newLed = leds[i].duplicate(tempLayer, ElementPlacement.PLACEATBEGINNING);
                movedLeds.push(newLed);

                var num = leds.length - i; // ✅ Ensure numbering starts from 1
                var numStr = "00000" + num; // ✅ Add leading zeros
                var ledNumber = numStr.slice(-5); // ✅ Extract last 5 characters

                newLed.name = "LED_" + ledNumber; // ✅ Assign correct name

                // ✅ Store reference for later use
                LogManager._data.leds.push(newLed);
            }

        // Verify ordering after moving
        //DebugLogManager.info("Verifying LED ordering after move to temp layer...");
        //OverlapDetectionManager._verifyTempLayerMatch(leds, "LEDs", tempLayer);

        return movedLeds;
            // Already sorted when identified and duplicated above
            /*
            var sortedLeds = [];
            sortedLeds = SortingManager.sortByGrid(movedLeds);
            for (var i = 0; i < sortedLeds.length; i++) {
                sortedLeds[i].name = "Part_" + (i + 1);
            }
            */

        } catch (e) {
            DebugLogManager.error("Error in moveSortedParts: movedLeds " + movedLeds + e);
            return [];
        }

        return movedLeds;
    },


    /**
     * Moves items from the source layer to the tempLayer and sorts them using grid sorting.
     * アイテムをソースレイヤーから一時レイヤーへ移動し、グリッドソートを適用する。
     * 
     * @param {Layer} sourceLayer - The source layer containing items. / アイテムを含むソースレイヤー。
     * @param {Layer} tempLayer - The temporary processing layer. / 処理用の一時レイヤー。
     * @returns {Array} The sorted items in tempLayer. / ソートされたアイテムの配列。
     */
    moveAndSortItems: function (sourceLayer, tempLayer) {
        try {
            DebugLogManager.info("[MOVE] Moving and sorting items from layer:" + sourceLayer.name + " to tempLayer: " + tempLayer.name);

            var items = [];
            if (sourceLayer.pathItems.length > 0) {
                items = items.concat(sourceLayer.pathItems);
            }
            if (sourceLayer.compoundPathItems.length > 0) {
                items = items.concat(sourceLayer.compoundPathItems);
            }
            if (sourceLayer.groupItems.length > 0) {
                items = items.concat(sourceLayer.groupItems);
            }

            // Move items to tempLayer
            for (var i = 0; i < items.length; i++) {
                var newItem = items[i].duplicate(tempLayer);
                newItem.name = "temp_" + (i + 1);
            }

            // Sort by grid-based sorting
            var sortedItems = SortingManager.sortPartsByGrid(tempLayer.pageItems);

            DebugLogManager.info("[SORT] Items sorted. Total:", sortedItems.length);
            return sortedItems;

        } catch (error) {
            DebugLogManager.error("[ERROR] Failed to move and sort items:", error);
            return [];
        }
    }

};

// Path Manager with extended measurement capabilities
var PathManager = {
    // Conversion constants
    POINTS_TO_MM: 0.352778,
    POINTS_TO_CM: 0.0352778,
    
    /**
     * Converts points to millimeters
     * @param {Number} points - Value in points
     * @returns {Number} Value in millimeters
     */
    pointsToMM: function(points) {
        return points * this.POINTS_TO_MM;
    },
    
    /**
     * Converts points to centimeters
     * @param {Number} points - Value in points
     * @returns {Number} Value in centimeters
     */
    pointsToCM: function(points) {
        return points * this.POINTS_TO_CM;
    },
    
    /**
     * Gets path width in various units
     * @param {PathItem|CompoundPathItem} item - The item to measure
     * @returns {Object} Width in different units
     */
    getPathWidth: function(item) {
        try {
            var bounds = item.geometricBounds;
            var widthPT = Math.abs(bounds[2] - bounds[0]);
            
            return {
                pt: widthPT,
                mm: this.pointsToMM(widthPT),
                cm: this.pointsToCM(widthPT)
            };
        } catch(e) {
            DebugLogManager.error("Error in getPathWidth:", e.toString());
            return { pt: 0, mm: 0, cm: 0 };
        }
    },
    
    /**
     * Gets path height in various units
     * @param {PathItem|CompoundPathItem} item - The item to measure
     * @returns {Object} Height in different units
     */
    getPathHeight: function(item) {
        try {
            var bounds = item.geometricBounds;
            var heightPT = Math.abs(bounds[1] - bounds[3]);
            
            return {
                pt: heightPT,
                mm: this.pointsToMM(heightPT),
                cm: this.pointsToCM(heightPT)
            };
        } catch(e) {
            DebugLogManager.error("Error in getPathHeight:", e.toString());
            return { pt: 0, mm: 0, cm: 0 };
        }
    },
    
    /**
     * Gets path area in various units
     * @param {PathItem|CompoundPathItem|GroupItem} item - The item to measure
     * @returns {Object} Area in different units
     */
    getPathArea: function(item) {
        try {
            if (!item) return { pt: 0, mm: 0, cm: 0 };
            
            var areaPT = 0;
            
            switch (item.typename) {
                case 'PathItem':
                    areaPT = Math.abs(item.area);
                    break;
                case 'CompoundPathItem':
                    areaPT = this.getCompoundPathArea(item);
                    break;
                case 'GroupItem':
                    areaPT = this.getGroupArea(item);
                    break;
                default:
                    areaPT = this.getBoundingBoxArea(item);
            }
            
            return {
                pt: areaPT,
                mm: this.pointsToMM(areaPT),
                cm: this.pointsToCM(areaPT)
            };
        } catch(e) {
            DebugLogManager.error("Error in getPathArea:", e.toString());
            return { pt: 0, mm: 0, cm: 0 };
        }
    },
    
    /**
     * Gets compound path area in various units
     * @param {CompoundPathItem} item - The compound path to measure
     * @returns {Number} Area in points
     */
    getCompoundPathArea: function(item) {
        try {
            var total = 0;
            for (var i = 0; i < item.pathItems.length; i++) {
                total += Math.abs(item.pathItems[i].area);
            }
            return total;
        } catch(e) {
            DebugLogManager.error("Error in getCompoundPathArea:", e.toString());
            return 0;
        }
    },
    
    /**
     * Gets group area in points
     * @param {GroupItem} item - The group to measure
     * @returns {Number} Area in points
     */
    getGroupArea: function(item) {
        try {
            var total = 0;
            for (var i = 0; i < item.pageItems.length; i++) {
                total += this.getPathArea(item.pageItems[i]).pt;
            }
            return total;
        } catch(e) {
            DebugLogManager.error("Error in getGroupArea:", e.toString());
            return 0;
        }
    },
    
    /**
     * Gets bounding box area in points
     * @param {PageItem} item - The item to measure
     * @returns {Number} Area in points
     */
    getBoundingBoxArea: function(item) {
        try {
            var bounds = item.geometricBounds;
            return Math.abs((bounds[2] - bounds[0]) * (bounds[1] - bounds[3]));
        } catch(e) {
            DebugLogManager.error("Error in getBoundingBoxArea:", e.toString());
            return 0;
        }
    },
     getPathVertices: function(pathItem) {
        var vertices = [];

        if (pathItem.typename === "PathItem") {
            for (var i = 0; i < pathItem.pathPoints.length; i++) {
                vertices.push([pathItem.pathPoints[i].anchor[0], pathItem.pathPoints[i].anchor[1]]);
            }
        } else if (pathItem.typename === "CompoundPathItem") {
            for (var i = 0; i < pathItem.pathItems.length; i++) {
                var subPath = pathItem.pathItems[i];
                for (var j = 0; j < subPath.pathPoints.length; j++) {
                    vertices.push([subPath.pathPoints[j].anchor[0], subPath.pathPoints[j].anchor[1]]);
                }
            }
        }

        return vertices;
    },
        
    getShapeMeasurements: function(parts, results) {
        try {
            var shapeMeasurements = [];
            for (var i = 0; i < parts.length; i++) {
                var part = parts[i];

                // Ensure fill is applied before measuring area
                this.ensureRGBFill(part);

                var measurements = this.getPathMeasurements(part);
                if (!measurements) {
                    DebugLogManager.error("Failed to get measurements for part: " + part.name);
                    continue;
                }

                // Get LED information from results
                var ledInfo = results[part.name];
                var ledCount = 0;
                var ledList = [];

                if (ledInfo && typeof ledInfo === 'object') {
                    // Handle LED count
                    if (ledInfo.hasOwnProperty('ledCount') && 
                        typeof ledInfo.ledCount !== 'undefined') {
                        ledCount = ledInfo.ledCount;
                    }

                    // Handle LED list
                    if (ledInfo.hasOwnProperty('leds') && 
                        ledInfo.leds && 
                        typeof ledInfo.leds.length !== 'undefined') {
                        for (var j = 0; j < ledInfo.leds.length; j++) {
                            var led = ledInfo.leds[j];
                            if (led && led.hasOwnProperty('name') && 
                                led.hasOwnProperty('confidence')) {
                                ledList.push({
                                    name: led.name,
                                    confidence: led.confidence
                                });
                            }
                        }
                    }
                }

                DebugLogManager.info("[SHAPE] For part " + part.name + 
                                    ": Found " + ledCount + " LEDs");

                // Collect vertices if needed
                var vertices = this.getVertices(part);

                // Create shape object with all measurements
                var shapeData = {
                    name: part.name,
                    width: measurements.width,
                    height: measurements.height,
                    area: measurements.area,
                    vertices: vertices,
                    ledCount: ledCount,
                    leds: ledList,
                    // Maintain compatibility with existing export path structure
                    pngPath: null,
                    posPath: null,
                    ledsPath: null
                };

                // Add export paths if they exist in results
                if (ledInfo) {
                    if (ledInfo.hasOwnProperty('pngPath')) {
                        shapeData.pngPath = ledInfo.pngPath;
                    }
                    if (ledInfo.hasOwnProperty('posPath')) {
                        shapeData.posPath = ledInfo.posPath;
                    }
                    if (ledInfo.hasOwnProperty('ledsPath')) {
                        shapeData.ledsPath = ledInfo.ledsPath;
                    }
                }

                shapeMeasurements.push(shapeData);

                // Debug log for verification
                DebugLogManager.info("[SHAPE] Added measurements for: " + part.name +
                                    " Area (mm²): " + measurements.area.mm.toFixed(2) +
                                    " LED count: " + ledCount);
            }
            return shapeMeasurements;
        } catch (e) {
            DebugLogManager.error("Error in getShapeMeasurements:", e.toString());
            return [];
        }
    },

    getAssociatedLEDCount: function(part) {
        var count = 0;
        try {
            var partBounds = this.getBoundingBox(part);

            for (var i = 0; i < LogManager._data.leds.length; i++) {
                var led = LogManager._data.leds[i];
                var ledBounds = this.getBoundingBox(led);

                if (OverlapDetectionManager.isBoundingBoxOverlapping(partBounds, ledBounds)) {
                    count++;
                }
            }
        } catch (e) {
            DebugLogManager.error("Error in getAssociatedLEDCount:", e.toString());
        }
        return count;
    }

     
};

/**
 * LEDManager: Handles LED data extraction including bounding box and vertices.
 * LEDデータ抽出 (境界ボックス & 頂点情報) を処理するマネージャー。
 */
var LEDManager = {

    /**
     * Extracts the bounding box of an LED GroupItem.
     * LED GroupItem の境界ボックスを抽出します。
     *
     * @param {GroupItem} led - The LED GroupItem.
     * @returns {Array} Bounding box [left, top, right, bottom].
     */
    getLEDBoundingBox: function (led) {
        try {
            if (!led || led.typename !== "GroupItem") {
                DebugLogManager.error("[LEDManager] Invalid LED GroupItem provided.");
                return null;
            }

            var bounds = led.visibleBounds; // [left, top, right, bottom]
            //DebugLogManager.info("[LEDManager] Bounding box extracted for LED:", bounds);
            return bounds;

        } catch (error) {
            DebugLogManager.error("[LEDManager] Error extracting LED bounding box:", error);
            return null;
        }
    },

    /**
     * Extracts all path vertices from a GroupItem (LED).
     * This ensures it works even if the LED contains nested GroupItems.
     * LED GroupItem からすべてのパスの頂点を抽出。
     * ネストされた GroupItem に対しても適切に処理します。
     *
     * @param {GroupItem} led - The LED GroupItem.
     * @returns {Array} Array of vertices in [x, y] format.
     */
    getLEDVertices: function (led) {
        var vertices = [];

        try {
            if (!led || led.typename !== "GroupItem") {
                DebugLogManager.error("[LEDManager] Invalid LED GroupItem provided.");
                return [];
            }

            //DebugLogManager.info("[LEDManager] Extracting LED vertices...");

            function extractVertices(item) {
                if (item.typename === "PathItem") {
                    for (var j = 0; j < item.pathPoints.length; j++) {
                        var point = item.pathPoints[j].anchor;
                        vertices.push([point[0], point[1]]);
                    }
                } else if (item.typename === "GroupItem") {
                    for (var k = 0; k < item.pageItems.length; k++) {
                        extractVertices(item.pageItems[k]); // Recursively check nested items
                    }
                }
            }

            extractVertices(led);
            //DebugLogManager.info("[LEDManager] Extracted", vertices.length, "vertices from LED.");

        } catch (error) {
            DebugLogManager.error("[LEDManager] Error extracting LED vertices:", error);
        }

        return vertices;
    }
};


// Complete Log Manager Implementation
var LogManager = {
    _mngName: "[LOGMANAGER]",
    _data: {},
    _layerData: [],
    _cachedLedAssignments: [],
    
        /**
     * Initializes the log manager
     */
    init: function() {
        try {
            var funName = this._mngName + ".init: ";
            DebugLogManager.info(funName + "Starting...");
            
            // Initialize data structures
            this._data = {};
            this._layerData = [];
            
            // Initialize document info if available
            if (app.documents.length > 0) {
                var doc = app.activeDocument;
                if (doc) {
                    this.logDocumentInfo(doc);
                }
            }
            
            return true;
        } catch (e) {
            DebugLogManager.error(this._mngName + ".init error: " + e.toString());
            return false;
        }
    },

    /**
     * Logs basic document information
     * @param {Document} doc - The active document
     */
    logDocumentInfo: function(doc) {
        try {
            DebugLogManager.info("Logging document info");
            if (!doc) {
                DebugLogManager.error("Invalid document provided");
                return false;
            }

            this._data[LOG_KEYS.DOC_PATH] = doc.path || "";
            this._data[LOG_KEYS.DOC_NAME] = doc.name;
            this._data[LOG_KEYS.LAYER_COUNT] = doc.layers ? doc.layers.length : 0;
        
            return true;
        } catch (e) {
            DebugLogManager.error("Error in logDocumentInfo:", e.toString());
            return false;
        }
    },

    /**
     * Logs information about a specific layer
     * @param {Layer} layer - The layer to log
     */
    logLayerInfo: function(layer) {
        try {
            DebugLogManager.info("Logging layer info for:", layer.name);
            var layerInfo = {};
            layerInfo[LOG_KEYS.LAYER_NAME] = layer.name;
            layerInfo[LOG_KEYS.LAYER_CHARS] = LayerManager.stringToCharCodes(layer.name);
            this._layerData.push(layerInfo);
            return true;
        } catch (e) {
            DebugLogManager.error("Error in logLayerInfo:", e.toString());
            return false;
        }
    },

    /**
     * Logs detailed information about the target layer
     * @param {Layer} layer - The target layer
     */
    logTargetLayerInfo: function(layer) {
        try {
            DebugLogManager.info("Logging target layer info for:", layer.name);
            this._data[LOG_KEYS.TARGET_FOUND] = layer.name;
        
            // Area calculations
            var area = LayerManager.getLayerArea(layer);
            var areaMM = (area / 2.834645 / 2.834645).toFixed(2);
            var areaCM = (areaMM / 100).toFixed(2);
        
            this._data[LOG_KEYS.AREA_POINTS] = area.toFixed(10);
            this._data[LOG_KEYS.AREA_MM] = areaMM;
            this._data[LOG_KEYS.AREA_CM] = areaCM;
        
            // Height calculations
            var height = LayerManager.getMaxHeight(layer);
            var heightMM = (height / 2.834645).toFixed(2);
            var heightCM = heightMM / 100;
            this._data[LOG_KEYS.HEIGHT_POINTS] = height;
            this._data[LOG_KEYS.HEIGHT_MM] = heightMM;
            this._data[LOG_KEYS.HEIGHT_CM] = heightCM;
        
            // LED count if available
            if (layer.name === "LED") {
                var ledCount = LayerManager.countLEDGroups(layer);
                if (ledCount > 0) {
                    this._data[LOG_KEYS.LED_COUNT] = ledCount;
                }
            }
        
            return true;
        } catch (error) {
            DebugLogManager.error("Error in logTargetLayerInfo:", error.toString());
            return false;
        }
    },

    /**
     * Sets the export path for the current process
     * @param {String} path - The export path
     */
    setExportPath: function(path) {
        try {
            DebugLogManager.info("Setting export path:", path);
            var doc = app.activeDocument;
            var docPath = doc.path;
            var docName = doc.name;
            var expPath = new Folder(docPath + "/" + docName.replace(/\.ai$/i, ''));
            if (!expPath.exists) {
                expPath.create();
                DebugLogManager.info("[EXPORT] Created export folder: " + expPath.fsName);
            }
            this._data[LOG_KEYS.EXPORT_PATH] = path || expPath.fsName;
            return expPath.fsName;
        } catch (e) {
            DebugLogManager.error("Error in setExportPath:", e.toString());
            return false;
        }
    },

    // In LogManager's logShapeMeasurements function:
    logShapeMeasurements: function(parts, results) {
        try {
            for (var i = 0; i < parts.length; i++) {
                var part = parts[i];
                var index = i + 1;
                var paddedIndex = ("0000" + index).slice(-4);
                
                var width = PathManager.getPathWidth(part);
                var height = PathManager.getPathHeight(part);
                var area = PathManager.getPathArea(part);
                
                // Get LED information from results
                var ledInfo = results[part.name] || { ledCount: 0, leds: [] };
                var ledList = ledInfo.leds.map(function(led) {
                    return led.name + " (" + led.confidence.toFixed(2) + "%)";
                }).join(", ");

                // Add LED information to log data
                this._data[LOG_KEYS.SHAPE_LED_COUNT + paddedIndex] = ledInfo.ledCount;
                this._data[LOG_KEYS.SHAPE_LED_LIST + paddedIndex] = ledList;
                
                // Store in shapes array for easy access
                var shapeData = {
                    name: part.name,
                    width: width,
                    height: height,
                    area: area,
                    ledCount: ledInfo.ledCount,
                    ledList: ledList
                };
                
                this._data.shapes.push(shapeData);
            }
            return true;
        } catch (e) {
            DebugLogManager.error("Error in logShapeMeasurements:", e.toString());
            return false;
        }
    },

    /**
     * Logs measurements for an array of shapes
     * @param {Array} shapes - Array of shapes to measure
     */
    _logShapeMeasurements: function() {
        try {
            DebugLogManager.info("Starting shape measurements logging");
        
            var shapes = this._data.shapes;
        
            var shapesAndLeds = this._data.results;
        
            for (var i = 0; i < shapes.length; i++) {
                var shape = shapes[i];
                var num = i + 1;
                // three digit index
                var index = num < 10 ? "00" + num : (num < 100 ? "0" + num : num.toString());
            

                // Get measurements
                var width = PathManager.getPathWidth(shape);
                var height = PathManager.getPathHeight(shape);
                var area = PathManager.getPathArea(shape);
            
                // Get LED count for this shape
                var overlappingLEDs = OverlapDetectionManager.detectOverlap(shapes, leds);
                var ledCount = overlappingLEDs ? overlappingLEDs.length : 0;
            
                // Log shape information
                this._data[LOG_KEYS.SHAPE_NAME_ROOT + index] = shape.name || ("Shape_" + index);
            
                // Log heights
                this._data[LOG_KEYS.SHAPE_HEIGHT_PT + index] = height.pt.toFixed(2);
                this._data[LOG_KEYS.SHAPE_HEIGHT_MM + index] = height.mm.toFixed(2);
                this._data[LOG_KEYS.SHAPE_HEIGHT_CM + index] = height.cm.toFixed(2);
            
                // Log widths
                this._data[LOG_KEYS.SHAPE_WIDTH_PT + index] = width.pt.toFixed(2);
                this._data[LOG_KEYS.SHAPE_WIDTH_MM + index] = width.mm.toFixed(2);
                this._data[LOG_KEYS.SHAPE_WIDTH_CM + index] = width.cm.toFixed(2);
            
                // Log areas
                this._data[LOG_KEYS.SHAPE_AREA_PTSQ + index] = area.pt.toFixed(2);
                this._data[LOG_KEYS.SHAPE_AREA_MMSQ + index] = area.mm.toFixed(2);
                this._data[LOG_KEYS.SHAPE_AREA_CMSQ + index] = area.cm.toFixed(2);
            
                // Log LED count
                this._data[LOG_KEYS.SHAPE_LED_COUNT + index] = ledCount;
            
                DebugLogManager.info("Logged measurements for shape:", index, "LED count:", ledCount);
            }
        
            DebugLogManager.info("Completed shape measurements logging");
    
        } catch (e) {
            DebugLogManager.error("Error in logShapeMeasurements:", e.toString());
        }
    },

    /**
     * Retrieves all items from a specified layer whose names start with the given partial name (root name).
     * 指定されたレイヤー内で、指定した部分名（ルート名）で始まるすべてのアイテムを取得する。
     *
     * @param {Layer} layer - The Illustrator layer to search in.
     *                        検索するIllustratorレイヤー。
     * @param {string} partialName - The root name to match at the beginning of item names.
     *                               アイテム名の先頭に一致するルート名。
     * @returns {Array} Array of matching items.
     *                  一致するアイテムの配列。
     */
    getItemsByPartialName: function (layer, partialName) {
        try {
            if (!layer || !partialName) {
                DebugLogManager.error("[GET ITEMS] Invalid layer or partial name provided.");
                return [];
            }

            var matchingItems = [];
            var totalItems = layer.pageItems.length;

            DebugLogManager.info("[GET ITEMS] Searching for items in layer:", layer.name, "with partial name:", partialName);
        
            for (var i = 0; i < totalItems; i++) {
                var item = layer.pageItems[i];

                if (item.name.substring(0, partialName.length) === partialName)                    matchingItems.push(item);
                }
            

            DebugLogManager.info("[GET ITEMS] Found", matchingItems.length, "items matching:", partialName);
            return matchingItems;

        } catch (e) {
            DebugLogManager.error("[GET ITEMS] Error retrieving items:", e.toString());
            return [];
        }
    },

    reverseArray: function (arr) {
        var reversed = [];
        for (var i = arr.length - 1; i >= 0; i--) {
            reversed.push(arr[i]);
        }
        return reversed;
    },

    /**
     * Generates the output string from all logged data
     * @returns {String} The formatted output string
     */
    generateOutput: function() {
        try {
            DebugLogManager.info("Generating output");
            var output = '';
            
            // Document level information
            output += LOG_KEYS.DOC_PATH + ': ' + this._data[LOG_KEYS.DOC_PATH] + '\n';
            output += LOG_KEYS.DOC_NAME + ': ' + this._data[LOG_KEYS.DOC_NAME] + '\n';
            output += LOG_KEYS.EXPORT_PATH + ': ' + this._data[LOG_KEYS.EXPORT_PATH] + '\n';
            output += LOG_KEYS.LAYER_COUNT + ': ' + this._data[LOG_KEYS.LAYER_COUNT] + '\n';
            
            // Layer information
            for (var i = 0; i < this._layerData.length; i++) {
                var layerInfo = this._layerData[i];
                output += LOG_KEYS.LAYER_NAME + ': ' + layerInfo[LOG_KEYS.LAYER_NAME] + '\n';
                output += LOG_KEYS.LAYER_CHARS + ': ' + layerInfo[LOG_KEYS.LAYER_CHARS] + '\n';
            }
            
            // Target layer information
            output += LOG_KEYS.TARGET_FOUND + ': ' + this._data[LOG_KEYS.TARGET_FOUND] + '\n';
            output += LOG_KEYS.AREA_POINTS + ': ' + this._data[LOG_KEYS.AREA_POINTS] + ' square points\n';
            output += LOG_KEYS.AREA_MM + ': ' + this._data[LOG_KEYS.AREA_MM] + '\n';
            output += LOG_KEYS.AREA_CM + ': ' + this._data[LOG_KEYS.AREA_CM] + '\n';
            output += LOG_KEYS.HEIGHT_POINTS + ': ' + this._data[LOG_KEYS.HEIGHT_POINTS] + '\n';
            output += LOG_KEYS.HEIGHT_MM + ': ' + this._data[LOG_KEYS.HEIGHT_MM] + '\n';
            output += LOG_KEYS.HEIGHT_CM + ': ' + this._data[LOG_KEYS.HEIGHT_CM] + '\n';

            // Calculate total LED count from the LED layer if available
            var doc = app.activeDocument;
            var ledLayer = LayerManager.findLayerByName(doc, "LED");
            if (ledLayer) {
                var totalLEDCount = ledLayer.groupItems.length;
                output += LOG_KEYS.LED_COUNT + ': ' + totalLEDCount + '\n';
            }

            // Shape measurements
            if (this._data.shapes && this._data.shapes.length > 0) {
                output += "\n=== SHAPE MEASUREMENTS ===\n";
                
                for (var i = 0; i < this._data.shapes.length; i++) {
                    var index = ("00000" + (i + 1)).slice(-5);  // Pad with leading zeros
                    var shape = this._data.shapes[i];
                    
                    output += "\n--- Shape " + index + " ---\n";
                    output += LOG_KEYS.SHAPE_NAME_ROOT + index + ": " + shape.name + "\n";
                    
                    // Width measurements
                    output += LOG_KEYS.SHAPE_WIDTH_PT + index + ": " + shape.width.pt.toFixed(2) + "\n";
                    output += LOG_KEYS.SHAPE_WIDTH_MM + index + ": " + shape.width.mm.toFixed(2) + "\n";
                    output += LOG_KEYS.SHAPE_WIDTH_CM + index + ": " + shape.width.cm.toFixed(2) + "\n";
                    
                    // Height measurements
                    output += LOG_KEYS.SHAPE_HEIGHT_PT + index + ": " + shape.height.pt.toFixed(2) + "\n";
                    output += LOG_KEYS.SHAPE_HEIGHT_MM + index + ": " + shape.height.mm.toFixed(2) + "\n";
                    output += LOG_KEYS.SHAPE_HEIGHT_CM + index + ": " + shape.height.cm.toFixed(2) + "\n";
                    
                    // Area measurements
                    output += LOG_KEYS.SHAPE_AREA_PTSQ + index + ": " + shape.area.pt.toFixed(2) + "\n";
                    output += LOG_KEYS.SHAPE_AREA_MMSQ + index + ": " + shape.area.mm.toFixed(2) + "\n";
                    output += LOG_KEYS.SHAPE_AREA_CMSQ + index + ": " + shape.area.cm.toFixed(2) + "\n";

                    // LED Count and List - with ExtendScript-compatible handling
                    var ledCount = 0;
                    var ledListStr = "";

                    if (shape.hasOwnProperty('leds') && shape.leds) {
                        // Handle the leds array
                        if (shape.leds.length !== undefined) {
                            ledCount = shape.leds.length;
                            var ledItems = [];
                            for (var j = 0; j < shape.leds.length; j++) {
                                var led = shape.leds[j];
                                if (led && led.hasOwnProperty('name') && led.hasOwnProperty('confidence')) {
                                    ledItems.push(led.name + " (" + led.confidence.toFixed(2) + "%)");
                                }
                            }
                            ledListStr = ledItems.join(", ");
                        }
                    }
                    
                    // Fallback to direct ledCount property if it exists
                    if (shape.hasOwnProperty('ledCount') && 
                        typeof shape.ledCount !== 'undefined' && 
                        shape.ledCount !== null) {
                        ledCount = shape.ledCount;
                    }

                    // Fallback to direct ledList property if it exists
                    if (shape.hasOwnProperty('ledList') && 
                        typeof shape.ledList === 'string' && 
                        shape.ledList.length > 0) {
                        ledListStr = shape.ledList;
                    }

                    // Export Path Information if available
                    if (shape.hasOwnProperty('pngPath')) {
                        output += LOG_KEYS.SHAPE_PNG_PATH + index + ": " + shape.pngPath + "\n";
                    }
                    if (shape.hasOwnProperty('posPath')) {
                        output += LOG_KEYS.SHAPE_POS_PNG_PATH + index + ": " + shape.posPath + "\n";
                    }
                    if (shape.hasOwnProperty('ledsPath')) {
                        output += LOG_KEYS.SHAPE_LEDS_PNG_PATH + index + ": " + shape.ledsPath + "\n";
                    }

                    // Write LED information
                    output += LOG_KEYS.SHAPE_LED_COUNT + index + ": " + ledCount + "\n";
                    output += LOG_KEYS.SHAPE_LED_LIST + index + ": " + ledListStr + "\n";
                }
            } else {
                output += "\n🚨 No shape measurements found. 🚨\n";
            }

            DebugLogManager.info("Output generated successfully");
            return output;
            
        } catch (e) {
            DebugLogManager.error("Error in generateOutput:", e.toString());
            return '';
        }
    },
        
     /**
     * Creates and logs a structured format of bounding box overlap information
     * バウンディングボックスのオーバーラップ情報を構造化された形式で作成しログに記録します
     * 
     * @param {string} partName - Name of the part (e.g., "Part_00001")
     *                           パーツの名前（例：「Part_00001」）
     * @param {Array} overlappingLEDs - Array of overlapping LED IDs
     *                                 重複するLEDのID配列
     */
    logStructuredBBoxAnalysis: function(partName, overlappingLEDs) {
        // Extract numeric portion from part name (e.g., "00001" from "Part_00001")
        // パーツ名から数値部分を抽出（例：「Part_00001」から「00001」を取得）
        var partNameParts = partName.split("_");
        var partNumber = partNameParts[1];
        
        // Create structured data object
        // 構造化されたデータオブジェクトを作成
        var structuredLog = {};
        structuredLog["Part_name"] = partName;
        structuredLog["Part_led_count_" + partNumber] = overlappingLEDs.length;
        structuredLog["Part_led_list_" + partNumber] = overlappingLEDs;
        
        // Create formatted string representation (ExtendScript compatible)
        // フォーマットされた文字列表現を作成（ExtendScript互換）
        var formattedString = "{\n" +
            '  "Part_name": "' + structuredLog["Part_name"] + '",\n' +
            '  "Part_led_count_' + partNumber + '": ' + structuredLog["Part_led_count_" + partNumber] + ',\n' +
            '  "Part_led_list_' + partNumber + '": [\n    "' + 
            structuredLog["Part_led_list_" + partNumber].join('",\n    "') + 
            '"\n  ]\n}';
        
        // Log the structured analysis
        // 構造化された分析をログに記録
        DebugLogManager.info("[BBOX] Structured " + partName + " analysis\n" + formattedString);
    },
    
     /**
     * Creates and logs a structured format of bounding box overlap information
     * バウンディングボックスのオーバーラップ情報を構造化された形式で作成しログに記録します
     * 
     * @param {string} partName - Name of the part (e.g., "Part_00001")
     *                           パーツの名前（例：「Part_00001」）
     * @param {Array} overlappingLEDs - Array of overlapping LED IDs
     *                                 重複するLEDのID配列
     */
    unwindConfirmedLeds: function(confirmedLeds) {
        
        
        // Create structured data object
        // 構造化されたデータオブジェクトを作成
        var structuredLog = {};
        structuredLog["Part_name"] = partName;
        structuredLog["Part_led_count_" + partNumber] = overlappingLEDs.length;
        structuredLog["Part_led_list_" + partNumber] = overlappingLEDs;
        
        // Create formatted string representation (ExtendScript compatible)
        // フォーマットされた文字列表現を作成（ExtendScript互換）
        var formattedString = "{\n" +
            '  "Part_name": "' + structuredLog["Part_name"] + '",\n' +
            '  "Part_led_count_' + partNumber + '": ' + structuredLog["Part_led_count_" + partNumber] + ',\n' +
            '  "Part_led_list_' + partNumber + '": [\n    "' + 
            structuredLog["Part_led_list_" + partNumber].join('",\n    "') + 
            '"\n  ]\n}';
        
        // Log the structured analysis
        // 構造化された分析をログに記録
        DebugLogManager.info("[BBOX] Structured " + partName + " analysis\n" + formattedString);
    },
    
    /**
     * Writes log data to a file, automatically handling success and error logs.
     * 成功ログとエラーログを自動処理してログデータをファイルに書き込む。
     *
     * If `filePath` is provided, the log is written to that specific location.
     * Otherwise, it defaults to writing the output log to `<document_path>/<document_name>_output_log.txt`.
     * If an error occurs during writing, an error log is saved to `<document_path>/<document_name>_error_log.txt`.
     * 
     * `filePath` が指定された場合、そのパスにログを書き込む。
     * それ以外の場合、デフォルトで `<document_path>/<document_name>_output_log.txt` にログを書き込む。
     * 書き込み中にエラーが発生した場合は、 `<document_path>/<document_name>_error_log.txt` にエラーログを保存する。
     *
     * @param {string} [filePath] - (Optional) The file path to write the log. If omitted, the default path is used.
     *                              (省略可能) ログを書き込むファイルパス。省略した場合はデフォルトのパスが使用される。
     * @param {string} [errorMessage] - (Optional) Error message to include in the log if writing fails.
     *                                  (省略可能) 書き込みに失敗した場合にログに含めるエラーメッセージ。
     * @returns {boolean} `true` if writing was successful, `false` if an error occurred.
     *                    書き込みが成功した場合は `true`、エラーが発生した場合は `false`。
     */
    writeToFile: function(filePath, errorMessage) {
        try {
            var doc = app.activeDocument;
            if (!doc) {
                DebugLogManager.error("No active document found.");
                return false;
            }

            // Extract document path and name (excluding .ai extension)
            var docPath = doc.path;
            var docName = doc.name.replace(/\.ai$/i, '');

            // Define default log paths
            var defaultSuccessLogPath = docPath + "/" + docName + "_output_log.txt";
            var defaultErrorLogPath = docPath + "/" + docName + "_error_log.txt";

            // Use provided filePath if available, otherwise use the default success log path
            var logFilePath = filePath || defaultSuccessLogPath;

            DebugLogManager.info("Writing log to:", logFilePath);

            // Initialize file in write mode to clear it
            var file = new File(logFilePath);
            file.encoding = "UTF-8";
            file.open("w");
            
            // Create formatted timestamp
            var now = new Date();
            var timestamp = now.getFullYear() + "-" + 
                            ("0" + (now.getMonth() + 1)).slice(-2) + "-" + 
                            ("0" + now.getDate()).slice(-2) + " " +
                            ("0" + now.getHours()).slice(-2) + ":" +
                            ("0" + now.getMinutes()).slice(-2) + ":" +
                            ("0" + now.getSeconds()).slice(-2);
            
            file.writeln("/* Log generated at: " + timestamp + " */\n");

            // Generate and write output
            var output = this.generateOutput();


            // **Append LED Assignments**
            if (LogManager._cachedLedAssignments.length > 0) {
                file.writeln("\n=====LED Assignments=====");
                for (var i = 0; i < LogManager._cachedLedAssignments.length; i++) {
                    file.writeln(LogManager._cachedLedAssignments[i]);
                }
            }

            // Append error message if provided
            if (errorMessage) {
                output += "\n\n=== ERROR DETAILS ===\n" + errorMessage + "\n";
            }

            file.write(output);
            file.close();

            DebugLogManager.info("Log successfully written to:", logFilePath);
            return true;

        } catch (e) {
            DebugLogManager.error("Error writing log:", e.toString());

            // Attempt to write an error log instead
            try {
                DebugLogManager.info("Attempting to write error log to:", defaultErrorLogPath);
                var errorFile = new File(defaultErrorLogPath);
                errorFile.encoding = "UTF-8";
                errorFile.open("w");

                // Create formatted timestamp for error log
                var errorNow = new Date();
                var errorTimestamp = errorNow.getFullYear() + "-" + 
                                    ("0" + (errorNow.getMonth() + 1)).slice(-2) + "-" + 
                                    ("0" + errorNow.getDate()).slice(-2) + " " +
                                    ("0" + errorNow.getHours()).slice(-2) + ":" +
                                    ("0" + errorNow.getMinutes()).slice(-2) + ":" +
                                    ("0" + errorNow.getSeconds()).slice(-2);

                var errorContent = "/* Error Log generated at: " + errorTimestamp + " */\n\n";
                errorContent += "Error encountered while writing log:\n" + e.toString();
                if (errorMessage) {
                    errorContent += "\n\nOriginal Error:\n" + errorMessage;
                }

                errorFile.write(errorContent);
                errorFile.close();

                DebugLogManager.info("Error log successfully written to:", defaultErrorLogPath);
            } catch (errorFileException) {
                DebugLogManager.error("Failed to write error log:", errorFileException.toString());
            }

            return false;
        }
    }

};

    // Export Manager
    var ExportManager = {
        exportLayerToPNG: function (layer, exportPath) {
            DebugLogManager.info("ExportManager.exportLayerToPNG: layer = " + layer + ". exportPath" + exportPath);
            if (!layer || !exportPath) return false;
        
            var doc = app.activeDocument;
            var originalState = this.saveDocumentState(doc);
        
            try {
                this.prepareLayerForExport(doc, layer);
                this.executeExport(doc, layer, exportPath);
                return true;
            } catch (e) {
                DebugLogManager.error("Error exporting PNG:", e.toString());
                return false;
            } finally {
                this.restoreDocumentState(doc, originalState);
            }
        },
    
        saveDocumentState: function (doc) {
            DebugLogManager.info("ExportManager.saveDocumentState: doc = " + doc);
            var layerVisibility = [];
            for (var i = 0; i < doc.layers.length; i++) {
                layerVisibility.push(doc.layers[i].visible);
            }
            return {
                activeArtboard: doc.artboards[doc.artboards.getActiveArtboardIndex()],
                artboardRect: doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect,
                layerVisibility: layerVisibility
            };
        },
    
        prepareLayerForExport: function (doc, targetLayer) {
            DebugLogManager.info("ExportManager.prepareLayerForExport: doc = " + doc + ". targetLayer = " + targetLayer);
            // Hide all layers except target

            for (var i = 0; i < doc.layers.length; i++) {
                doc.layers[i].visible = false;
            }
            targetLayer.visible = true;
        
            // Set artboard to layer bounds
            if (targetLayer.pageItems.length > 0) {
                var bounds = this.calculateLayerBounds(targetLayer);
                doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect = bounds;
            }
        },
    
        calculateLayerBounds: function (layer) {
            DebugLogManager.info("ExportManager.calculateLayerBounds: layer = " + layer);
            // Implementation similar to existing bounds calculation
            var bounds = layer.pageItems[0].visibleBounds;
            // ... bounds calculation ...
            return bounds;
        },
    
        executeExport: function (doc, layer, exportPath) {
            DebugLogManager.info("ExportManager.executeExport: doc = " + doc + " layer = " + layer + " exportPath = " + exportPath);
            var options = new ExportOptionsPNG24();
            options.transparency = true;
            options.artBoardClipping = true;
            options.antiAliasing = true;
            options.horizontalScale = 100;
            options.verticalScale = 100;
        
            var file = new File(exportPath);
            doc.exportFile(file, ExportType.PNG24, options);
        },
    
        restoreDocumentState: function (doc, state) {
            DebugLogManager.info("ExportManager.executeExport: doc = " + doc + " state = " + state);
            state.activeArtboard.artboardRect = state.artboardRect;

            for (var i = 0; i < doc.layers.length; i++) {
                doc.layers[i].visible = state.layerVisibility[i];
            }
        }
    };

    // Layer Manager methods update
    LayerManager.getMaxHeight = function (layer) {
        DebugLogManager.info("LayerManager.getMaxHeight: layer = " + layer);
        try {
            var maxHeight = 0;
        
            if (layer.pageItems && layer.pageItems.length > 0) {
                for (var i = 0; i < layer.pageItems.length; i++) {
                    var bounds = layer.pageItems[i].visibleBounds;
                    var height = Math.abs(bounds[1] - bounds[3]);
                    maxHeight = Math.max(maxHeight, height);
                }
            }
        
            if (layer.layers && layer.layers.length > 0) {
                for (var i = 0; i < layer.layers.length; i++) {
                    var sublayerHeight = this.getMaxHeight(layer.layers[i]);
                    maxHeight = Math.max(maxHeight, sublayerHeight);
                }
            }
        
            return maxHeight;
        } catch (e) {
            $.writeln('Error calculating max height: ' + e);
            return 0;
        }
    };

    LayerManager.countLEDGroups = function (layer) {
        DebugLogManager.info("LayerManager.countLEDGroups: layer = " + layer);
        try {
            var ledLayer = this.findLayerByName(app.activeDocument, 'LED');
            if (!ledLayer) return 0;
        
            var groupCount = 0;
            for (var i = 0; i < ledLayer.pageItems.length; i++) {
                if (ledLayer.pageItems[i].typename === 'GroupItem') {
                    groupCount++;
                }
            }
            return groupCount;
        } catch (e) {
            $.writeln('Error counting LED groups: ' + e);
            return 0;
        }
    };

    /**
     * ProcessingManager: Handles the full pipeline of item movement, sorting, detection, and reporting.
     * 
     * ProcessingManager はアイテムの移動、ソート、検出、レポート生成を管理する。
     */
    var ProcessingManager = {
    
    
        /**
         * Initializes the processing pipeline by setting up layers and structures.
         * 処理パイプラインを初期化し、レイヤーや構造を設定する。
         * 
         * @param {Document} doc - The active Illustrator document. / 処理対象の Illustrator ドキュメント。
         * @returns {Object|null} Initialization result containing layers and items. / 初期化結果（レイヤーとアイテム）。
         */
        initialize: function(doc, layerChars) {
            try {
                DebugLogManager.info("[INIT] Initializing processing...");

                if (!doc) {
                    throw new Error("No document provided");
                }

                // Find required layers
                var ledLayer = LayerManager.findLayerByName(doc, "LED");
                var partsLayer = LayerManager.findLayerByChars(doc, layerChars);
                
                if (!ledLayer) {
                    throw new Error("LED layer not found");
                }
                if (!partsLayer) {
                    throw new Error("Parts layer not found");
                }

                DebugLogManager.info("[INIT] Found required layers");

                // Create temp layer
                var tempLayer = doc.layers.add();
                tempLayer.name = "Temp_Union_Layer";
                DebugLogManager.info("[INIT] Created temp layer");

                // Move and sort items
                var sortedLEDs = LayerManager.moveSortedLeds(ledLayer, tempLayer);
                var sortedParts = LayerManager.moveSortedParts(partsLayer, tempLayer);

                DebugLogManager.info("[INIT] Sorted LEDs count: " + sortedLEDs.length);
                DebugLogManager.info("[INIT] Sorted Parts count: " + sortedParts.length);

                return {
                    tempLayer: tempLayer,
                    ledLayer: ledLayer,
                    partsLayer: partsLayer,
                    sortedLEDs: sortedLEDs,
                    sortedParts: sortedParts
                };

            } catch (error) {
                DebugLogManager.error("[INIT] Failed to initialize processing: " + error);
                return null;
            }
        },

        /**
         * Creates a temporary layer for processing.
         * 処理用の一時レイヤーを作成する。
         * 
         * @param {Document} doc - The active Illustrator document. / 処理対象の Illustrator ドキュメント。
         * @returns {Layer} The created temporary layer. / 作成された一時レイヤー。
         */
        initializeTempLayer: function (doc) {
            try {
                DebugLogManager.info("[INIT] Creating temporary processing layer...");
                //var tempLayer = doc.layers.add();
                //tempLayer.name = "Temp_Union_Layer";
                //return tempLayer;
            } catch (error) {
                DebugLogManager.error("[ERROR] Failed to create tempLayer:", error);
                return null;
            }
        },

        executeProcessing: function (initData) {
            _mngName = "[PROCESSMGR]"; // Substitute MANAGER with appropriate name of manager.
            funName = "[PROCESS]";
            try {
                var funName = this._mngName + "[EXECUTE] "; // Substitute FUNCTION  with appropriate name of function
                DebugLogManager.info(funName + "Starting...")

                if (!initData || !initData.tempLayer || !initData.partsLayer || !initData.ledLayer || !initData.sortedLEDs || !initData.sortedParts) {
                    DebugLogManager.error("Invalid initialization data.");
                    return {};
                }
                try {
                    DebugLogManager.info("[PASS1][STEP1] Starting simpleBoundingBoxOverlap detection with caching");

                    var parts = initData.sortedParts;
                    var leds = initData.sortedLEDs;


                     // Copy object references for efficiency
                    OverlapDetectionManager.pass1_unassigned = leds.slice();


                    // PASS 1: Bounding box detection

                    // Put the results directly in the cache for efficiency
                    OverlapDetectionManager.pass1_bbox_overlaps = OverlapDetectionManager.simpleBoundingBoxOverlap(parts, leds);
                    var bboxResults = OverlapDetectionManager.pass1_bbox_overlaps;

                    DebugLogManager.info("[STEP1] bboxResults: " + serialize(bboxResults));
                    DebugLogManager.info("[STEP1] Completed bounding box overlap detection");

                    DebugLogManager.info("[PASS1][STEP2] Completed bounding box overlap detection");

                    // Step 2: Geometry refinement
                    var confirmedResults = OverlapDetectionManager.refineOverlapWithGeometry(parts, leds, bboxResults);
                    DebugLogManager.info("[PASS1] confirmedResults: " + serializeConfirmedOverlaps(confirmedResults));
                    DebugLogManager.info("[PASS1] Completed geometry refinement");

 
                    return confirmedResults;
                } catch (e) {
                    DebugLogManager.error(funName + " " + e.toString());
                    
                }

            } catch (e) {
                DebugLogManager.error(funName + " encountered exception: " + e.toString());
            return false;
        }
        },

        /**
         * Executes the full processing workflow including sorting, detection, and logging.
         * ソート、検出、ロギングを含む全体の処理ワークフローを実行する。
         * 
         * @param {Object} initData - The initialization data. / 初期化データ。
         */
        _executeProcessing: function (initData) {
            try {
                DebugLogManager.info("[EXECUTE] Running main processing workflow...");

                if (!initData || !initData.tempLayer || !initData.partsLayer || !initData.ledLayer || !initData.sortedLEDs || !initData.sortedParts) {
                    DebugLogManager.error("Invalid initialization data.");
                    return {};
                }

                var tempLayer = initData.tempLayer;
                var sortedParts = initData.sortedParts;
                var sortedLEDs = initData.sortedLEDs;

                var results = {};

                // Process each part against LEDs
                for (var i = 0; i < sortedParts.length; i++) {
                    var part = sortedParts[i];
                    DebugLogManager.info("[PROCESS] Checking overlaps for:", part.name);

                    var confirmedLEDs = OverlapDetectionManager.detectOverlap([part], sortedLEDs);

                    var ledList = confirmedLEDs[part.name] || [];

                    DebugLogManager.info("[RESULT] Confirmed LEDs for:", part.name, "=>", ledList);
   
                    results[part.name] = { // ✅ Store by part name
                        ledCount: ledList.length,
                        leds: ledList
                    };
                }
                return results;
            } catch (error) {
                DebugLogManager.error("[ERROR] Execution failed:", error);
                return {};
            }

            
        },

        /**
         * Finalizes processing by removing the temp layer safely.
         * 一時レイヤーを削除して処理を完了する。
         * 
         * @param {Layer} tempLayer - The temporary processing layer. / 処理用の一時レイヤー。
         */
        finalizeProcessing: function (tempLayer) {
            try {
                DebugLogManager.info("[FINALIZE] Cleaning up temporary processing layer...");

                if (!tempLayer) {
                    DebugLogManager.warn("[WARNING] Temp layer does not exist or has already been removed.");
                    return;
                }

                try {
                    var itemCount = tempLayer.pageItems.length;
                    DebugLogManager.info("[INFO] Total items in tempLayer before deletion: " + itemCount);

                    // Delete from last to first to avoid referencing deleted items
                    for (var i = itemCount - 1; i >= 0; i--) {
                        try {
                            tempLayer.pageItems[i].remove();
                        } catch (removeError) {
                            DebugLogManager.error("[ERROR] Failed to remove pageItem at index " + i + ": " + removeError);
                        }
                    }

                    // Ensure layer still exists before removing
                    if (tempLayer.pageItems.length === 0) {
                        tempLayer.remove();
                        DebugLogManager.info("[FINALIZE] Temp layer removed successfully.");
                    } else {
                        DebugLogManager.warn("[WARNING] Temp layer still contains items after attempted cleanup.");
                    }

                } catch (error) {
                    DebugLogManager.error("[ERROR] Failed to remove tempLayer or its contents: " + error);
                }

            } catch (error) {
                DebugLogManager.error("[ERROR] Finalization failed with tempLayer: " + tempLayer + " | Error: " + error);
            }
        }
    };

function showTargetLayerSelectionDialog() {
    var dialog = new Window("dialog", "Select an Option");
    var dropdown = dialog.add("dropdownlist", undefined, ["支給データ", "表面", "基板"]);
    dropdown.selection = 0; // Set default selection to first item
    
    // Add OK and Cancel buttons
    var buttonGroup = dialog.add("group");
    buttonGroup.add("button", undefined, "OK", {name: "ok"});
    buttonGroup.add("button", undefined, "Cancel", {name: "cancel"});
    
    if (dialog.show() == 1) {
        return dropdown.selection.text;
    }
    return null;
}

// CSV Export Utility for Illustrator | CSVエクスポートユーティリティ（Illustrator用）
// Compatible with ExtendScript for Adobe Illustrator | Adobe Illustrator用のExtendScriptと互換性あり

/**
 * CSVExportManager: Handles parsing log files and exporting data to CSV/Excel formats
 * CSVエクスポートマネージャー: ログファイルの解析とCSV/Excel形式へのデータエクスポートを処理
 */
var CSVExportManager = {
    _mngName: "[CSVEXPORTMGR]",
    

    // Auto-find output logs for the current document
    runExport: function () {
        try {
            if (app.documents.length === 0) {
                alert("Please open a document first");
                return;
            }
            
            var doc = app.activeDocument;
            
            // Locate the existing log file
            var docFolder = new Folder(doc.path);
            var baseName = doc.name.replace(/\.ai$/i, '');
            var logFile = new File(docFolder + "/" + baseName + "_output_log.txt");
            
            if (!logFile.exists) {
                alert("Cannot find log file: " + logFile.fsName + "\nPlease select the existing log file manually.");
                
                // Allow user to select the existing log file
                logFile = File.openDialog("Select existing output log file", "Text files:*.txt");
                if (!logFile) {
                    return; // User canceled
                }
            }
            
            // Pass the existing log file path to the export function
            var result = exportCSVFiles(logFile.fsName);
            
            alert("CSV Export " + (result ? "succeeded!" : "failed!"));
        } catch(e) {
            alert("Error: " + e.toString());
        }
    },

    /**
     * Main export function that reads a log file and exports to CSV
     * ログファイルを読み込みCSVにエクスポートするメイン関数
     * 
     * @param {String} logFilePath - Path to the _output_log.txt file | _output_log.txtファイルへのパス
     * @param {String} csvFilePath - Path where CSV file should be saved | CSVファイルを保存するパス
     * @param {Boolean} createExcel - Whether to also create Excel-compatible format (CSV with BOM) | Excel互換形式（BOM付きCSV）も作成するかどうか
     * @returns {Boolean} Success status | 成功ステータス
     */
    exportLogToCSV: function(logFilePath, csvFilePath, createExcel) {
        try {
            DebugLogManager.info(this._mngName + " Exporting log to CSV: " + logFilePath);
            
            // Read the log file | ログファイルを読み込み
            var logData = this._readLogFile(logFilePath);
            if (!logData) {
                throw new Error("Failed to read log file | ログファイルの読み込みに失敗しました");
            }
            
            // Parse the log data | ログデータを解析
            var parsedData = this._parseLogData(logData);
            if (!parsedData) {
                throw new Error("Failed to parse log data | ログデータの解析に失敗しました");
            }
            
            // Write to CSV | CSVに書き込み
            var success = this._writeCSVFile(csvFilePath, parsedData);
            if (!success) {
                throw new Error("Failed to write CSV file | CSVファイルの書き込みに失敗しました");
            }
            
            // Optionally create Excel-compatible file | オプションでExcel互換ファイルを作成
            if (createExcel) {
                var excelPath = csvFilePath.replace(/\.csv$/i, '_excel.csv');
                var excelSuccess = this._writeExcelCompatibleCSV(excelPath, parsedData);
                if (!excelSuccess) {
                    DebugLogManager.warn(this._mngName + " Failed to create Excel-compatible file | Excel互換ファイルの作成に失敗しました");
                }
            }
            
            DebugLogManager.info(this._mngName + " Successfully exported CSV to: " + csvFilePath);
            return true;
            
        } catch (error) {
            DebugLogManager.error(this._mngName + " Export failed: " + error.toString());
            return false;
        }
    },
    
    /**
     * Reads the log file and returns its contents
     * ログファイルを読み込み、その内容を返す
     * 
     * @param {String} filePath - Path to the log file | ログファイルへのパス
     * @returns {String|null} File contents or null on failure | ファイルの内容、または失敗時はnull
     */
    _readLogFile: function(filePath) {
        try {
            var file = new File(filePath);
            if (!file.exists) {
                DebugLogManager.error(this._mngName + " Log file does not exist: " + filePath);
                return null;
            }
            
            file.encoding = "UTF-8";
            file.open("r");
            var content = file.read();
            file.close();
            
            if (!content || content === "") {
                DebugLogManager.error(this._mngName + " Log file is empty");
                return null;
            }
            
            return content;
        } catch (error) {
            DebugLogManager.error(this._mngName + " Failed to read log file: " + error.toString());
            return null;
        }
    },
    
    /**
     * Parses log data into structured format
     * ログデータを構造化された形式に解析する
     * 
     * @param {String} logData - Raw log file content | 生のログファイル内容
     * @returns {Object} Structured data with headers and rows | ヘッダーと行を含む構造化データ
     */
    _parseLogData: function(logData) {
        try {
            DebugLogManager.info(this._mngName + " Parsing log data | ログデータを解析中");
            
            var lines = logData.split(/\r\n|\r|\n/);
            var documentData = {};
            var shapeData = {};
            var allKeys = [];
            var shapeKeys = [];
            
            // First pass: extract document data and identify shape data
            // 第1パス：ドキュメントデータの抽出と形状データの識別
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                var trimmedLine = this._trimString(line);
                
                // Skip empty lines or section markers | 空行やセクションマーカーをスキップ
                if (trimmedLine === "" || trimmedLine.match(/^(===|---)/)) {
                    continue;
                }
                
                // Skip comment lines | コメント行をスキップ
                if (trimmedLine.indexOf("/*") === 0) {
                    continue;
                }
                
                // Look for key-value pairs (containing colon) | キーと値のペア（コロンを含む）を探す
                var colonIndex = line.indexOf(":");
                if (colonIndex > -1) {
                    var key = this._trimString(line.substring(0, colonIndex));
                    var value = this._trimString(line.substring(colonIndex + 1));
                    
                    // Check if this is shape-specific data | これが形状固有のデータかどうかを確認
                    var shapeMatch = key.match(/(Part_\w+)_(\d{5})$/);
                    if (shapeMatch) {
                        var baseKey = shapeMatch[1];
                        var index = shapeMatch[2];
                        
                        // Initialize shape data structure if needed | 必要に応じて形状データ構造を初期化
                        if (!shapeData[index]) {
                            shapeData[index] = {};
                        }
                        
                        // Store the data with base key | ベースキーでデータを保存
                        shapeData[index][baseKey] = value;
                        
                        // Add to known shape keys if new | 新しい場合は既知の形状キーに追加
                        if (this._arrayContains(shapeKeys, baseKey) === false) {
                            shapeKeys.push(baseKey);
                        }
                    } else {
                        // This is document-level data | これはドキュメントレベルのデータ
                        documentData[key] = value;
                        
                        // Add to known document keys if new | 新しい場合は既知のドキュメントキーに追加
                        if (this._arrayContains(allKeys, key) === false) {
                            allKeys.push(key);
                        }
                    }
                }
            }
            
            // Second pass: create rows with document data in columns A-L and shape data in M+
            // 第2パス：ドキュメントデータを列A-Lに、形状データを列M以降に配置して行を作成
            var rows = [];
            var shapeIndices = this._getObjectKeys(shapeData);
            
            // Organize document keys in the correct order
            // ドキュメントキーを正しい順序で整理
            var orderedDocKeys = [
                "Document path", 
                "Document name", 
                "Export path", 
                "Number of layers", 
                "Found target layer", 
                "Area (ptsq)", 
                "Area (mmsq)", 
                "Area (cmsq)", 
                "Max Height (points)", 
                "Max Height (mm)", 
                "Max Height (cm)",
                "LED Group Count"
            ];
            
            // Filter keys to match only those present in the data
            // データに存在するキーのみと一致するようにキーをフィルタリング
            var finalDocKeys = [];
            for (var i = 0; i < orderedDocKeys.length; i++) {
                if (documentData.hasOwnProperty(orderedDocKeys[i])) {
                    finalDocKeys.push(orderedDocKeys[i]);
                }
            }
            
            // Add any remaining document keys not in the ordered list
            // 順序付きリストにないドキュメントキーを追加
            for (var key in documentData) {
                if (documentData.hasOwnProperty(key) && this._arrayContains(finalDocKeys, key) === false) {
                    finalDocKeys.push(key);
                }
            }
            
            // Get all document values in the correct order
            // 正しい順序ですべてのドキュメント値を取得
            var docValues = [];
            for (var i = 0; i < finalDocKeys.length; i++) {
                if (documentData.hasOwnProperty(finalDocKeys[i])) {
                    docValues.push(documentData[finalDocKeys[i]]);
                } else {
                    docValues.push("");
                }
            }
            
            // Add bilingual headers for document data
            // ドキュメントデータのバイリンガルヘッダーを追加
            var docHeaders = [
                "Doc path/パス", 
                "Doc name/名", 
                "Export path/エキスポートパス", 
                "Number of layers/レーヤー数", 
                "Target layer/ターゲットレヤー", 
                "Area (ptsq)/面積", 
                "Area (mmsq)/面積", 
                "Area (cmsq)/面積", 
                "Max Height (points)/最大高さ", 
                "Max Height (mm)/最大高さ", 
                "Max Height (cm)/最大高さ", 
                "Total LED Count/LED数合計"
            ];
            
            // Ensure headers match available data
            // ヘッダーが利用可能なデータと一致することを確認
            var finalDocHeaders = [];
            for (var i = 0; i < Math.min(docHeaders.length, finalDocKeys.length); i++) {
                finalDocHeaders.push(docHeaders[i]);
            }
            
            // Add shape data with organized headers
            // 整理されたヘッダーで形状データを追加
            if (shapeIndices.length > 0) {
                // Create organized headers for shape data
                // 形状データの整理されたヘッダーを作成
                var shapeHeaders = [
                    "ShapeName(形状名)",
                    "Width_pt(幅_pt)",
                    "Width_mm(幅_mm)",
                    "Width_cm(幅_cm)",
                    "Height_pt(高さ_pt)",
                    "Height_mm(高さ_mm)",
                    "Height_cm(高さ_cm)",
                    "Area_ptsq(面積_ptsq)",
                    "Area_mm2(面積_mm2)",
                    "Area_cm2(面積_cm2)",
                    "LEDCount(LED数)",
                    "AssociatedLEDs(関連LED)"
                ];
                
                // Map logical shape keys to display headers
                // 論理的な形状キーを表示ヘッダーにマッピング
                var shapeKeyToHeader = {
                    "Part": "ShapeName(形状名)",
                    "Part_width_(pt)": "Width_pt(幅_pt)",
                    "Part_width_(mm)": "Width_mm(幅_mm)",
                    "Part_width_(cm)": "Width_cm(幅_cm)",
                    "Part_height_(pt)": "Height_pt(高さ_pt)",
                    "Part_height_(mm)": "Height_mm(高さ_mm)",
                    "Part_height_(cm)": "Height_cm(高さ_cm)",
                    "Part_area_(ptsq)": "Area_ptsq(面積_ptsq)",
                    "Part_area_(mmsq)": "Area_mm2(面積_mm2)",
                    "Part_area_(cmsq)": "Area_cm2(面積_cm2)",
                    "Part_led_count": "LEDCount(LED数)",
                    "Part_led_list": "AssociatedLEDs(関連LED)"
                };
                
                // Create one row per shape with document data repeated
                // ドキュメントデータを繰り返した形状ごとに1行を作成
                for (var j = 0; j < shapeIndices.length; j++) {
                    var index = shapeIndices[j];
                    var rowData = {};
                    
                    // First add document data columns (A-L)
                    // 最初にドキュメントデータ列を追加（A-L）
                    for (var k = 0; k < finalDocHeaders.length; k++) {
                        var headerKey = finalDocHeaders[k];
                        var valueIndex = Math.min(k, docValues.length - 1);
                        rowData[headerKey] = docValues[valueIndex];
                    }
                    
                    // Then add shape data columns (M+)
                    // 次に形状データ列を追加（M+）
                    for (var shapeKey in shapeData[index]) {
                        if (shapeData[index].hasOwnProperty(shapeKey)) {
                            // Get the correct header name from the mapping
                            var headerName = null;
                            
                            // Check exact matches first
                            if (shapeKeyToHeader[shapeKey]) {
                                headerName = shapeKeyToHeader[shapeKey];
                            } else {
                                // For keys with index suffixes like "Part_width_(pt)_00012"
                                // Loop through the mapping keys to find the base key
                                for (var baseKey in shapeKeyToHeader) {
                                    if (shapeKey.indexOf(baseKey) === 0) {
                                        headerName = shapeKeyToHeader[baseKey];
                                        break;
                                    }
                                }
                                
                                // If no match found, use the original key
                                if (!headerName) {
                                    headerName = shapeKey;
                                }
                            }
                            
                            rowData[headerName] = shapeData[index][shapeKey];
                        }
                    }
                    
                    // Ensure shape index is stored
                    // 形状インデックスが保存されていることを確認
                    rowData["ShapeIndex"] = index;
                    
                    rows.push(rowData);
                }
            } else {
                // No shapes - just create one row with document data
                // 形状なし - ドキュメントデータのみで1行作成
                var singleRow = {};
                for (var k = 0; k < finalDocHeaders.length; k++) {
                    var headerKey = finalDocHeaders[k];
                    var valueIndex = Math.min(k, docValues.length - 1);
                    singleRow[headerKey] = docValues[valueIndex];
                }
                rows.push(singleRow);
            }
            
            // Combine document and shape headers
            // ドキュメントと形状のヘッダーを結合
            var combinedHeaders = finalDocHeaders.concat(shapeHeaders);
            
            // Return structured data with separate header sections
            // 分離されたヘッダーセクションを持つ構造化データを返す
            return {
                docHeaders: finalDocHeaders,
                shapeHeaders: shapeHeaders,
                headers: combinedHeaders,
                rows: rows
            };
            
        } catch (error) {
            DebugLogManager.error(this._mngName + " Failed to parse log data: " + error.toString());
            return null;
        }
    },

    // Helper method to check if array contains an element (ExtendScript compatible)
    _arrayContains: function(array, item) {
        for (var i = 0; i < array.length; i++) {
            if (array[i] === item) {
                return true;
            }
        }
        return false;
    },

    // Helper for string trimming
    _trimString: function(str) {
        if (!str) return "";
        // ExtendScript-compatible trim function
        return str.replace(/^\s+|\s+$/g, '');
    },
    
    /**
     * Helper to get object keys for ExtendScript compatibility
     * ExtendScriptの互換性のためのオブジェクトキー取得ヘルパー
     * 
     * @param {Object} obj - The object to get keys from | キーを取得するオブジェクト
     * @returns {Array} Array of keys | キーの配列
     */
    _getObjectKeys: function(obj) {
        var keys = [];
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                keys.push(key);
            }
        }
        return keys;
    },
    
    /**
     * Writes parsed data to a CSV file
     * 解析されたデータをCSVファイルに書き込む
     * 
     * @param {String} filePath - Output CSV file path | 出力CSVファイルパス
     * @param {Object} data - Parsed data with headers and rows | ヘッダーと行を含む解析済みデータ
     * @returns {Boolean} Success status | 成功ステータス
     */
    _writeCSVFile: function(filePath, data) {
        try {
            var file = new File(filePath);
            // Set UTF-8 encoding with proper line endings for Japanese text support
            // 日本語テキストをサポートするためにUTF-8エンコーディングと適切な改行設定
            file.encoding = "UTF-8";
            file.lineFeed = "unix";
            file.open("w");
            
            // Add UTF-8 BOM for Japanese compatibility with some spreadsheet programs
            // 一部の表計算プログラムでの日本語互換性のためにUTF-8 BOMを追加
            file.write("\uFEFF");
            
            // Write headers | ヘッダーを書き込む
            var headerLine = "";
            for (var i = 0; i < data.headers.length; i++) {
                if (i > 0) headerLine += ",";
                headerLine += this._escapeCSV(data.headers[i]);
            }
            file.writeln(headerLine);
            
            // Write rows | 行を書き込む
            for (var j = 0; j < data.rows.length; j++) {
                var rowLine = "";
                var row = data.rows[j];
                
                for (var k = 0; k < data.headers.length; k++) {
                    var header = data.headers[k];
                    if (k > 0) rowLine += ",";
                    
                    var cellValue = row[header] || "";
                    rowLine += this._escapeCSV(cellValue);
                }
                
                file.writeln(rowLine);
            }
            
            file.close();
            return true;
            
        } catch (error) {
            DebugLogManager.error(this._mngName + " Failed to write CSV file: " + error.toString() + " | CSVファイルの書き込みに失敗しました");
            return false;
        }
    },
    
    /**
     * Writes Excel-compatible CSV (with BOM and different escaping)
     * Excel互換CSV（BOMと異なるエスケープ）を書き込む
     * 
     * @param {String} filePath - Output Excel-compatible CSV path | 出力Excel互換CSVパス
     * @param {Object} data - Parsed data with headers and rows | ヘッダーと行を含む解析済みデータ
     * @returns {Boolean} Success status | 成功ステータス
     */
    _writeExcelCompatibleCSV: function(filePath, data) {
        try {
            var file = new File(filePath);
            // Configure file properly for Japanese Excel compatibility
            // 日本語Excelとの互換性のためにファイルを適切に設定
            file.encoding = "UTF-8";
            file.lineFeed = "windows"; // Excel for Windows expects CRLF
            file.open("w");
            
            // Write BOM for Excel | Excel用のBOMを書き込む
            file.write("\uFEFF");
            
            // For Japanese Excel, use tab as separator which works better with CJK characters
            // 日本語Excel用に、CJK文字でより適切に機能するタブ区切りを使用
            var separator = "\t";
            
            // Write headers | ヘッダーを書き込む
            var headerLine = "";
            for (var i = 0; i < data.headers.length; i++) {
                if (i > 0) headerLine += separator;
                headerLine += this._escapeExcelCSV(data.headers[i]);
            }
            file.writeln(headerLine);
            
            // Write rows | 行を書き込む
            for (var j = 0; j < data.rows.length; j++) {
                var rowLine = "";
                var row = data.rows[j];
                
                for (var k = 0; k < data.headers.length; k++) {
                    var header = data.headers[k];
                    if (k > 0) rowLine += separator;
                    
                    var cellValue = row[header] || "";
                    rowLine += this._escapeExcelCSV(cellValue);
                }
                
                file.writeln(rowLine);
            }
            
            file.close();
            return true;
            
        } catch (error) {
            DebugLogManager.error(this._mngName + " Failed to write Excel-compatible CSV: " + error.toString() + " | Excel互換CSVの書き込みに失敗しました");
            return false;
        }
    },
    
    /**
     * Escape a value for CSV format
     * CSV形式の値をエスケープする
     * 
     * @param {String} value - The value to escape | エスケープする値
     * @returns {String} Escaped value | エスケープされた値
     */
    _escapeCSV: function(value) {
        if (value === null || value === undefined) {
            return "";
        }
        
        value = String(value);
        
        // If value contains comma, newline or quote, enclose in quotes
        // 値にカンマ、改行、引用符が含まれる場合、引用符で囲む
        if (value.indexOf(",") !== -1 || value.indexOf("\n") !== -1 || 
            value.indexOf("\r") !== -1 || value.indexOf('"') !== -1) {
            
            // Double up quotes | 引用符を二重にする
            value = value.replace(/"/g, '""');
            
            // Enclose in quotes | 引用符で囲む
            value = '"' + value + '"';
        }
        
        return value;
    },
    
    /**
     * Escape a value for Excel-compatible CSV format
     * Excel互換CSV形式の値をエスケープする
     * 
     * @param {String} value - The value to escape | エスケープする値
     * @returns {String} Escaped value | エスケープされた値
     */
    _escapeExcelCSV: function(value) {
        if (value === null || value === undefined) {
            return "";
        }
        
        value = String(value);
        
        // If value contains semicolon, newline or quote, enclose in quotes
        // 値にセミコロン、改行、引用符が含まれる場合、引用符で囲む
        if (value.indexOf(";") !== -1 || value.indexOf("\n") !== -1 || 
            value.indexOf("\r") !== -1 || value.indexOf('"') !== -1) {
            
            // Excel uses doubled quotes to escape quotes | Excelは引用符をエスケープするために二重引用符を使用
            value = value.replace(/"/g, '""');
            
            // Enclose in quotes | 引用符で囲む
            value = '"' + value + '"';
        }
        
        return value;
    },
    
    /**
     * Generate a secondary simplified CSV focusing on shape-LED relationships
     * 形状-LED関係に焦点を当てた二次的な簡略化CSVを生成する
     * 
     * @param {String} logFilePath - Path to the original log file | 元のログファイルへのパス
     * @param {String} csvFilePath - Path where the simplified CSV should be saved | 簡略化されたCSVを保存するパス
     * @returns {Boolean} Success status | 成功ステータス
     */
    exportSimplifiedShapeData: function(logFilePath, csvFilePath) {
        try {
            DebugLogManager.info(this._mngName + " Exporting simplified shape data | 簡略化された形状データをエクスポートしています");
            
            // Read and parse the log file | ログファイルを読み込み解析
            var logData = this._readLogFile(logFilePath);
            if (!logData) {
                throw new Error("Failed to read log file | ログファイルの読み込みに失敗しました");
            }
            
            var lines = logData.split(/\r\n|\r|\n/);
            var shapes = [];
            var currentShape = null;
            
            // Parse shape-specific data | 形状固有のデータを解析
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                var trimmedLine = this._trimString(line);
                
                // Look for shape section markers | 形状セクションマーカーを探す
                if (trimmedLine.match(/^--- Shape \d+ ---$/)) {
                    // Start a new shape | 新しい形状を開始
                    if (currentShape !== null) {
                        shapes.push(currentShape);
                    }
                    currentShape = {
                        name: "",
                        width_pt: "",
                        width_mm: "",
                        width_cm: "",
                        height_pt: "",
                        height_mm: "",
                        height_cm: "",
                        area_ptsq: "",
                        area_mm2: "",
                        area_cm2: "",
                        ledCount: 0,
                        ledList: ""
                    };
                    continue;
                }
                
                // Skip if not in a shape section | 形状セクション内でなければスキップ
                if (currentShape === null) {
                    continue;
                }
                
                // Parse key-value pairs | キー値ペアを解析
                var colonIndex = line.indexOf(":");
                if (colonIndex > -1) {
                    var key = this._trimString(line.substring(0, colonIndex));
                    var value = this._trimString(line.substring(colonIndex + 1));
                    
                    // Match different properties with improved patterns
                    if (key.match(/Part_\d+/) && !key.match(/Part_\w+_\d+/)) {
                        currentShape.name = value;
                    } else if (key.match(/Part_width_\(pt\)_\d+/)) {
                        currentShape.width_pt = value;
                    } else if (key.match(/Part_width_\(mm\)_\d+/)) {
                        currentShape.width_mm = value;
                    } else if (key.match(/Part_width_\(cm\)_\d+/)) {
                        currentShape.width_cm = value;
                    } else if (key.match(/Part_height_\(pt\)_\d+/)) {
                        currentShape.height_pt = value;
                    } else if (key.match(/Part_height_\(mm\)_\d+/)) {
                        currentShape.height_mm = value;
                    } else if (key.match(/Part_height_\(cm\)_\d+/)) {
                        currentShape.height_cm = value;
                    } else if (key.match(/Part_area_\(ptsq\)_\d+/)) {
                        currentShape.area_ptsq = value;
                    } else if (key.match(/Part_area_\(mmsq\)_\d+/)) {
                        currentShape.area_mm2 = value;
                    } else if (key.match(/Part_area_\(cmsq\)_\d+/)) {
                        currentShape.area_cm2 = value;
                    } else if (key.match(/Part_led_count_\d+/)) {
                        currentShape.ledCount = parseInt(value) || 0;
                    } else if (key.match(/Part_led_list_\d+/)) {
                        currentShape.ledList = value;
                    }
                }
            }
            
            // Add the last shape if any | 最後の形状があれば追加
            if (currentShape !== null) {
                shapes.push(currentShape);
            }
            
            // Write to CSV | CSVに書き込み
            var file = new File(csvFilePath);
            file.encoding = "UTF-8";
            file.lineFeed = "unix";
            file.open("w");
            
            // Write BOM for Japanese compatibility | 日本語互換性のためにBOMを書き込み
            file.write("\uFEFF");
            
            // Write comprehensive headers including all units
            file.writeln("ShapeName(形状名)," +
                        "Width_pt(幅_pt),Width_mm(幅_mm),Width_cm(幅_cm)," +
                        "Height_pt(高さ_pt),Height_mm(高さ_mm),Height_cm(高さ_cm)," +
                        "Area_ptsq(面積_ptsq),Area_mm2(面積_mm2),Area_cm2(面積_cm2)," +
                        "LEDCount(LED数),AssociatedLEDs(関連LED)");
            
            // Write shape data | 形状データを書き込み
            for (var j = 0; j < shapes.length; j++) {
                var shape = shapes[j];
                var line = this._escapeCSV(shape.name) + "," +
                        this._escapeCSV(shape.width_pt) + "," +
                        this._escapeCSV(shape.width_mm) + "," +
                        this._escapeCSV(shape.width_cm) + "," +
                        this._escapeCSV(shape.height_pt) + "," +
                        this._escapeCSV(shape.height_mm) + "," +
                        this._escapeCSV(shape.height_cm) + "," +
                        this._escapeCSV(shape.area_ptsq) + "," +
                        this._escapeCSV(shape.area_mm2) + "," +
                        this._escapeCSV(shape.area_cm2) + "," +
                        this._escapeCSV(shape.ledCount) + "," +
                        this._escapeCSV(shape.ledList);
                file.writeln(line);
            }
            
            file.close();
            DebugLogManager.info(this._mngName + " Successfully exported simplified CSV to: " + csvFilePath + " | 簡略化されたCSVの出力に成功しました");
            return true;
            
        } catch (error) {
            DebugLogManager.error(this._mngName + " Failed to export simplified shape data: " + error.toString() + " | 簡略化された形状データのエクスポートに失敗しました");
            return false;
        }
    },

    /**
     * Function to integrate CSV export into the main workflow
     * CSVエクスポートをメインワークフローに統合する関数
     * 
     * @param {String} outputLogPath - Path to the output log file | 出力ログファイルへのパス
     * @returns {Boolean} Success status | 成功ステータス
     */
    exportCSVFiles: function (outputLogPath, addTimestamp) {
        try {
            DebugLogManager.info("[CSV EXPORT] Starting CSV export process | CSVエクスポート処理を開始します");
            
            // Verify log file path is valid
            if (!outputLogPath || outputLogPath.length === 0) {
                DebugLogManager.error("[CSV EXPORT] Invalid output log path | 無効な出力ログパス");
                return false;
            }
            
            // Verify log file exists
            var logFile = new File(outputLogPath);
            if (!logFile.exists) {
                DebugLogManager.error("[CSV EXPORT] Output log file not found: " + outputLogPath + " | 出力ログファイルが見つかりません");
                return false;
            }
            
            // Generate timestamp for filenames if requested
            var timestamp = "";
            if (addTimestamp) {
                var now = new Date();
                timestamp = "_" + 
                    now.getFullYear() + 
                    ("0" + (now.getMonth() + 1)).slice(-2) + 
                    ("0" + now.getDate()).slice(-2) + "_" +
                    ("0" + now.getHours()).slice(-2) + 
                    ("0" + now.getMinutes()).slice(-2);
            }
            
            // Determine CSV output paths
            var basePath = outputLogPath.replace(/_output_log\.txt$/i, '');
            var mainCSVPath = basePath + timestamp + "_data.csv";
            var simplifiedCSVPath = basePath + timestamp + "_shapes.csv";
            
            // Export main CSV
            var mainSuccess = CSVExportManager.exportLogToCSV(
                outputLogPath, 
                mainCSVPath,
                true // create Excel-compatible version
            );
            
            // Export simplified shape data
            var shapeSuccess = CSVExportManager.exportSimplifiedShapeData(
                outputLogPath,
                simplifiedCSVPath
            );

            var mergeSuccess = mergeCSVFilesInPlace(mainCSVPath, simplifiedCSVPath);
            
            DebugLogManager.info("[CSV EXPORT] Export complete. Main CSV: " +
                (mainSuccess ? "Success | 成功" : "Failed | 失敗") +
                ", Shape CSV: " +
                (shapeSuccess ? "Success | 成功" : "Failed | 失敗") +
                ", Merge: " +
                (mergeSuccess ? "Success | 成功" : "Failed | 失敗")); 
            
            return mainSuccess && shapeSuccess;
            
        } catch (error) {
            DebugLogManager.error("[CSV EXPORT] Export process failed: " + error.toString() + " | エクスポート処理に失敗しました");
            return false;
        }
    }

};



    
function mergeCSVFilesInPlace (fileAPath, fileBPath) {
    try {
        var fileA = new File(fileAPath);
        var fileB = new File(fileBPath);

        if (!fileA.exists || !fileB.exists) {
            alert("One or both CSV files not found.");
            return false;
        }

        fileA.open("r");
        var contentA = [];
        while (!fileA.eof) {
            contentA.push(fileA.readln());
        }
        fileA.close();

        fileB.open("r");
        var contentB = [];
        while (!fileB.eof) {
            contentB.push(fileB.readln());
        }
        fileB.close();

        if (contentA.length !== contentB.length) {
            alert("The CSV files have different row counts and cannot be merged correctly.");
            return false;
        }

        fileA.open("w");
        fileA.encoding = "UTF-8";
        fileA.lineFeed = "unix";
        fileA.write("\uFEFF"); // UTF-8 BOM for compatibility

        for (var i = 0; i < contentA.length; i++) {
            var rowA = contentA[i].split(",");
            var rowB = contentB[i].split(",");
            
            if (i === 0) {
                // Ensure headers from file B do not repeat column names
                for (var j = 0; j < rowB.length; j++) {
                    rowB[j] = "B_" + rowB[j];
                }
            }
            
            var mergedRow = rowA.concat(rowB);
            fileA.writeln(mergedRow.join(","));
        }
        
        fileA.close();
        alert("CSV merge completed successfully, modifying File A in place.");
        return true;

    } catch (error) {
        alert("Error merging CSV files: " + error.toString());
        return false;
    }
}

/*
// Use it like this:
var selectedOption = showTargetLayerSelectionDialog();
if (selectedOption) {
    alert("You selected: " + selectedOption);
}
*/
// Main Process
function main() {
    try {
        var funName = "[MAIN] ";
        DebugLogManager.info(funName + "Starting main processing...");

        // Get document and verify
        var doc = app.activeDocument;
        if (!doc) {
            throw new Error("No active document found");
        }
        DebugLogManager.info(funName + "Document found: " + doc.name);

        // Initialize managers in order
        PreferencesManager.init();
        LogManager.init();
        
        // Document info - with explicit path handling
        LogManager._data[LOG_KEYS.DOC_PATH] = doc.path ? doc.path.toString() : "";
        LogManager._data[LOG_KEYS.DOC_NAME] = doc.name;
        LogManager._data[LOG_KEYS.LAYER_COUNT] = doc.layers.length;
        DebugLogManager.info(funName + "Basic document info logged");

        // Initialize layers
        var targetLayerName = "支給データ";
        var targetChars = LayerManager.stringToCharCodes(targetLayerName);
        DebugLogManager.info(funName + "Target layer chars: " + targetChars);

        // Initialize processing and verify each component
        var initData = ProcessingManager.initialize(doc, targetChars);
        if (!initData) {
            throw new Error("ProcessingManager initialization failed");
        }

        DebugLogManager.info(funName + "Checking initialized layers...");
        if (!initData.partsLayer) {
            throw new Error("Parts layer not found");
        }
        if (!initData.ledLayer) {
            throw new Error("LED layer not found");
        }
        if (!initData.tempLayer) {
            throw new Error("Temp layer not found");
        }

        // Log target layer info
        LogManager._data[LOG_KEYS.TARGET_FOUND] = initData.partsLayer.name;
        DebugLogManager.info(funName + "Target layer found: " + initData.partsLayer.name);

        // Calculate and verify areas
        var area = LayerManager.getLayerArea(initData.partsLayer);
        DebugLogManager.info(funName + "Calculated area: " + area);
        
        LogManager._data[LOG_KEYS.AREA_POINTS] = area.toFixed(10);
        LogManager._data[LOG_KEYS.AREA_MM] = (area / 2.834645 / 2.834645).toFixed(2);
        LogManager._data[LOG_KEYS.AREA_CM] = (parseFloat(LogManager._data[LOG_KEYS.AREA_MM]) / 100).toFixed(2);

        // Calculate and verify heights
        var height = LayerManager.getMaxHeight(initData.partsLayer);
        DebugLogManager.info(funName + "Calculated max height: " + height);
        
        LogManager._data[LOG_KEYS.HEIGHT_POINTS] = height;
        LogManager._data[LOG_KEYS.HEIGHT_MM] = (height / 2.834645).toFixed(2);
        LogManager._data[LOG_KEYS.HEIGHT_CM] = (parseFloat(LogManager._data[LOG_KEYS.HEIGHT_MM]) / 100).toFixed(2);

        // Process parts and LEDs
        DebugLogManager.info(funName + "Processing parts and LEDs...");
        var results = ProcessingManager.executeProcessing(initData);
        if (!results) {
            throw new Error("Failed to process parts and LEDs");
        }
        LogManager._data.results = results;

        // Store shape measurements with verification
        LogManager._data.shapes = [];
        DebugLogManager.info(funName + "Processing shape measurements...");
        DebugLogManager.info(funName + "Number of sorted parts: " + (initData.sortedParts ? initData.sortedParts.length : 0));

        if (initData.sortedParts && initData.sortedParts.length > 0) {
            for (var i = 0; i < initData.sortedParts.length; i++) {
                var part = initData.sortedParts[i];
                var index = i + 1;
                
                // Get measurements
                var width = PathManager.getPathWidth(part);
                var height = PathManager.getPathHeight(part);
                var area = PathManager.getPathArea(part);
                /***************************************     */
                var finalLedList = results[part.name];
                var ledCount = finalLedList ? finalLedList.length : 0;

                // Get LED information including the list of LEDs
                var ledInfo = finalLedList || { ledCount: finalLedList.length, leds: finalLedList.toSource() };


                // Store in LogManager._data for the shape-specific keys
                // Format index with leading zeros (e.g., "001", "002", etc.)
                var paddedIndex = ("00000" + index).slice(-5);
                
                LogManager._data[LOG_KEYS.SHAPE_NAME_ROOT + paddedIndex] = part.name;
                LogManager._data[LOG_KEYS.SHAPE_WIDTH_PT + paddedIndex] = width.pt.toFixed(2);
                LogManager._data[LOG_KEYS.SHAPE_WIDTH_MM + paddedIndex] = width.mm.toFixed(2);
                LogManager._data[LOG_KEYS.SHAPE_WIDTH_CM + paddedIndex] = width.cm.toFixed(2);
                LogManager._data[LOG_KEYS.SHAPE_HEIGHT_PT + paddedIndex] = height.pt.toFixed(2);
                LogManager._data[LOG_KEYS.SHAPE_HEIGHT_MM + paddedIndex] = height.mm.toFixed(2);
                LogManager._data[LOG_KEYS.SHAPE_HEIGHT_CM + paddedIndex] = height.cm.toFixed(2);
                LogManager._data[LOG_KEYS.SHAPE_AREA_PTSQ + paddedIndex] = area.pt.toFixed(2);
                LogManager._data[LOG_KEYS.SHAPE_AREA_MMSQ + paddedIndex] = area.mm.toFixed(2);
                LogManager._data[LOG_KEYS.SHAPE_AREA_CMSQ + paddedIndex] = area.cm.toFixed(2);
                LogManager._data[LOG_KEYS.SHAPE_LED_COUNT + paddedIndex] = ledCount;

                // Also store in shapes array for easy access
                var shapeData = {
                    name: part.name,
                    width: width,
                    height: height,
                    area: area,
                    ledCount: ledCount,
                    ledList: finalLedList.toSource()
                };
                
                LogManager._data.shapes.push(shapeData);
                DebugLogManager.info(funName + "Added shape data for: " + part.name +
                    " Area (mm²): " + area.mm.toFixed(2));
            }
        } else {
            DebugLogManager.error(funName + "No sorted parts found to process");
        }

        // Set export path
        var exportPath = doc.path + "/" + doc.name.replace(/\.ai$/i, '') + "_output_log.txt";
        LogManager._data[LOG_KEYS.EXPORT_PATH] = exportPath;
        DebugLogManager.info(funName + "Set export path: " + exportPath);

        var successfulExport = CSVExportManager.runExport();

        // Write output file
        var success = LogManager.writeToFile();
        if (!success) {
            throw new Error("Failed to write output log");
        }

        DebugLogManager.info(funName + "Processing completed successfully");
        return true;

    } catch (e) {
        DebugLogManager.error(funName + "Error in execution: " + e.toString());
        LogManager.writeToFile(null, "Error during processing: " + e.toString());
        return false;
    } finally {
        // Clean up temp layer if it exists
        if (initData && initData.tempLayer) {
            ProcessingManager.finalizeProcessing(initData.tempLayer);
        }
    }
}


// Execute
main();