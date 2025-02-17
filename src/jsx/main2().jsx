/**
 * Main script for optimized LED-Part analysis
 * LED-パーツ解析の最適化メインスクリプト
 */

#target illustrator
#include "LEDAnalysisLib.jsx"

/**
 * Configuration for the analysis process
 * 解析プロセスの設定
 */
var CONFIG = {
    targetLayer: "支給データ",
    ledLayer: "LED",
    grid: {
        type: LEDAnalysisLib.GRID_TYPES.RECTANGULAR,
        cellSize: LEDAnalysisLib.CELL_SIZES.MEDIUM,
        sortDirection: LEDAnalysisLib.SORT_DIRECTIONS.TOP_TO_BOTTOM
    },
    validation: {
        enabled: true,
        strictMode: false,
        requireClosedPaths: true
    },
    overlap: {
        threshold: 0.2,
        useFallback: true,
        confidenceReport: true
    }
};

/**
 * Main processing function
 * メイン処理関数
 */
function main() {
    try {
        app.userInteractionLevel = UserInteractionLevel.DONTDISPLAYALERTS;

        // Validate document / ドキュメントを検証
        if (!app.documents.length) {
            throw new Error("No open document / 開いているドキュメントがありません");
        }

        var doc = app.activeDocument;
        var targetLayer = findLayer(doc, CONFIG.targetLayer);
        var ledLayer = findLayer(doc, CONFIG.ledLayer);
        
        if (!targetLayer) {
            throw new Error("Target layer not found / 対象レイヤーが見つかりません: " + CONFIG.targetLayer);
        }

        // Collect and validate items / アイテムを収集して検証
        //var items = collectItems(targetLayer);
        var items = LEDAnalysisLib.collectItemsFromLayers(ledLayer,targetLayer)

        // In main2.jsx, after collecting items:
        $.writeln("[DEBUG] Collected items:");
        $.writeln("  Parts: " + items.parts.length);
        $.writeln("  LEDs: " + items.leds.length);

        // Process parts with validation / パーツを検証付きで処理
        var processedParts = LEDAnalysisLib.processParts(items.parts, CONFIG);
        var hasPartValidationIssues = false;
        for (var i = 0; i < processedParts.validation.length; i++) {
            if (!processedParts.validation[i].isValid) {
                hasPartValidationIssues = true;
                break;
            }
        }
        if (hasPartValidationIssues) {
            logValidationIssues("Parts", processedParts.validation);
        }

        // Process LEDs with validation / LEDを検証付きで処理
        var processedLEDs = LEDAnalysisLib.processLEDs(items.leds, CONFIG);
        var hasLEDValidationIssues = false;
        for (var i = 0; i < processedLEDs.validation.length; i++) {
            if (!processedLEDs.validation[i].isValid) {
                hasLEDValidationIssues = true;
                break;
            }
        }
        if (hasLEDValidationIssues) {
            logValidationIssues("LEDs", processedLEDs.validation);
        }

        $.writeln("[DEBUG] Processed items:");
        $.writeln("  Parts: " + processedParts.parts.length);
        $.writeln("  LEDs: " + processedLEDs.leds.length);

        // Analyze overlaps with confidence / 信頼度付きで重なりを解析
        var overlapResults = LEDAnalysisLib.analyzeOverlap({
            parts: processedParts.parts,
            leds: processedLEDs.leds,
            config: CONFIG
        });

        // Generate comprehensive report / 総合的なレポートを生成
        generateReport(overlapResults, doc.path);

        // Show summary / サマリーを表示
        showSummary(overlapResults, processedParts.parts.length, processedLEDs.leds.length);

        return overlapResults;

    } catch (e) {
        alert("Error / エラー: " + e.message);
        return null;
    } finally {
        app.userInteractionLevel = UserInteractionLevel.DISPLAYALERTS;
    }
}

/**
 * Finds layer by name
 * 名前でレイヤーを検索
 */
function findLayer(doc, name) {
    for (var i = 0; i < doc.layers.length; i++) {
        if (doc.layers[i].name === name) {
            return doc.layers[i];
        }
    }
    return null;
}

/**
 * Collects items from layer
 * レイヤーからアイテムを収集
 */
function collectItems(layer) {
    var parts = [];
    var leds = [];

    for (var i = 0; i < layer.pageItems.length; i++) {
        var item = layer.pageItems[i];
        if (item.typename === "PathItem" || item.typename === "CompoundPathItem") {
            parts.push(item);
        } else if (item.typename === "GroupItem") {
            leds.push(item);
        }
    }

    return { parts: parts, leds: leds };
}

/**
 * Logs validation issues
 * 検証の問題を記録
 */
function logValidationIssues(type, validations) {
    $.writeln("\nValidation issues found in " + type + ":");
    for (var i = 0; i < validations.length; i++) {
        var validation = validations[i];
        if (!validation.isValid) {
            $.writeln("Item " + i + ":");
            for (var j = 0; j < validation.messages.length; j++) {
                $.writeln("  - " + validation.messages[j]);
            }
        }
    }
}

