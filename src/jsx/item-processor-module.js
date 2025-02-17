/**
 * @name ItemProcessor Module
 * アイテムプロセッサーモジュール
 * 
 * @description
 * Processes Parts and LEDs independently in Adobe Illustrator documents.
 * Handles sorting, categorization, and grid-based positioning.
 * Adobe IllustratorドキュメントのパーツとLEDを個別に処理。
 * 並べ替え、分類、グリッドベースの配置を処理。
 * 
 * @requires Adobe Illustrator
 * @version 1.1.0
 * @date 2024-02-17
 */

var ItemProcessor = (function() {
    // Private utilities / プライベートユーティリティ
    var utils = {
        /**
         * Groups items into a grid structure
         * アイテムをグリッド構造にグループ化
         * 
         * @param {Array} items - Items to group / グループ化するアイテム
         * @param {Object} config - Configuration / 設定
         * @returns {Object} Grid structure / グリッド構造
         */
        createGrid: function(items, config) {
            var columns = {};
            var columnKeys = [];
            var xTolerance = config.xTolerance || 20;
            
            items.forEach(function(item) {
                var x = item.position[0];
                var foundColumn = false;
                
                // Check existing columns / 既存の列をチェック
                for (var i = 0; i < columnKeys.length; i++) {
                    if (Math.abs(x - columnKeys[i]) <= xTolerance) {
                        columns[columnKeys[i]].push(item);
                        foundColumn = true;
                        break;
                    }
                }
                
                // Create new column if needed / 必要に応じて新しい列を作成
                if (!foundColumn) {
                    columnKeys.push(x);
                    columns[x] = [item];
                }
            });
            
            return {
                columns: columns,
                keys: columnKeys.sort(function(a, b) { return a - b; })
            };
        },

        /**
         * Checks if item is within tolerance of a grid line
         * アイテムがグリッドラインの許容範囲内かチェック
         */
        isWithinTolerance: function(value, gridLine, tolerance) {
            return Math.abs(value - gridLine) <= tolerance;
        }
    };

    // Part processor module / パーツプロセッサーモジュール
    var partProcessor = {
        /**
         * Sorts and categorizes parts in a layer
         * レイヤー内のパーツを並べ替えて分類
         * 
         * @param {Layer} layer - Target layer / ターゲットレイヤー
         * @param {Object} config - Configuration options / 設定オプション
         * @returns {Array} Sorted parts / 並べ替えられたパーツ
         */
        sortAndCategorizeParts: function(layer, config) {
            var parts = [];
            
            // Collect all parts / 全パーツを収集
            for (var i = 0; i < layer.pageItems.length; i++) {
                var item = layer.pageItems[i];
                if (item.typename === "PathItem" || item.typename === "CompoundPathItem") {
                    parts.push(item);
                }
            }
            
            // Sort parts by position / 位置でパーツを並べ替え
            parts = this.sortPartsByPosition(parts, config);
            
            // Rename sorted parts / 並べ替えたパーツの名前を変更
            parts.forEach(function(part, index) {
                part.name = "Part_" + index;
                part.move(layer, ElementPlacement.PLACEATEND);
            });
            
            return parts;
        },

        /**
         * Sorts parts by grid position
         * グリッド位置でパーツを並べ替え
         * 
         * @param {Array} parts - Parts to sort / 並べ替えるパーツ
         * @param {Object} config - Sort configuration / 並べ替え設定
         * @returns {Array} Sorted parts / 並べ替えられたパーツ
         */
        sortPartsByPosition: function(parts, config) {
            var grid = utils.createGrid(parts, config);
            var sortedParts = [];
            
            // Sort each column top to bottom / 各列を上から下に並べ替え
            grid.keys.forEach(function(key) {
                var column = grid.columns[key];
                column.sort(function(a, b) {
                    return b.position[1] - a.position[1]; // y-position sort
                });
                sortedParts = sortedParts.concat(column);
            });
            
            return sortedParts;
        }
    };

    // LED processor module / LEDプロセッサーモジュール
    var ledProcessor = {
        /**
         * Sorts and categorizes LEDs in a layer
         * レイヤー内のLEDを並べ替えて分類
         * 
         * @param {Layer} layer - Target layer / ターゲットレイヤー
         * @param {Object} config - Configuration options / 設定オプション
         * @returns {Array} Sorted LEDs / 並べ替えられたLED
         */
        sortAndCategorizeLEDs: function(layer, config) {
            var leds = [];
            
            // Collect all LEDs / 全LEDを収集
            for (var i = 0; i < layer.pageItems.length; i++) {
                var item = layer.pageItems[i];
                if (item.typename === "GroupItem") {
                    leds.push(item);
                }
            }
            
            // Sort LEDs by position / 位置でLEDを並べ替え
            leds = this.sortLEDsByPosition(leds, config);
            
            // Rename sorted LEDs / 並べ替えたLEDの名前を変更
            leds.forEach(function(led, index) {
                led.name = "LED_" + index;
                led.move(layer, ElementPlacement.PLACEATEND);
            });
            
            return leds;
        },

        /**
         * Sorts LEDs by grid position
         * グリッド位置でLEDを並べ替え
         * 
         * @param {Array} leds - LEDs to sort / 並べ替えるLED
         * @param {Object} config - Sort configuration / 並べ替え設定
         * @returns {Array} Sorted LEDs / 並べ替えられたLED
         */
        sortLEDsByPosition: function(leds, config) {
            var grid = utils.createGrid(leds, config);
            var sortedLEDs = [];
            
            // Sort each column top to bottom / 各列を上から下に並べ替え
            grid.keys.forEach(function(key) {
                var column = grid.columns[key];
                column.sort(function(a, b) {
                    return b.position[1] - a.position[1]; // y-position sort
                });
                sortedLEDs = sortedLEDs.concat(column);
            });
            
            return sortedLEDs;
        }
    };

    // Public API / 公開API
    return {
        /**
         * Process parts in a layer
         * レイヤー内のパーツを処理
         * 
         * @param {Layer} layer - Target layer / ターゲットレイヤー
         * @param {Object} config - Configuration / 設定
         */
        processParts: function(layer, config) {
            return partProcessor.sortAndCategorizeParts(layer, config || {});
        },

        /**
         * Process LEDs in a layer
         * レイヤー内のLEDを処理
         * 
         * @param {Layer} layer - Target layer / ターゲットレイヤー
         * @param {Object} config - Configuration / 設定
         */
        processLEDs: function(layer, config) {
            return ledProcessor.sortAndCategorizeLEDs(layer, config || {});
        },

        /**
         * Process both parts and LEDs independently
         * パーツとLEDを個別に処理
         * 
         * @param {Layer} layer - Target layer / ターゲットレイヤー
         * @param {Object} config - Configuration / 設定
         */
        processAll: function(layer, config) {
            return {
                parts: this.processParts(layer, config),
                leds: this.processLEDs(layer, config)
            };
        }
    };
})();

// Usage example / 使用例:
/*
var config = {
    xTolerance: 20,         // X-axis grouping tolerance / X軸グループ化の許容値
    yTolerance: 10,         // Y-axis grouping tolerance / Y軸グループ化の許容値
    gridSize: 50,           // Base grid size / 基本グリッドサイズ
    sortDirection: "ttb"    // "ttb" (top-to-bottom) or "ltr" (left-to-right)
};

// Process everything / すべてを処理
var results = ItemProcessor.processAll(targetLayer, config);

// Or process independently / または個別に処理
var parts = ItemProcessor.processParts(targetLayer, config);
var leds = ItemProcessor.processLEDs(targetLayer, config);
*/