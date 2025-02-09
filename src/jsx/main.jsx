#target illustrator

// Debug Log Manager
// Base logging setup - your original functions
var logFile = null; // Global log file variable for logging

/**
 * Initializes the log file in the Desktop/extendscript-logs directory.
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
        logFile.writeln(new Date() + " - " + message);
        logFile.close();
    } catch (error) {
        alert("Error writing to log: " + error.message);
    }
}

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

/*
// Example usage in code:
try {
    DebugLogManager.info("Starting process");
    // ... code ...
    DebugLogManager.debug("Technical detail:", someObject);
} catch(e) {
    DebugLogManager.error("Process failed:", e);
}
*/

// Constants
var LOG_KEYS = {
    DOC_PATH: 'Document path',
    DOC_NAME: 'Document name',
    EXPORT_PATH: 'Export path',
    LAYER_COUNT: 'Number of layers',
    LAYER_NAME: 'Processing layer',
    LAYER_CHARS: 'Layer chars',
    TARGET_FOUND: 'Found target layer',
    AREA_POINTS: 'Area',
    AREA_MM: 'Area (mmsq)',
    AREA_CM: 'Area (cmsq)',
    HEIGHT_POINTS: 'Max Height (points)',
    HEIGHT_MM: 'Max Height (mm)',
    LED_COUNT: 'LED Group Count',
    
/****
 *  The following LOG_KEYS are just the roots and need
 * to be complemented with an ordinal number.  So, each shape
 * found should have a corresponding key for each of the 
 * with the ordinal value.
 * Example:  If an Illustrator file had two shapes, it should
 * have something like this:
 * target_name_1: shape_1
 * target_path_1: path/shape_1
 * target_height_(points)_1: Number
 * etc...
 *  * target_name_2: shape_2
 * target_path_2: path/shape_2
 * target_height_2: Number
 * etc...
*/
    SHAPE_NAME_ROOT: 'target_name_',
    SHAPE_PATH: 'target_path_',
    SHAPE_HEIGHT_PT: 'target_height_(points)_',
    SHAPE_HEIGHT_MM: 'target_height_(mm)_',
    SHAPE_HEIGHT_CM: 'target_height_(cm)_',
    SHAPE_WIDTH_PT: 'target_width_(points)_',
    SHAPE_WIDTH_MM: 'target_width_(mm)_',
    SHAPE_WIDTH_CM: 'target_width_(cm)_',
    SHAPE_AREA_PTSQ: 'target_area_(pointssq)_',
    SHAPE_AREA_MMSQ: 'target_area_(mmsq)_',
    SHAPE_AREA_CMSQ: 'target_area_(cmsq)_',
    SHAPE_LED_COUNT: 'target_leds_',
    SHAPE_LED_CONFIDENCE: 'target_leds_conf_',
    SHAPE_PNG_PATH: 'target_png_path_',
    SHAPE_POS_PNG_PATH: 'target_pos_png_path_',
    SHAPE_LEDS_PNG_PATH: 'target_leds_png_path_',
    SHAPE_B64_PATH: 'target_b64_path_',
    SHAPE_POS_B64_PATH: 'target_pos_b64_path_',
    SHAPE_LEDS_B64_PATH: 'target_leds_b64_path_'

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
        if (app.preferences) {
            app.preferences.setIntegerPreference('ShowLegacyTextDialog', 0);
            app.preferences.setBooleanPreference('ShowLegacyTextDialog', false);
            app.preferences.setIntegerPreference('AutoUpdateLegacyText', 1);
            app.preferences.setBooleanPreference('AutoUpdateLegacyText', true);
        } else {
            DebugLogManager.error("app.preferences is not available");
        }

        if (app.textPreferences) {
            app.textPreferences.showLegacyTextWarning = false;
            app.textPreferences.updateLegacyText = true;
            DebugLogManager.info("Text preferences set successfully");
        } else {
            DebugLogManager.error("app.textPreferences is not available");
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

// Document Manager
var DocumentManager = {
    getActiveDocument: function () {
        DebugLogManager.info("DocumentManager.getActiveDocument...");
        if (app.documents.length === 0) return null;
        return app.activeDocument;
    },
    
    handleLegacyText: function() {
        DebugLogManager.info("DocumentManager.handleLegacyText...");
        try {
            var idupdate = charIDToTypeID('Updt');
            var desc = new ActionDescriptor();
            var idnull = charIDToTypeID('null');
            desc.putPath(idnull, new File(app.activeDocument.fullName));
            executeAction(idupdate, desc, DialogModes.NO);
            return true;
        } catch(e) {
            // Log directly without using other logging functions
            DebugLogManager.error("Legacy text handling failed:", e.toString());
            return false;
        }
    }
};

// Layer Manager
var LayerManager = {
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
        DebugLogManager.info("LayerManager.compareCharArrays: arr1 = " + arr1 + ", arr2 = " + arr2);
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
                    totalArea += PathManager.getPathArea(layer.pageItems[i]);
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
    }
};

// Path Manager
var PathManager = {
    getPathArea: function(item) {
        DebugLogManager.info("PathManager.getPathArea: item = " + item); 
        try {
            if (!item) return 0;
            
            switch (item.typename) {
                case 'PathItem':
                    return Math.abs(item.area);
                case 'CompoundPathItem':
                    return this.getCompoundPathArea(item);
                case 'GroupItem':
                    return this.getGroupArea(item);
                default:
                    return this.getBoundingBoxArea(item);
            }
        } catch(e) {
            DebugLogManager.error("Error calculating path area:", e.toString());
            return 0;
        }
    },
    
    getCompoundPathArea: function(item) {
        DebugLogManager.info("PathManager.getCompoundPathArea: item = " + item);
        var total = 0;
        for (var i = 0; i < item.pathItems.length; i++) {
            total += Math.abs(item.pathItems[i].area);
        }
        return total;
    },
    
    getGroupArea: function(item) {
        DebugLogManager.info("PathManager.getGroupArea: item = " + item);
        var total = 0;
        for (var i = 0; i < item.pageItems.length; i++) {
            total += this.getPathArea(item.pageItems[i]);
        }
        return total;
    },
    
    getBoundingBoxArea: function(item) {
        DebugLogManager.info("PathManager.getBoundingBoxArea: item = " + item);
        var bounds = item.geometricBounds;
        return Math.abs((bounds[2] - bounds[0]) * (bounds[1] - bounds[3]));
    }
};

// Log Manager
var LogManager = {
    _data: {},
    _layerData: [],
    
    init: function() {
        DebugLogManager.info("LogManager.init:... ");
        this._data = {};
        this._layerData = [];
    },
    
    logDocumentInfo: function(doc) {
        DebugLogManager.info("LogManager.logDocumentInfo: doc = " + doc);
        this._data[LOG_KEYS.DOC_PATH] = doc.path;
        this._data[LOG_KEYS.DOC_NAME] = doc.name.replace(/\.ai$/i, '');
        this._data[LOG_KEYS.LAYER_COUNT] = doc.layers.length;
    },
    
    logLayerInfo: function(layer) {
        DebugLogManager.info("LogManager.logLayerInfo: layer = " + layer);
        var layerInfo = {};
        layerInfo[LOG_KEYS.LAYER_NAME] = layer.name;
        
        var chars = [];
        for (var i = 0; i < layer.name.length; i++) {
            chars.push(layer.name.charCodeAt(i));
        }
        layerInfo[LOG_KEYS.LAYER_CHARS] = chars.join(',');
        
        this._layerData.push(layerInfo);
    },
    
    logTargetLayerInfo: function(layer) {
        DebugLogManager.info("LogManager.logTargetLayerInfo: layer = " + layer);
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
        
        this._data[LOG_KEYS.HEIGHT_POINTS] = height;
        this._data[LOG_KEYS.HEIGHT_MM] = heightMM;
        
        // LED count if available
        var ledCount = LayerManager.countLEDGroups(layer);
        if (ledCount > 0) {
            this._data[LOG_KEYS.LED_COUNT] = ledCount;
        }
    },
    
    setExportPath: function(path) {
        DebugLogManager.info("LogManager.setExportPath: path = " + path);
        this._data[LOG_KEYS.EXPORT_PATH] = path;
    },
    
    generateOutput: function() {
        DebugLogManager.info("LogManager.generateOutput:... ");
        var output = '';
        
        // Document level information
        output += LOG_KEYS.DOC_PATH + ': ' + this._data[LOG_KEYS.DOC_PATH] + '\n';
        output += LOG_KEYS.DOC_NAME + ': ' + this._data[LOG_KEYS.DOC_NAME] + '\n';
        output += LOG_KEYS.EXPORT_PATH + ': ' + this._data[LOG_KEYS.EXPORT_PATH] + '\n';
        output += LOG_KEYS.LAYER_COUNT + ': ' + this._data[LOG_KEYS.LAYER_COUNT] + '\n';
        
        // Layer information - replace forEach with for loop
        for (var i = 0; i < this._layerData.length; i++) {
            var layerInfo = this._layerData[i];
            output += LOG_KEYS.LAYER_NAME + ': ' + layerInfo[LOG_KEYS.LAYER_NAME] + '\n';
            output += LOG_KEYS.LAYER_CHARS + ': ' + layerInfo[LOG_KEYS.LAYER_CHARS] + '\n';
        }
        
        // Target layer information if found
        if (this._data[LOG_KEYS.TARGET_FOUND]) {
            output += LOG_KEYS.TARGET_FOUND + ': ' + this._data[LOG_KEYS.TARGET_FOUND] + '\\n';
            output += LOG_KEYS.AREA_POINTS + ': ' + this._data[LOG_KEYS.AREA_POINTS] + ' square points\\n';
            output += LOG_KEYS.AREA_MM + ': ' + this._data[LOG_KEYS.AREA_MM] + '\\n';
            output += LOG_KEYS.AREA_CM + ': ' + this._data[LOG_KEYS.AREA_CM] + '\\n';
            output += LOG_KEYS.HEIGHT_POINTS + ': ' + this._data[LOG_KEYS.HEIGHT_POINTS] + '\\n';
            output += LOG_KEYS.HEIGHT_MM + ': ' + this._data[LOG_KEYS.HEIGHT_MM] + '\\n';
            
            if (this._data[LOG_KEYS.LED_COUNT]) {
                output += LOG_KEYS.LED_COUNT + ': ' + this._data[LOG_KEYS.LED_COUNT] + '\\n';
            }
        }
        
        return output;
    },
    
    writeToFile: function(filePath) {
        DebugLogManager.info("LogManager.writeToFile: filePath = " + filePath);
        try {
            var file = new File(filePath);
            file.encoding = 'UTF-8';
            if (file.open('w')) {
                file.write(this.generateOutput());
                file.close();
                return true;
            }
            return false;
        } catch(e) {
            $.writeln('Error writing log file: ' + e);
            return false;
        }
    }
};

// Export Manager
var ExportManager = {
    exportLayerToPNG: function(layer, exportPath) {
        DebugLogManager.info("ExportManager.exportLayerToPNG: layer = " + layer + ". exportPath" + exportPath);
        if (!layer || !exportPath) return false;
        
        var doc = app.activeDocument;
        var originalState = this.saveDocumentState(doc);
        
        try {
            this.prepareLayerForExport(doc, layer);
            this.executeExport(doc, layer, exportPath);
            return true;
        } catch(e) {
            DebugLogManager.error("Error exporting PNG:", e.toString());
            return false;
        } finally {
            this.restoreDocumentState(doc, originalState);
        }
    },
    
    saveDocumentState: function(doc) {
        DebugLogManager.info("ExportManager.saveDocumentState: doc = " + doc);
        return {
            activeArtboard: doc.artboards[doc.artboards.getActiveArtboardIndex()],
            artboardRect: doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect,
            layerVisibility: doc.layers.map(function(layer) { return layer.visible; })
        };
    },
    
    prepareLayerForExport: function(doc, targetLayer) {
        DebugLogManager.info("ExportManager.prepareLayerForExport: doc = " + doc + ". targetLayer = " + targetLayer);
        // Hide all layers except target
        doc.layers.forEach(function(layer) { layer.visible = false; });
        targetLayer.visible = true;
        
        // Set artboard to layer bounds
        if (targetLayer.pageItems.length > 0) {
            var bounds = this.calculateLayerBounds(targetLayer);
            doc.artboards[doc.artboards.getActiveArtboardIndex()].artboardRect = bounds;
        }
    },
    
    calculateLayerBounds: function(layer) {
        DebugLogManager.info("ExportManager.calculateLayerBounds: layer = " + layer);
        // Implementation similar to existing bounds calculation
        var bounds = layer.pageItems[0].visibleBounds;
        // ... bounds calculation ...
        return bounds;
    },
    
    executeExport: function(doc, layer, exportPath) {
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
    
    restoreDocumentState: function(doc, state) {
        DebugLogManager.info("ExportManager.executeExport: doc = " + doc + " state = " + state);
        state.activeArtboard.artboardRect = state.artboardRect;
        doc.layers.forEach(function(layer, i) {
            layer.visible = state.layerVisibility[i];
        });
    }
};

// Layer Manager methods update
LayerManager.getMaxHeight = function(layer) {
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
    } catch(e) {
        $.writeln('Error calculating max height: ' + e);
        return 0;
    }
};

LayerManager.countLEDGroups = function(layer) {
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
    } catch(e) {
        $.writeln('Error counting LED groups: ' + e);
        return 0;
    }
};

