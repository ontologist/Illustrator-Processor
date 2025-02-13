#target illustrator

/**
 * Checks if two bounding boxes overlap.
 */
function isBoundingBoxOverlapping(box1, box2) {
    return !(
        box1.x + box1.width < box2.x ||  
        box2.x + box2.width < box1.x ||  
        box1.y - box1.height > box2.y || 
        box2.y - box2.height > box1.y    
    );
}

/**
 * Checks if a given Part (PathItem or CompoundPathItem) is not closed.
 * @param {object} part - The PathItem or CompoundPathItem.
 * @returns {boolean} - Returns `true` if the part is NOT closed, otherwise `false`.
 */
function isPartNotClosed(part) {
    if (part.typename === "PathItem") {
        return !part.closed; // **PathItem has a "closed" property**
    } else if (part.typename === "CompoundPathItem") {
        for (var i = 0; i < part.pathItems.length; i++) {
            if (!part.pathItems[i].closed) {
                return true; // **If any sub-path is open, return true**
            }
        }
    }
    return false; // **All paths are closed**
}


/**
 * Sorts items by columns from left to right, with top-to-bottom sorting within each column
 * @param {Array} items - Array of Illustrator items to sort
 * @param {Number} xTolerance - Optional X-position tolerance for column grouping (default: 10)
 * @return {Array} Sorted array of items
 */
