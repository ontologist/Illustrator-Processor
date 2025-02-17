/**
 * @name LED Analysis Core Library
 * LED解析コアライブラリ
 * 
 * @description
 * ExtendScript-compatible library for LED and Part analysis with spatial optimizations
 * 空間最適化を備えたLEDとパーツの解析用ExtendScript互換ライブラリ
 * 
 * @version 1.2.0
 * @date 2024-02-17
 */

var LEDAnalysisLib = function () {
    // Constants / 定数
    var CONSTANTS = {
        GRID_TYPES: {
            RECTANGULAR: "rectangular",
            RADIAL: "radial"
        },
        SORT_DIRECTIONS: {
            TOP_TO_BOTTOM: "ttb",
            LEFT_TO_RIGHT: "ltr"
        },
        CELL_SIZES: {
            SMALL: 50,
            MEDIUM: 100,
            LARGE: 200
        }
    };

    // Default configuration / デフォルト設定
    var DEFAULT_CONFIG = {
        validation: {
            enabled: true,
            strictMode: false,
            minVertices: 3,
            maxVertices: 1000,
            requireClosedPaths: true
        },
        grid: {
            type: CONSTANTS.GRID_TYPES.RECTANGULAR,
            cellSize: CONSTANTS.CELL_SIZES.MEDIUM,
            sortDirection: CONSTANTS.SORT_DIRECTIONS.TOP_TO_BOTTOM
        },
        overlap: {
            threshold: 0.8,
            useFallback: true
        }
    };

    // Validation module / 検証モジュール
    var validator = {
        /**
         * Validates a part item
         * パーツアイテムを検証
         */
        validatePart: function (part, config) {
            var result = {
                isValid: true,
                messages: []
            };

            // Type check / タイプチェック
            if (part.typename !== "PathItem" && part.typename !== "CompoundPathItem") {
                result.isValid = false;
                result.messages.push("Invalid part type: " + part.typename);
                return result;
            }

            // Check if path is closed / パスが閉じているか確認
            if (config.validation.requireClosedPaths) {
                if (part.typename === "PathItem" && !part.closed) {
                    result.messages.push("Path is not closed");
                    if (config.validation.strictMode) {
                        result.isValid = false;
                    }
                } else if (part.typename === "CompoundPathItem") {
                    for (var i = 0; i < part.pathItems.length; i++) {
                        if (!part.pathItems[i].closed) {
                            result.messages.push("CompoundPath contains unclosed path");
                            if (config.validation.strictMode) {
                                result.isValid = false;
                            }
                            break;
                        }
                    }
                }
            }

            // Vertex count check / 頂点数チェック
            var vertexCount = this.countVertices(part);
            if (vertexCount < config.validation.minVertices) {
                result.messages.push("Too few vertices: " + vertexCount);
                if (config.validation.strictMode) result.isValid = false;
            }
            if (vertexCount > config.validation.maxVertices) {
                result.messages.push("Too many vertices: " + vertexCount);
                if (config.validation.strictMode) result.isValid = false;
            }

            return result;
        },

        /**
         * Validates an LED item
         * LEDアイテムを検証
         */
        validateLED: function (led, config) {
            var result = {
                isValid: true,
                messages: []
            };

            // Type check / タイプチェック
            if (led.typename !== "GroupItem") {
                result.isValid = false;
                result.messages.push("Invalid LED type: " + led.typename);
                return result;
            }

            // Check for empty groups / 空のグループをチェック
            if (led.pageItems.length === 0) {
                result.messages.push("LED group is empty");
                if (config.validation.strictMode) result.isValid = false;
            }

            // Size check / サイズチェック
            if (led.width < 0.1 || led.height < 0.1) {
                result.messages.push("LED has invalid dimensions");
                if (config.validation.strictMode) result.isValid = false;
            }

            return result;
        },

        /**
         * Counts vertices in a part
         * パーツの頂点数を数える
         */
        countVertices: function (part) {
            var count = 0;
            if (part.typename === "PathItem") {
                count = part.pathPoints.length;
            } else if (part.typename === "CompoundPathItem") {
                for (var i = 0; i < part.pathItems.length; i++) {
                    count += part.pathItems[i].pathPoints.length;
                }
            }
            return count;
        }
    };

    // Spatial optimization module / 空間最適化モジュール
    var spatial = {

        /**
         * Sorts items spatially based on their center points
         * アイテムを中心点に基づいて空間的にソート
         * 
         * @param {Array} items - Array of items to sort (parts or LEDs)
         * @param {number} cellSize - Size of grid cells for spatial organization
         * @returns {Array} Sorted array of items with their spatial information
         */
        sortItemsSpatially: function(items, cellSize) {
            var sortedItems = [];
            
            // Calculate spatial position for each item
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var box = this.getBoundingBox(item);
                
                // Calculate center point grid coordinates
                var centerX = Math.floor((box.x + box.right) / 2 / cellSize);
                var centerY = Math.floor((box.y + box.bottom) / 2 / cellSize);
                
                sortedItems.push({
                    item: item,
                    gridX: centerX,
                    gridY: centerY,
                    box: box
                });
            }
            
            // Sort by grid position (top-to-bottom, left-to-right)
            sortedItems.sort(function(a, b) {
                if (a.gridY !== b.gridY) {
                    return b.gridY - a.gridY;  // Top-to-bottom
                }
                return a.gridX - b.gridX;      // Left-to-right
            });
            
            return sortedItems;
        },

        /**
         * Creates a more efficient spatial index using grid-based sorting
         * グリッドベースのソートを使用したより効率的な空間インデックスを作成
         * 
         * @param {Array} items - Items to sort (parts or LEDs)
         * @param {number} cellSize - Size of grid cells
         * @returns {Object} Sorted spatial structure
         */
        createSpatialIndex: function(items, cellSize) {
            var sortedItems = [];
            
            // First, assign grid coordinates to each item
            // まず、各アイテムにグリッド座標を割り当てる
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var box = this.getBoundingBox(item);
                
                // Use center point for sorting
                // ソート用に中心点を使用
                var centerX = Math.floor((box.x + box.right) / 2 / cellSize);
                var centerY = Math.floor((box.y + box.bottom) / 2 / cellSize);
                
                sortedItems.push({
                    item: item,
                    gridX: centerX,
                    gridY: centerY,
                    box: box
                });
            }
            
            // Sort items by grid position (top-to-bottom, left-to-right)
            // グリッドポジションでアイテムをソート（上から下、左から右）
            sortedItems.sort(function(a, b) {
                if (a.gridY !== b.gridY) {
                    return b.gridY - a.gridY; // Reverse for top-to-bottom
                }
                return a.gridX - b.gridX;
            });
            
            return sortedItems;
        },

        /**
         * Gets bounding box for an item
         * アイテムのバウンディングボックスを取得
         */
        getBoundingBox: function (item) {
            return {
                x: item.left,
                y: item.top,
                width: item.width,
                height: item.height,
                right: item.left + item.width,
                bottom: item.top - item.height
            };
        },

        /**
         * Checks if two boxes overlap
         * 2つのボックスが重なっているか確認
         */
        doBoxesOverlap: function (box1, box2) {
            return !(
                box1.x >= box2.right ||
                box2.x >= box1.right ||
                box1.bottom >= box2.y ||
                box2.bottom >= box1.y
            );
        },

        /**
         * Creates an optimized spatial grid for quick item lookup
         * 高速なアイテム検索のための最適化された空間グリッドを作成
         * 
         * @param {Array} items - Array of items to organize
         * @param {number} cellSize - Size of each grid cell
         * @returns {Object} Optimized grid structure
         */
        createGrid: function(items, cellSize) {
            var grid = {};
            
            for (var i = 0; i < items.length; i++) {
                var item = items[i];
                var box = this.getBoundingBox(item);
                
                // Calculate grid cell boundaries once
                var minCellX = Math.floor(box.x / cellSize);
                var maxCellX = Math.floor(box.right / cellSize);
                var minCellY = Math.floor(box.bottom / cellSize);
                var maxCellY = Math.floor(box.y / cellSize);
                
                // Calculate total number of cells this item will occupy
                var cellCount = (maxCellX - minCellX + 1) * (maxCellY - minCellY + 1);
                
                // For very large items, we might want to use a different strategy
                if (cellCount > 100) {  // Arbitrary threshold, adjust based on your needs
                    var key = "large_" + i;
                    grid[key] = {
                        item: item,
                        bounds: {
                            minX: minCellX,
                            maxX: maxCellX,
                            minY: minCellY,
                            maxY: maxCellY
                        }
                    };
                    continue;
                }
                
                // For normal-sized items, use regular grid cells
                var xSpan = maxCellX - minCellX;
                var cells = new Array(xSpan + 1);
                
                // Pre-calculate all cell keys
                for (var x = 0; x <= xSpan; x++) {
                    var currentX = minCellX + x;
                    for (var y = minCellY; y <= maxCellY; y++) {
                        var key = currentX + "," + y;
                        if (!grid[key]) {
                            grid[key] = [];
                        }
                        grid[key].push(item);
                    }
                }
            }
            
            return grid;
        }
    };

    // Parts processor / パーツプロセッサ
    var partProcessor = {
        /**
         * Processes and sorts parts
         * パーツを処理して並べ替え
         */
        processParts: function (parts, config) {
            var validParts = [];
            var validationResults = [];
            
            // Validate parts / パーツを検証
            for (var i = 0; i < parts.length; i++) {
                var validation = validator.validatePart(parts[i], config);
                validationResults.push(validation);
                
                if (validation.isValid || !config.validation.strictMode) {
                    validParts.push(parts[i]);
                }
            }
            
            // Sort parts / パーツを並べ替え
            var sortedParts = this.sortParts(validParts, config.grid);
            
            return {
                parts: sortedParts,
                validation: validationResults
            };
        },

        /**
         * Sorts parts by position
         * 位置でパーツを並べ替え
         */
        sortParts: function (parts, gridConfig) {
            return parts.sort(function (a, b) {
                var boxA = spatial.getBoundingBox(a);
                var boxB = spatial.getBoundingBox(b);
                
                if (gridConfig.sortDirection === CONSTANTS.SORT_DIRECTIONS.TOP_TO_BOTTOM) {
                    if (Math.abs(boxA.y - boxB.y) > 10) {
                        return boxB.y - boxA.y;
                    }
                    return boxA.x - boxB.x;
                } else {
                    if (Math.abs(boxA.x - boxB.x) > 10) {
                        return boxA.x - boxB.x;
                    }
                    return boxB.y - boxA.y;
                }
            });
        }
    };

    // LED processor / LEDプロセッサ
    var ledProcessor = {
        /**
         * Processes and sorts LEDs
         * LEDを処理して並べ替え
         */
        processLEDs: function (leds, config) {
            var validLEDs = [];
            var validationResults = [];
            
            // Validate LEDs / LEDを検証
            for (var i = 0; i < leds.length; i++) {
                var validation = validator.validateLED(leds[i], config);
                validationResults.push(validation);
                
                if (validation.isValid || !config.validation.strictMode) {
                    validLEDs.push(leds[i]);
                }
            }
            
            // Sort LEDs / LEDを並べ替え
            var sortedLEDs = this.sortLEDs(validLEDs, config.grid);
            
            return {
                leds: sortedLEDs,
                validation: validationResults
            };
        },

        /**
         * Sorts LEDs by position
         * 位置でLEDを並べ替え
         */
        sortLEDs: function (leds, gridConfig) {
            // Uses same sorting logic as parts
            return partProcessor.sortParts(leds, gridConfig);
        }
    };

    // Grid search / グリッド検索
    var gridProcessor = {
        /**
         * Gets relevant grid cells for a bounding box
         * バウンディングボックスに関連するグリッドセルを取得
         * 
         * @param {Object} box - Bounding box / バウンディングボックス
         * @param {number} cellSize - Grid cell size / グリッドセルサイズ
         * @returns {Object} Cell range / セル範囲
         */
        getRelevantGridCells: function (box, cellSize) {
            return {
                startX: Math.floor(box.x / cellSize),
                endX: Math.floor(box.right / cellSize),
                startY: Math.floor(box.bottom / cellSize),
                endY: Math.floor(box.y / cellSize)
            };
        },

        /**
         * Gets candidate LEDs from grid cells
         * グリッドセルから候補LEDを取得
         * 
         * @param {Object} cells - Cell range / セル範囲
         * @param {Object} grid - Spatial grid / 空間グリッド
         * @returns {Array} Candidate LEDs / 候補LED
         */
        getCandidateLEDsFromCells: function (cells, grid) {
            var candidates = {};
        
            for (var x = cells.startX; x <= cells.endX; x++) {
                for (var y = cells.startY; y <= cells.endY; y++) {
                    var key = x + "," + y;
                    if (grid[key]) {
                        // Use forEach for ExtendScript compatibility
                        for (var i = 0; i < grid[key].length; i++) {
                            var led = grid[key][i];
                            candidates[led.name] = led;
                        }
                    }
                }
            }
        
            // Convert to array for ExtendScript compatibility
            var result = [];
            for (var key in candidates) {
                if (candidates.hasOwnProperty(key)) {
                    result.push(candidates[key]);
                }
            }
            return result;
        },

        /**
         * Checks if search can be terminated early based on position
         * 位置に基づいて検索を早期終了できるかチェック
         * 
         * @param {Object} partBox - Part bounding box / パーツのバウンディングボックス
         * @param {Object} ledBox - LED bounding box / LEDのバウンディングボックス
         * @param {string} sortDirection - Sort direction / ソート方向
         * @returns {boolean} True if search can be terminated / 検索を終了可能な場合はtrue
         */
        canTerminateSearch: function(partData, ledData) {
            if (ledData.gridY < partData.gridY - 1) {
                return true; // LED is too far below
            }
            if (ledData.gridY > partData.gridY + 1) {
                return true; // LED is too far above
            }
            if (Math.abs(ledData.gridX - partData.gridX) > 1) {
                return true; // LED is too far to the side
            }
            return false;
        },

        /**
         * Analyzes overlap between parts and LEDs
         * パーツとLEDの重なりを解析
         * 
         * @param {Object} params - Analysis parameters / 解析パラメータ
         * @returns {Object} Analysis results / 解析結果
         */
        analyzeOverlap: function (params) {
        var config = params.config ? params.config : LEDAnalysisLib.DEFAULT_CONFIG;
        var parts = params.parts;
        var leds = params.leds;
        var results = {
            assignments: [],
            unassignedLEDs: [],
            validationErrors: []
        };

        try {
            // Time the spatial organization process
            var startTime = new Date().getTime();
            
            // Sort both parts and LEDs spatially
            var sortedParts = spatial.sortItemsSpatially(parts, config.grid.cellSize);
            var sortedLEDs = spatial.sortItemsSpatially(leds, config.grid.cellSize);
            
            var endTime = new Date().getTime();
            $.writeln("[DEBUG] Spatial sorting took: " + (endTime - startTime) + "ms");

            // Create LED grid once before processing parts
            var startGridTime = new Date().getTime();
            var ledItems = [];
            for (var i = 0; i < sortedLEDs.length; i++) {
                ledItems.push(sortedLEDs[i].item);
            }
            var ledGrid = spatial.createGrid(ledItems, config.grid.cellSize);
            var endGridTime = new Date().getTime();
            $.writeln("[DEBUG] LED grid creation took: " + (endGridTime - startGridTime) + "ms");
            
            // Create tracking set for unassigned LEDs
            var unassignedLEDSet = {};
            for (var j = 0; j < leds.length; j++) {
                unassignedLEDSet[leds[j].name] = leds[j];
            }

            // Process parts in their spatial order
            for (var i = 0; i < sortedParts.length; i++) {
                var partData = sortedParts[i];
                var part = partData.item;
                var partBox = spatial.getBoundingBox(part);
                var partAssignments = [];

                // Get candidate LEDs efficiently
                var gridCells = this.getRelevantGridCells(partBox, config.grid.cellSize);
                var candidateLEDs = this.getCandidateLEDsFromCells(gridCells, ledGrid);


                // First pass: Quick bounding box check / 第1パス：簡易バウンディングボックスチェック
                var boundingBoxMatches = [];
                for (var j = 0; j < candidateLEDs.length; j++) {
                    var led = candidateLEDs[j];
                    var ledBox = spatial.getBoundingBox(led);

                    // Check if we can terminate search / 検索を終了できるかチェック
                    if (this.canTerminateSearch(partData, {
                        gridX: Math.floor((ledBox.x + ledBox.right) / 2 / config.grid.cellSize),
                        gridY: Math.floor((ledBox.y + ledBox.bottom) / 2 / config.grid.cellSize)
                    })) {
                        break;
                    }

                    if (spatial.doBoxesOverlap(partBox, ledBox)) {
                        boundingBoxMatches.push(led);
                    }
                }

                // Second pass: Precise vertex check / 第2パス：精密な頂点チェック
                if (boundingBoxMatches.length > 0) {
                    var partVertices = geometry.getPartVertices(part);

                    for (var j = 0; j < boundingBoxMatches.length; j++) {
                        var led = boundingBoxMatches[j];
                        var ledVertices = geometry.getLEDVertices(led);
                        var verticesInside = 0;

                        for (var k = 0; k < ledVertices.length; k++) {
                            if (geometry.isPointInPolygon(ledVertices[k], partVertices)) {
                                verticesInside++;
                            }
                        }

                        var overlapPercentage = verticesInside / ledVertices.length;
                        if (overlapPercentage >= config.overlap.threshold) {
                            // Calculate confidence if enabled / 有効な場合は信頼度を計算
                            var confidence = null;
                            if (config.overlap.confidenceReport) {
                                confidence = overlapConfidence.calculateConfidence(ledVertices, partVertices);
                            }

                            partAssignments.push({
                                led: led,
                                overlapPercentage: overlapPercentage,
                                confidence: confidence
                            });
                            delete unassignedLEDSet[led.name];
                        }
                        var message = "";
                        if (j % 50 === 0) { 
                            message += "[DEBUG] LED " + led.name + "\n"; 
                            message += " overlap with " + part.name + ": "; 
                            message += (overlapPercentage * 100).toFixed(1) + "% (";
                            message += verticesInside + "/" + ledVertices.length + " vertices inside)";
                            alert(message);
                            $.writeln(message);
                        }

                    }
                }

                // Store assignments if any / 割り当てがあれば保存
                if (partAssignments.length > 0) {
                    results.assignments.push({
                        part: part,
                        leds: partAssignments
                    });
                }
            }

            // Final pass: Fallback assignments / 第3パス：フォールバック割り当て
            if (config.overlap.useFallback) {
                for (var ledName in unassignedLEDSet) {
                    if (unassignedLEDSet.hasOwnProperty(ledName)) {
                        var led = unassignedLEDSet[ledName];
                        var ledBox = spatial.getBoundingBox(led);

                        for (var i = 0; i < parts.length; i++) {
                            var part = parts[i];
                            var partBox = spatial.getBoundingBox(part);

                            if (spatial.doBoxesOverlap(partBox, ledBox)) {
                                var assignment = null;
                                for (var j = 0; j < results.assignments.length; j++) {
                                    if (results.assignments[j].part.name === part.name) {
                                        assignment = results.assignments[j];
                                        break;
                                    }
                                }

                                if (!assignment) {
                                    assignment = {
                                        part: part,
                                        leds: []
                                    };
                                    results.assignments.push(assignment);
                                }

                                assignment.leds.push({
                                    led: led,
                                    overlapPercentage: 0.5,
                                    isFallback: true
                                });

                                delete unassignedLEDSet[ledName];
                                break;
                            }
                        }
                    }
                }
            }

                // Record remaining unassigned LEDs / 残りの未割り当てLEDを記録
                var remaining = [];
                for (var ledName in unassignedLEDSet) {
                    if (unassignedLEDSet.hasOwnProperty(ledName)) {
                        remaining.push(unassignedLEDSet[ledName]);
                    }
                }
                results.unassignedLEDs = remaining;

            } catch (e) {
                results.validationErrors.push("Error during analysis: " + e.message);
            }

            return results;
        }
    };
    
    // Geometry processor / ジオメトリプロセッサ
    var geometry = {
        /**
         * Gets vertices from part
         * パーツから頂点を取得
         */
        getPartVertices: function (part) {
            var vertices = [];
            
            if (part.typename === "PathItem") {
                for (var i = 0; i < part.pathPoints.length; i++) {
                    vertices.push([
                        part.pathPoints[i].anchor[0],
                        part.pathPoints[i].anchor[1]
                    ]);
                }
            } else if (part.typename === "CompoundPathItem") {
                for (var i = 0; i < part.pathItems.length; i++) {
                    var subPath = part.pathItems[i];
                    for (var j = 0; j < subPath.pathPoints.length; j++) {
                        vertices.push([
                            subPath.pathPoints[j].anchor[0],
                            subPath.pathPoints[j].anchor[1]
                        ]);
                    }
                }
            }
            
            return vertices;
        },

        /**
         * Gets vertices from LED
         * LEDから頂点を取得
         */
        getLEDVertices: function (led) {
            var vertices = [];
            
            function processItem(item) {
                if (item.typename === "PathItem") {
                    for (var i = 0; i < item.pathPoints.length; i++) {
                        vertices.push([
                            item.pathPoints[i].anchor[0],
                            item.pathPoints[i].anchor[1]
                        ]);
                    }
                } else if (item.typename === "GroupItem") {
                    for (var i = 0; i < item.pageItems.length; i++) {
                        processItem(item.pageItems[i]);
                    }
                }
            }
            
            processItem(led);
            return vertices;
        },

        /**
         * Checks if point is inside polygon
         * 点が多角形の内部にあるかチェック
         */
        isPointInPolygon: function (point, vertices) {
            var x = point[0], y = point[1];
            var inside = false;
            
            for (var i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
                var xi = vertices[i][0], yi = vertices[i][1];
                var xj = vertices[j][0], yj = vertices[j][1];
                
                if (((yi > y) !== (yj > y)) &&
                    (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                    inside = !inside;
                }
            }
            
            return inside;
        }
    };

    /**
     * Overlap Confidence Module
     * 重なり信頼度モジュール
     * 
     * Calculates and reports overlap confidence based on vertex positions
     * 頂点位置に基づく重なりの信頼度を計算・レポート
     */

    // Add this module to the library / ライブラリにこのモジュールを追加
    var overlapConfidence = {
        /**
         * Calculates overlap confidence for a LED relative to a part
         * パーツに対するLEDの重なり信頼度を計算
         * 
         * @param {Array} ledVertices - LED vertices / LEDの頂点
         * @param {Array} partVertices - Part vertices / パーツの頂点
         * @returns {Object} Confidence metrics / 信頼度メトリクス
         */
        calculateConfidence: function (ledVertices, partVertices) {
            var insideCount = 0;
            var totalVertices = ledVertices.length;
            var vertexPositions = [];

            // Check each vertex / 各頂点をチェック
            for (var i = 0; i < ledVertices.length; i++) {
                var isInside = geometry.isPointInPolygon(ledVertices[i], partVertices);
                if (isInside) {
                    insideCount++;
                    vertexPositions.push({
                        vertex: ledVertices[i],
                        inside: true
                    });
                } else {
                    vertexPositions.push({
                        vertex: ledVertices[i],
                        inside: false
                    });
                }
            }

            // Calculate confidence / 信頼度を計算
            var confidence = {
                percentage: (insideCount / totalVertices) * 100,
                insideCount: insideCount,
                totalVertices: totalVertices,
                vertexPositions: vertexPositions,
                confidenceLevel: this.getConfidenceLevel(insideCount, totalVertices)
            };

            return confidence;
        },

        /**
         * Gets confidence level description
         * 信頼度レベルの説明を取得
         * 
         * @param {number} insideCount - Number of vertices inside / 内部の頂点数
         * @param {number} totalVertices - Total vertices / 全頂点数
         * @returns {string} Confidence level / 信頼度レベル
         */
        getConfidenceLevel: function (insideCount, totalVertices) {
            var percentage = (insideCount / totalVertices) * 100;
        
            if (percentage === 100) return "FULL";
            if (percentage >= 75) return "HIGH";
            if (percentage >= 50) return "MEDIUM";
            if (percentage >= 25) return "LOW";
            return "MINIMAL";
        },

        /**
         * Generates detailed overlap report
         * 詳細な重なりレポートを生成
         * 
         * @param {Object} confidence - Confidence metrics / 信頼度メトリクス
         * @returns {Object} Detailed report / 詳細レポート
         */
        generateReport: function (confidence) {
            return {
                summary: {
                    confidenceLevel: confidence.confidenceLevel,
                    overlapPercentage: confidence.percentage.toFixed(2) + "%",
                    verticesInside: confidence.insideCount,
                    totalVertices: confidence.totalVertices
                },
                details: {
                    vertexAnalysis: (function () {
                        var analysis = [];
                        for (var i = 0; i < confidence.vertexPositions.length; i++) {
                            var pos = confidence.vertexPositions[i];
                            analysis.push({
                                vertexIndex: i,
                                position: pos.vertex,
                                isInside: pos.inside
                            });
                        }
                        return analysis;
                    })()
                },
                interpretation: this.getInterpretation(confidence)
            };
        },

        /**
         * Gets human-readable interpretation of confidence
         * 信頼度の人間が読める解釈を取得
         * 
         * @param {Object} confidence - Confidence metrics / 信頼度メトリクス
         * @returns {string} Interpretation / 解釈
         */
        getInterpretation: function (confidence) {
            var interpretation = "";
        
            switch (confidence.confidenceLevel) {
                case "FULL":
                    interpretation = "All vertices are inside the part - complete overlap";
                    break;
                case "HIGH":
                    interpretation = "Most vertices are inside - strong indication of overlap";
                    break;
                case "MEDIUM":
                    interpretation = "Half or more vertices are inside - partial overlap";
                    break;
                case "LOW":
                    interpretation = "Some vertices are inside - minimal overlap";
                    break;
                case "MINIMAL":
                    interpretation = "Few or no vertices inside - questionable overlap";
                    break;
            }
        
            return interpretation;
        }
    };


    /**
     * Example modification to analyzeOverlap results structure:
     * analyzeOverlapの結果構造の修正例：
     * 
     * partAssignments.push({
     *     led: led,
     *     overlapPercentage: overlapPercentage,
     *     confidence: this.calculateOverlapConfidence(ledVertices, partVertices),
     *     confidenceReport: this.generateOverlapReport(confidence)
     * });
     */

    // Public API / 公開API
    return {
        // Constants
        GRID_TYPES: CONSTANTS.GRID_TYPES,
        SORT_DIRECTIONS: CONSTANTS.SORT_DIRECTIONS,
        CELL_SIZES: CONSTANTS.CELL_SIZES,
            
        // Configuration
        DEFAULT_CONFIG: DEFAULT_CONFIG,
            
        // Core processing methods
        processParts: function (parts, config) {
            return partProcessor.processParts(parts, config || this.DEFAULT_CONFIG);
        },
            
        processLEDs: function (leds, config) {
            return ledProcessor.processLEDs(leds, config || this.DEFAULT_CONFIG);
        },
            
        // Spatial methods
        createSpatialGrid: function (items, cellSize) {
            return spatial.createGrid(items, cellSize || this.DEFAULT_CONFIG.grid.cellSize);
        },
            
        getBoundingBox: function (item) {
            return spatial.getBoundingBox(item);
        },
            
        checkOverlap: function (box1, box2) {
            return spatial.doBoxesOverlap(box1, box2);
        },
            
        // Geometry methods
        getPartVertices: function (part) {
            return geometry.getPartVertices(part);
        },
            
        getLEDVertices: function (led) {
            return geometry.getLEDVertices(led);
        },
            
        isPointInPolygon: function (point, vertices) {
            return geometry.isPointInPolygon(point, vertices);
        },
            
        // Validation methods
        validatePart: function (part, config) {
            return validator.validatePart(part, config || this.DEFAULT_CONFIG);
        },
            
        validateLED: function (led, config) {
            return validator.validateLED(led, config || this.DEFAULT_CONFIG);
        },

        /**
         * Counts vertices in a part
         * パーツの頂点数をカウント
         * 
         * @param {PathItem|CompoundPathItem} part - Target part / 対象パーツ
         * @returns {number} Number of vertices / 頂点数
         */
        countVertices: function (part) {
            return validator.countVertices(part);
        },

        /**
         * Updates configuration
         * 設定を更新
         * 
         * @param {Object} newConfig - New configuration settings / 新しい設定
         * @returns {Object} Updated configuration / 更新された設定
         */
        updateConfig: function (newConfig) {
            // Deep merge of configurations / 設定のディープマージ
            function mergeConfig(target, source) {
                for (var key in source) {
                    if (source.hasOwnProperty(key)) {
                        if (typeof source[key] === 'object' && target.hasOwnProperty(key)) {
                            target[key] = mergeConfig(target[key], source[key]);
                        } else {
                            target[key] = source[key];
                        }
                    }
                }
                return target;
            }
                
            this.DEFAULT_CONFIG = mergeConfig(this.DEFAULT_CONFIG, newConfig);
            return this.DEFAULT_CONFIG;
        },

        /**
         * Gets configuration presets
         * 設定プリセットを取得
         * 
         * @param {string} presetName - Name of preset / プリセット名
         * @returns {Object} Preset configuration / プリセット設定
         */
        getConfigPreset: function (presetName) {
            var presets = {
                strict: {
                    validation: {
                        enabled: true,
                        strictMode: true,
                        requireClosedPaths: true,
                        minVertices: 3
                    },
                    overlap: {
                        threshold: 0.9,
                        useFallback: false
                    }
                },
                lenient: {
                    validation: {
                        enabled: true,
                        strictMode: false,
                        requireClosedPaths: false,
                        minVertices: 2
                    },
                    overlap: {
                        threshold: 0.6,
                        useFallback: true
                    }
                },
                performance: {
                    grid: {
                        type: this.GRID_TYPES.RECTANGULAR,
                        cellSize: this.CELL_SIZES.LARGE,
                        sortDirection: this.SORT_DIRECTIONS.TOP_TO_BOTTOM
                    },
                    validation: {
                        enabled: false
                    },
                    overlap: {
                        threshold: 0.8,
                        useFallback: true
                    }
                }
            };
                
            return presets[presetName] || this.DEFAULT_CONFIG;
        },


        /**
         * Calculates overlap confidence
         * 重なり信頼度を計算
         * 
         * @param {Array} ledVertices - LED vertices / LEDの頂点
         * @param {Array} partVertices - Part vertices / パーツの頂点
         * @returns {Object} Confidence metrics / 信頼度メトリクス
         */
        calculateOverlapConfidence: function (ledVertices, partVertices) {
            return overlapConfidence.calculateConfidence(ledVertices, partVertices);
        },

        /**
         * Generates overlap confidence report
         * 重なり信頼度レポートを生成
         * 
         * @param {Object} confidence - Confidence metrics / 信頼度メトリクス
         * @returns {Object} Detailed report / 詳細レポート
         */
        generateOverlapReport: function (confidence) {
            return overlapConfidence.generateReport(confidence);
        },

        /**
         * Creates debug report for item
         * アイテムのデバッグレポートを作成
         * 
         * @param {PathItem|GroupItem} item - Target item / 対象アイテム
         * @returns {Object} Debug information / デバッグ情報
         */
        createDebugReport: function (item) {
            var report = {
                name: item.name,
                type: item.typename,
                position: [item.position[0], item.position[1]],
                boundingBox: this.getBoundingBox(item)
            };

            if (item.typename === "PathItem" || item.typename === "CompoundPathItem") {
                report.vertices = this.countVertices(item);
                report.isClosed = item.typename === "PathItem" ? item.closed : true;
            } else if (item.typename === "GroupItem") {
                report.itemCount = item.pageItems.length;
            }

            return report;
        },


        /**
         * Analyzes overlap between parts and LEDs
         * パーツとLEDの重なりを解析
         * 
         * @param {Object} params - Analysis parameters / 解析パラメータ
         * @returns {Object} Analysis results / 解析結果
         */
        analyzeOverlap: function (params) {
            return gridProcessor.analyzeOverlap(params);
        },

        /**
         * Gets relevant grid cells for a bounding box
         * バウンディングボックスに関連するグリッドセルを取得
         */
        getRelevantGridCells: function (box, cellSize) {
            return gridProcessor.getRelevantGridCells(box, cellSize);
        },

        /**
         * Gets candidate LEDs from grid cells
         * グリッドセルから候補LEDを取得
         */
        getCandidateLEDsFromCells: function (cells, grid) {
            return gridProcessor.getCandidateLEDsFromCells(cells, grid);
        },

        /**
         * Checks if search can be terminated early
         * 検索を早期終了できるかチェック
         */
        canTerminateSearch: function (partBox, ledBox, sortDirection) {
            return gridProcessor.canTerminateSearch(partBox, ledBox, sortDirection);
        },

        // Add these to the public API section of the library

    /**
     * Collects all LED groups from a specified layer
     * 指定したレイヤーからすべてのLEDグループを収集
     * 
     * @param {Layer} layer - Target layer / 対象レイヤー
     * @returns {Array} Array of LED groups / LEDグループの配列
     */
    collectLEDs: function(layer) {
        if (!layer) {
            throw new Error("Layer not specified / レイヤーが指定されていません");
        }
        
        var leds = [];
        
        // Collect all GroupItems at first level
        for (var i = 0; i < layer.pageItems.length; i++) {
            var item = layer.pageItems[i];
            if (item.typename === "GroupItem") {
                leds.push(item);
            }
        }
        
        var resultsMsg = "[DEBUG] Layer '" + layer.name + "' contains: ";
        resultMsg += "  - " + layer.pageItems.length + " total page items";
        resultMsg += "  - " + leds.length + " LED groups collected";
        $.writeln(resultMsg);
        
        return leds;
    },

    /**
     * Collects all PathItems and CompoundPathItems from a layer, including those in nested groups
     * ネストされたグループを含むレイヤーからすべてのPathItemとCompoundPathItemを収集
     * 
     * @param {Layer} layer - The layer to collect from
     * @returns {Array} Array of path items
     */
    collectParts: function(layer) {
        if (!layer) {
            throw new Error("Layer not specified / レイヤーが指定されていません");
        }
        
        var parts = [];
        
        function traverseForParts(container) {
            // ExtendScript-safe iteration through pageItems
            for (var i = 0; i < container.pageItems.length; i++) {
                var item = container.pageItems[i];
                
                // Check each possible type
                if (item.typename === "PathItem" || item.typename === "CompoundPathItem") {
                    // Direct part found
                    parts.push(item);
                } else if (item.typename === "GroupItem") {
                    // Recursively check group contents
                    traverseForParts(item);
                }
                // Ignore other item types
            }
        }
        
        // Start traversal from the layer
        traverseForParts(layer);
        
        // Debug logging to verify count
        $.writeln("[DEBUG] Collected " + parts.length + " parts from layer: " + layer.name);
        $.writeln("[DEBUG] Layer '" + layer.name + "' contains:");
        $.writeln("  - " + layer.pageItems.length + " total page items");
        $.writeln("  - " + parts.length + " parts collected (including nested items)");
    
        return parts;
    },

    /**
     * Collects parts and LEDs from their respective layers
     * それぞれのレイヤーからパーツとLEDを収集
     * 
     * @param {Layer} partLayer - Layer containing parts / パーツを含むレイヤー
     * @param {Layer} ledLayer - Layer containing LEDs / LEDを含むレイヤー
     * @returns {Object} Object containing parts and LEDs / パーツとLEDを含むオブジェクト
     */
    collectItemsFromLayers: function(ledLayer, targetLayer) {
        if (!targetLayer || !ledLayer) {
            throw new Error("Both part layer and LED layer must be specified / パーツレイヤーとLEDレイヤーの両方を指定する必要があります");
        }
        
        return {
            parts: this.collectParts(targetLayer),
            leds: this.collectLEDs(ledLayer)
        };
    },

    /**
     * Finds a layer by name in the active document
     * アクティブドキュメント内で名前からレイヤーを検索
     * 
     * @param {string} name - Layer name to find / 検索するレイヤー名
     * @returns {Layer|null} Found layer or null / 見つかったレイヤーまたはnull
     */
    findLayerByName: function(name) {
        if (!app.documents.length) {
            throw new Error("No open document / 開いているドキュメントがありません");
        }
        
        var doc = app.activeDocument;
        
        for (var i = 0; i < doc.layers.length; i++) {
            if (doc.layers[i].name === name) {
                return doc.layers[i];
            }
        }
        
        return null;
    }

    };  // <-- Change comma to semicolon
}();

// Enable backward compatibility / 後方互換性を有効化
if (typeof exports !== 'undefined') {
    exports.LEDAnalysisLib = LEDAnalysisLib;
}