/**
 * Gets formatted timestamp
 * フォーマット済みのタイムスタンプを取得
 */
function getFormattedTimestamp() {
    var now = new Date();
    return now.getFullYear() + "-" +
           padNumber(now.getMonth() + 1) + "-" +
           padNumber(now.getDate()) + " " +
           padNumber(now.getHours()) + ":" +
           padNumber(now.getMinutes()) + ":" +
           padNumber(now.getSeconds());
}

/**
 * Pads number with leading zero
 * 数字の前にゼロを追加
 */
function padNumber(num) {
    return (num < 10 ? "0" : "") + num;
}

/**
 * Generates comprehensive report
 * 総合的なレポートを生成
 */
function generateReport(results, basePath) {
    var report = {
        timestamp: getFormattedTimestamp(),
        summary: {
            totalParts: results.assignments.length,
            totalLEDs: countTotalAssignedLEDs(results.assignments),
            unassignedLEDs: results.unassignedLEDs.length
        },
        assignments: []
    };

    // Process assignments / 割り当てを処理
    for (var i = 0; i < results.assignments.length; i++) {
        var assignment = results.assignments[i];
        var assignmentReport = {
            part: assignment.part.name,
            leds: []
        };

        for (var j = 0; j < assignment.leds.length; j++) {
            var led = assignment.leds[j];
            var ledReport = {
                name: led.led.name,
                overlapPercentage: led.overlapPercentage,
                isFallback: led.isFallback || false
            };

            if (CONFIG.overlap.confidenceReport) {
                var confidence = LEDAnalysisLib.calculateOverlapConfidence(
                    LEDAnalysisLib.getLEDVertices(led.led),
                    LEDAnalysisLib.getPartVertices(assignment.part)
                );
                ledReport.confidence = LEDAnalysisLib.generateOverlapReport(confidence);
            }

            assignmentReport.leds.push(ledReport);
        }

        report.assignments.push(assignmentReport);
    }

    // Write report to file / レポートをファイルに書き込み
    var reportFile = new File(basePath + "/led_analysis_report.json");
    reportFile.open('w');
    reportFile.write(stringifyJSON(report));
    reportFile.close();

    return report;
}

/**
 * Counts total assigned LEDs
 * 割り当て済みLEDの合計を数える
 */
function countTotalAssignedLEDs(assignments) {
    var total = 0;
    for (var i = 0; i < assignments.length; i++) {
        total += assignments[i].leds.length;
    }
    return total;
}

/**
 * Stringifies object to JSON
 * オブジェクトをJSONに変換
 */
function stringifyJSON(obj, indent) {
    indent = indent || "";
    var type = typeof obj;
    
    if (type === "undefined" || obj === null) {
        return "null";
    } else if (type === "number" || type === "boolean") {
        return String(obj);
    } else if (type === "string") {
        return '"' + obj.replace(/"/g, '\\"') + '"';
    } else if (obj instanceof Array) {
        var items = [];
        for (var i = 0; i < obj.length; i++) {
            items.push(stringifyJSON(obj[i], indent + "  "));
        }
        return "[\n" + indent + "  " + items.join(",\n" + indent + "  ") + "\n" + indent + "]";
    } else if (type === "object") {
        var items = [];
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                items.push('"' + key + '": ' + stringifyJSON(obj[key], indent + "  "));
            }
        }
        return "{\n" + indent + "  " + items.join(",\n" + indent + "  ") + "\n" + indent + "}";
    }
    return "null";
}

/**
 * Shows analysis summary
 * 解析サマリーを表示
 */
function showSummary(results, totalParts, totalLEDs) {
    var message = "Analysis Complete / 解析完了\n\n";
    
    message += "Total Parts Found / 検出された合計パーツ数: " + totalParts + "\n";
    message += "Parts with Assignments / 割り当てのあるパーツ数: " + results.assignments.length + "\n";
    
    var assignedLEDs = countTotalAssignedLEDs(results.assignments);
    var fallbackCount = 0;
    
    // Count how many are fallback assignments
    for (var i = 0; i < results.assignments.length; i++) {
        for (var j = 0; j < results.assignments[i].leds.length; j++) {
            if (results.assignments[i].leds[j].isFallback) {
                fallbackCount++;
            }
        }
    }
    
    message += "Total LEDs Found / 検出された合計LED数: " + totalLEDs + "\n";
    message += "Assigned LEDs / 割り当て済みLED: " + assignedLEDs + "\n";
    message += "  Normal Assignments / 通常割り当て: " + (assignedLEDs - fallbackCount) + "\n";
    message += "  Fallback Assignments / フォールバック割り当て: " + fallbackCount + "\n";
    message += "Unassigned LEDs / 未割り当てLED: " + results.unassignedLEDs.length + "\n";
    
    alert(message);
}

// Execute main / メイン実行
main();