function sortByPosition(items, xTolerance) {
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


/**
 * Identifies, sorts, renames, and properly reorders items in the layer stack.
 */
function identifyAndSortItems(layer) {
    var allItems = []; // Temporary storage for sorting

    // **Store all page items for sorting first**
    for (var i = 0; i < layer.pageItems.length; i++) {
        allItems.push(layer.pageItems[i]);
    }

    // **Sort all items by position before categorizing them**
    allItems = sortByPosition(allItems);

    // **Now categorize, rename, and reorder in the layer**
    var myParts = [];
    var myLeds = [];
    var partCount = 0;
    var ledCount = 0;

    // **Loop FORWARD (0 to length) to ensure top-to-bottom stacking**
    for (var i = 0; i < allItems.length; i++) {
        var item = allItems[i];

        if (item.typename === "PathItem" || item.typename === "CompoundPathItem") {
            item.name = "Part_" + partCount++; // **Ensure numbering follows sorted order**
            myParts.push(item);
        } else if (item.typename === "GroupItem") {
            item.name = "LED_" + ledCount++;
            myLeds.push(item);
        }

        // **Move the item to reflect the sorted order in the stack**
        // **Using PLACEATBEGINNING ensures top items are stacked first**
        item.move(layer, ElementPlacement.PLACEATEND);
    }

    return { parts: myParts, leds: myLeds }; // **Updated return object**
}


/**
 * Extracts the bounding box of a page item.
 */
function getBoundingBox(item) {
    return {
        x: item.left,
        y: item.top,
        width: item.width,
        height: item.height
    };
}

/**
 * Finds candidate LEDs using bounding boxes.
 */
function findCandidateLEDs(myPaths, myLEDs) {
    var partsToLEDs = {};

    for (var j = 0; j < myPaths.length; j++) {
        var path = myPaths[j];
        var pathName = path.name;

        for (var i = 0; i < myLEDs.length; i++) {
            var led = myLEDs[i];
            var ledName = led.name;

            if (isBoundingBoxOverlapping(getBoundingBox(led), getBoundingBox(path))) {
                if (!partsToLEDs[pathName]) {
                    partsToLEDs[pathName] = [];
                }
                partsToLEDs[pathName].push(ledName);
            }
        }
    }

    return partsToLEDs;
}

/**
 * Main function to find and refine overlapping LEDs.
 */
function refineLEDOverlap() {
    var doc = app.activeDocument;
    var layer = null;
    var myParts = [];
    var myLeds = [];

    // Locate the target layer
    for (var i = 0; i < doc.layers.length; i++) {
        if (doc.layers[i].name === "Temp_Union_Layer") {
            layer = doc.layers[i];
            break;
        }
    }

    if (!layer) {
        //alert("Layer 'Temp_Union_Layer' not found.");
        saveDebugOutputToFile("Layer 'Temp_Union_Layer' not found.");
        return;
    }

    var sortedItems = identifyAndSortItems(layer);
    var myParts = sortedItems.parts;
    var myLeds = sortedItems.leds;

    if (myParts.length === 0 || myLeds.length === 0) {
        //alert("No valid path items or group items found in the layer.");
        saveDebugOutputToFile("No valid path items or group items found in the layer.");
        return;
    }


    // **Step 1: Run Bounding Box Filtering**
    var partsToLEDs = findCandidateLEDs(myParts, myLeds);

    // **Step 1.5: Save LED Vertices to a File for Debugging**
    var ledVerticesMessage = "Debugging: LED Vertices Extracted\n";
    for (var i = 0; i < myLeds.length; i++) {
        var led = myLeds[i];
        var ledVertices = getLEDVertices(led);
        ledVerticesMessage += led.name + ":\n";

        if (ledVertices.length === 0) {
            ledVerticesMessage += "  No vertices extracted.\n";
        } else {
            for (var j = 0; j < ledVertices.length; j++) {
                ledVerticesMessage += "  (" + ledVertices[j][0] + ", " + ledVertices[j][1] + ")\n";
            }
        }
    }

    // **Save LED Vertex Data to a File**
    saveDebugOutputToFile(ledVerticesMessage);


    // **Output Bounding Box Filtering Results**
    var boundingBoxMessage = "======Bounding Box Filtering Results:=======\n\n\n";
    var boundingBoxFound = false;

    for (var key in partsToLEDs) {
        if (partsToLEDs.hasOwnProperty(key)) {
            boundingBoxMessage += "- " + key + " overlaps with: " + partsToLEDs[key].join(", ") + "\n";
            boundingBoxFound = true;
        }
    }

    if (!boundingBoxFound) {
        boundingBoxMessage += "No LEDs were found overlapping any parts.\n\n";
    }

    var debugLogMsg = "====== Debug Logs for LED to Parts Assignment ======\n\n";

    // **Proceed to Refinement Phase**
    var refinedPartsToLEDs = refineOverlapWithGeometry(partsToLEDs, myParts, myLeds);

    // **Output Refined Overlap Results**
    var refinedMessage = "====== Refined Overlap Results:======\n\n";
    var refinedFound = false;

    for (var key in refinedPartsToLEDs) {
        if (refinedPartsToLEDs.hasOwnProperty(key)) {
            refinedMessage += "- " + key + " overlaps precisely with: " + refinedPartsToLEDs[key].join(", ") + "\n";
            refinedFound = true;
        }
    }

    if (!refinedFound) {
        refinedMessage += "\n\nNo refined overlaps detected. LEDs may not be inside any parts.\n\n";
    }

    // **Step 3: Identify Unassigned and Duplicate LEDs**
    var assignedLEDs = {}; // Tracks which LEDs were assigned
    var unassignedLEDs = []; // Stores LEDs not assigned to any part
    var duplicateLEDs = []; // Stores LEDs assigned to multiple parts

    // **Check how many times each LED was assigned**
    for (var part in refinedPartsToLEDs) {
        if (refinedPartsToLEDs.hasOwnProperty(part)) {
            for (var i = 0; i < refinedPartsToLEDs[part].length; i++) {
                var ledName = refinedPartsToLEDs[part][i].split(" ")[0]; // Extract LED name

                if (!assignedLEDs[ledName]) {
                    assignedLEDs[ledName] = 1;
                } else {
                    assignedLEDs[ledName]++;
                }
            }
        }
    }
    

    // **Identify LEDs that were assigned more than once**
    for (var led in assignedLEDs) {
        if (assignedLEDs[led] > 1) {
            duplicateLEDs.push(led);
        }
    }

    // **Identify LEDs that were not assigned at all**
    for (var i = 0; i < myLeds.length; i++) {
        var ledName = myLeds[i].name;
        if (!assignedLEDs[ledName]) {
            unassignedLEDs.push(ledName);
        }
    }

    // **Generate Report for Debug Log**
    var ledReport = "\n\nLED Assignment Report:\n\n";
    ledReport += "---------------------------------\n";
    ledReport += "Total LEDs: " + myLeds.length + "\n";
    ledReport += "Total unassigned LEDs: " + unassignedLEDs.length + "\n";
    ledReport += "Unassigned LEDs: " + (unassignedLEDs.length > 0 ? unassignedLEDs.join(", ") : "None") + "\n";
    ledReport += "Total Duplicate Assigned LEDs: " + duplicateLEDs.length + "\n";
    ledReport += "Duplicate Assigned LEDs: " + (duplicateLEDs.length > 0 ? duplicateLEDs.join(", ") : "None") + "\n";

    // **Step 4: Identify Open Parts (Paths & CompoundPaths)**
    var openParts = []; // Stores names of parts that are not closed

    // **Check each part for openness**
    for (var i = 0; i < myParts.length; i++) {
        if (isPartNotClosed(myParts[i])) {
            openParts.push(myParts[i].name);
        }
    }

    // **Generate Open Parts Report for Debug Log**
    var openPartsReport = "\n\nOpen Parts Report:\n\n";
    openPartsReport += "---------------------------------\n";
    openPartsReport += "Total Parts: " + myParts.length + "\n";
    openPartsReport += "Open Parts (Not Closed): " + (openParts.length > 0 ? openParts.join(", ") : "None") + "\n";

    // **Step 5: Fallback - Reassign Orphaned LEDs Based on Bounding Box Filtering**
    var reassignedLEDs = []; // Stores reassigned LEDs and their new parts

    // **Check if any unassigned LED was originally assigned in the bounding box phase**
    for (var part in partsToLEDs) {
        if (partsToLEDs.hasOwnProperty(part)) {
            for (var i = 0; i < partsToLEDs[part].length; i++) {
                var ledName = partsToLEDs[part][i];

                var isOrphaned = false;
                for (var j = 0; j < unassignedLEDs.length; j++) {
                    if (unassignedLEDs[j] === ledName) {
                        isOrphaned = true;
                        unassignedLEDs.splice(j, 1); // Remove from unassigned list
                        break;
                    }
                }

                // **If the LED was previously assigned but is now orphaned, reassign it**
                if (isOrphaned) {
                    if (!refinedPartsToLEDs[part]) {
                        refinedPartsToLEDs[part] = [];
                    }
                    refinedPartsToLEDs[part].push(ledName + " (Fallback Reassignment)");
                    reassignedLEDs.push(ledName + " -> " + part); // Store LED and assigned part
                }
            }
        }
    }

    // **Generate Fallback Assignment Report**
    var fallbackReport = "\nFallback LED Reassignment Report:\n";
    fallbackReport += "---------------------------------\n\n";
    fallbackReport += "Reassigned LEDs (Originally Assigned in Bounding Box):\n";
    fallbackReport += "Total reassigned LEDs: " + reassignedLEDs.length + "\n";
    fallbackReport += (reassignedLEDs.length > 0 ? reassignedLEDs.join("\n") : "None") + "\n";
    fallBackReport += "Total failed LED reassignments: " + unassignedLEDs.length + "\n\n";

    /**** Combine the logs into one ****/

    debugLogMsg += boundingBoxMessage + refinedMessage + ledReport + openPartsReport + fallbackReport;
    saveDebugOutputToFile(debugLogMsg);
}

refineLEDOverlap();

/**
 * Extracts polygon vertices from a PathItem or CompoundPathItem.
 */
function getPathVertices(pathItem) {
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
}

/**
 * Extracts the actual path vertices from a GroupItem (LED).
 */
/**
 * Extracts all path vertices from a GroupItem (LED).
 * This ensures it works even if the LED contains nested GroupItems.
 */
function getLEDVertices(led) {
    var vertices = [];

    function extractVertices(item) {
        if (item.typename === "PathItem") {
            for (var j = 0; j < item.pathPoints.length; j++) {
                vertices.push([item.pathPoints[j].anchor[0], item.pathPoints[j].anchor[1]]);
            }
        } else if (item.typename === "GroupItem") {
            for (var k = 0; k < item.pageItems.length; k++) {
                extractVertices(item.pageItems[k]); // Recursively check nested items
            }
        }
    }

    extractVertices(led);

    return vertices;
}


/**
 * Checks if a point is inside a polygon.
 */
function isPointInPolygon(point, vertices) {
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
}

/**
 * Refines the overlap by checking actual LED vertices inside the part.
 */
function refineOverlapWithGeometry(partsToLEDs, myPaths, myRects) {
    var refinedPartsToLEDs = {};

    for (var partName in partsToLEDs) {
        if (partsToLEDs.hasOwnProperty(partName)) {
            var path = null;
            for (var i = 0; i < myPaths.length; i++) {
                if (myPaths[i].name === partName) {
                    path = myPaths[i];
                    break;
                }
            }

            if (!path) {
                $.writeln("Warning: Path not found for " + partName);
                continue;
            }

            var pathVertices = getPathVertices(path);
            refinedPartsToLEDs[partName] = [];

            for (var i = 0; i < partsToLEDs[partName].length; i++) {
                var ledName = partsToLEDs[partName][i];

                var rect = null;
                for (var j = 0; j < myRects.length; j++) {
                    if (myRects[j].name === ledName) {
                        rect = myRects[j];
                        break;
                    }
                }

                if (!rect) {
                    $.writeln("Warning: LED not found for " + ledName);
                    continue;
                }

                var ledVertices = getLEDVertices(rect);
                var insideCount = 0;

                for (var k = 0; k < ledVertices.length; k++) {
                    if (isPointInPolygon(ledVertices[k], pathVertices)) {
                        insideCount++;
                    }
                }

                var insidenessPercentage = (ledVertices.length > 0) ? (insideCount / ledVertices.length) * 100 : 0;
                if (insideCount > 0) {
                    refinedPartsToLEDs[partName].push(ledName + " (" + insidenessPercentage.toFixed(2) + "% inside)");
                }
            }
        }
    }

    return refinedPartsToLEDs;
}

/**
 * Saves debug output to a timestamped log file on the Desktop.
 * Appends new data with timestamps instead of overwriting.
 * @param {string} data - The content to write to the file.
 */
function saveDebugOutputToFile(data) {
    // **Get Current Timestamp**
    var now = new Date();
    var timestamp = now.getFullYear() + "-" + 
                    ("0" + (now.getMonth() + 1)).slice(-2) + "-" + 
                    ("0" + now.getDate()).slice(-2) + "_" + 
                    ("0" + now.getHours()).slice(-2) + "-" + 
                    ("0" + now.getMinutes()).slice(-2) + "-" + 
                    ("0" + now.getSeconds()).slice(-2);

    // **Generate Log Filename with Timestamp**
    var filename = "debug_log_" + timestamp + ".log";
    var file = new File("~/Desktop/" + filename); // Saves to Desktop

    file.open("a"); // "a" mode = append to existing file (creates if not exist)

    // **Append Timestamp to Each Line**
    var logTimestamp = "[" + now.getFullYear() + "-" + 
                        ("0" + (now.getMonth() + 1)).slice(-2) + "-" + 
                        ("0" + now.getDate()).slice(-2) + " " + 
                        ("0" + now.getHours()).slice(-2) + ":" + 
                        ("0" + now.getMinutes()).slice(-2) + ":" + 
                        ("0" + now.getSeconds()).slice(-2) + "] ";

    var lines = data.split("\n");
    for (var i = 0; i < lines.length; i++) {
        file.writeln(logTimestamp + lines[i]);
    }

    file.close();
}



/**
 * Checks if a given PathItem or CompoundPathItem is not a closed polygon.
 *
 * @param {object} pathItem - The PathItem or CompoundPathItem.
 * @returns {boolean} - Returns `true` if the path is NOT closed, otherwise `false`.
 */
function isPathNotClosed(pathItem) {
    if (pathItem.typename === "PathItem") {
        // **Check if single path is not closed**
        return !pathItem.closed;
    } else if (pathItem.typename === "CompoundPathItem") {
        // **Check all sub-paths inside a compound path**
        for (var i = 0; i < pathItem.pathItems.length; i++) {
            if (!pathItem.pathItems[i].closed) {
                return true; // If any sub-path is open, return true
            }
        }
    }
    return false; // All paths are closed
}