// Main Process
function main() {
    DebugLogManager.info("Starting main processing...");
    LogManager.init();
    try {
        PreferencesManager.init();
        
        var doc = DocumentManager.getActiveDocument();
        if (!doc) {
            LogManager.writeToFile(doc.path + '/error_log.txt');
            $.writeln('No documents open');
            return false;
        }
        
        DocumentManager.handleLegacyText();
        
        // Log document information
        LogManager.logDocumentInfo(doc);
        
        // Log information for each layer
        for (var i = 0; i < doc.layers.length; i++) {
            LogManager.logLayerInfo(doc.layers[i]);
        }
        
        var targetLayer = LayerManager.findLayerByChars(doc, CONSTANTS.DEFAULT_TARGET_CHARS);
        if (!targetLayer) {
            $.writeln('Target layer not found');
            return false;
        }
        
        var exportPath = doc.path + '/' + doc.name.replace(/\.ai$/i, '') + '_' + targetLayer.name + '.png';
        LogManager.setExportPath(exportPath);
        LogManager.logTargetLayerInfo(targetLayer);
        
        // Write log file
        var logPath = doc.path + '/' + doc.name.replace(/\.ai$/i, '') + '_debug.txt';
        LogManager.writeToFile(logPath);
        return ExportManager.exportLayerToPNG(targetLayer, exportPath);
        
    } catch(e) {
        DebugLogManager.error('Error in main execution: ' + e);
        return false;
    }
}

// Execute
main();