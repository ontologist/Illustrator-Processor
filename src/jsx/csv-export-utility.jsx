// CSV Export Utility for Illustrator | CSVエクスポートユーティリティ（Illustrator用）
// Compatible with ExtendScript for Adobe Illustrator | Adobe Illustrator用のExtendScriptと互換性あり

/**
 * CSVExportManager: Handles parsing log files and exporting data to CSV/Excel formats
 * CSVエクスポートマネージャー: ログファイルの解析とCSV/Excel形式へのデータエクスポートを処理
 */
var CSVExportManager = {
    _mngName: "[CSVEXPORTMGR]",
    
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
                DebugLogManager.error(this._mngName + " Log file does not exist: " + filePath + " | ログファイルが存在しません");
                return null;
            }
            
            // Set encoding to UTF-8 with proper line endings for Japanese text support
            // 日本語テキストをサポートするためにエンコーディングをUTF-8に設定
            file.encoding = "UTF-8";
            file.lineFeed = "unix";
            
            file.open("r");
            var content = file.read();
            file.close();
            
            if (!content || content === "") {
                DebugLogManager.error(this._mngName + " Log file is empty | ログファイルが空です");
                return null;
            }
            
            // Handle potential BOM in the file
            // ファイル内の潜在的なBOMを処理
            if (content.charCodeAt(0) === 0xFEFF) {
                content = content.substring(1);
            }
            
            return content;
        } catch (error) {
            DebugLogManager.error(this._mngName + " Failed to read log file: " + error.toString() + " | ログファイルの読み込みに失敗しました");
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
            DebugLogManager.info(this._mngName + " Parsing log data");
            
            var lines = logData.split(/\r\n|\r|\n/);
            var documentData = {};
            var shapeData = {};
            var allKeys = [];
            
            // First pass: extract document data and identify shape data
            // 第1パス：ドキュメントデータの抽出と形状データの識別
            for (var i = 0; i < lines.length; i++) {
                var line = lines[i];
                
                // Skip empty lines or section markers | 空行やセクションマーカーをスキップ
                if (line.trim() === "" || line.match(/^(===|---)/)) {
                    continue;
                }
                
                // Skip comment lines | コメント行をスキップ
                if (line.trim().indexOf("/*") === 0) {
                    continue;
                }
                
                // Look for key-value pairs (containing colon) | キーと値のペア（コロンを含む）を探す
                var colonIndex = line.indexOf(":");
                if (colonIndex > -1) {
                    var key = line.substring(0, colonIndex).trim();
                    var value = line.substring(colonIndex + 1).trim();
                    
                    // Check if this is shape-specific data | これが形状固有のデータかどうかを確認
                    var shapeMatch = key.match(/(Part_\w+)_(\d{3,5})$/);
                    if (shapeMatch) {
                        var baseKey = shapeMatch[1];
                        var index = shapeMatch[2];
                        
                        // Initialize shape data structure if needed | 必要に応じて形状データ構造を初期化
                        if (!shapeData[index]) {
                            shapeData[index] = {};
                        }
                        
                        // Store the data with base key | ベースキーでデータを保存
                        shapeData[index][baseKey] = value;
                        
                        // Add to known keys if new | 新しい場合は既知のキーに追加
                        if (allKeys.indexOf(baseKey) === -1) {
                            allKeys.push(baseKey);
                        }
                    } else {
                        // This is document-level data | これはドキュメントレベルのデータ
                        documentData[key] = value;
                        
                        // Add to known keys if new | 新しい場合は既知のキーに追加
                        if (allKeys.indexOf(key) === -1) {
                            allKeys.push(key);
                        }
                    }
                }
            }
            
            // Second pass: create rows | 第2パス：行を作成
            var rows = [];
            var shapeIndices = this._getObjectKeys(shapeData);
            
            if (shapeIndices.length > 0) {
                // Create one row per shape | 形状ごとに1行作成
                for (var j = 0; j < shapeIndices.length; j++) {
                    var index = shapeIndices[j];
                    var rowData = {};
                    
                    // Copy all document data | すべてのドキュメントデータをコピー
                    for (var docKey in documentData) {
                        if (documentData.hasOwnProperty(docKey)) {
                            rowData[docKey] = documentData[docKey];
                        }
                    }
                    
                    // Add shape-specific data | 形状固有のデータを追加
                    for (var shapeKey in shapeData[index]) {
                        if (shapeData[index].hasOwnProperty(shapeKey)) {
                            rowData[shapeKey] = shapeData[index][shapeKey];
                        }
                    }
                    
                    // Add shape index for reference | 参照用に形状インデックスを追加
                    rowData["ShapeIndex"] = index;
                    
                    rows.push(rowData);
                }
            } else {
                // No shapes - just create one row with document data
                // 形状なし - ドキュメントデータのみで1行作成
                rows.push(documentData);
            }
            
            // Add "ShapeIndex" to allKeys if we have shapes
            if (shapeIndices.length > 0 && allKeys.indexOf("ShapeIndex") === -1) {
                allKeys.push("ShapeIndex");
            }
            
            return {
                headers: allKeys,
                rows: rows
            };
            
        } catch (error) {
            DebugLogManager.error(this._mngName + " Failed to parse log data: " + error.toString());
            return null;
        }
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
                var line = lines[i].trim();
                
                // Look for shape section markers | 形状セクションマーカーを探す
                if (line.match(/^--- Shape \d+ ---$/)) {
                    // Start a new shape | 新しい形状を開始
                    if (currentShape !== null) {
                        shapes.push(currentShape);
                    }
                    currentShape = {
                        name: "",
                        width_mm: "",
                        height_mm: "",
                        area_mm2: "",
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
                    var key = line.substring(0, colonIndex).trim();
                    var value = line.substring(colonIndex + 1).trim();
                    
                    if (key.match(/Part_name_\d+/)) {
                        currentShape.name = value;
                    } else if (key.match(/Part_width_mm_\d+/)) {
                        currentShape.width_mm = value;
                    } else if (key.match(/Part_height_mm_\d+/)) {
                        currentShape.height_mm = value;
                    } else if (key.match(/Part_area_mmsq_\d+/)) {
                        currentShape.area_mm2 = value;
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
            
            // Write bilingual headers | バイリンガルヘッダーを書き込み
            file.writeln("ShapeName(形状名),Width_mm(幅_mm),Height_mm(高さ_mm),Area_mm2(面積_mm2),LEDCount(LED数),AssociatedLEDs(関連LED)");
            
            // Write shape data | 形状データを書き込み
            for (var j = 0; j < shapes.length; j++) {
                var shape = shapes[j];
                var line = this._escapeCSV(shape.name) + "," +
                           this._escapeCSV(shape.width_mm) + "," +
                           this._escapeCSV(shape.height_mm) + "," +
                           this._escapeCSV(shape.area_mm2) + "," +
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
    }
};

/**
 * Exports CSV files from log data with Japanese language support
 * 日本語対応でログデータからCSVファイルをエクスポート
 * 
 * @param {String} outputLogPath - Path to the output log file | 出力ログファイルへのパス
 * @param {Boolean} [addTimestamp] - Add timestamp to filenames | ファイル名にタイムスタンプを追加するかどうか
 * @returns {Boolean} Success status | 成功ステータス
 */
function exportCSVFiles(outputLogPath, addTimestamp) {
    try {
        DebugLogManager.info("[CSV EXPORT] Starting CSV export process | CSVエクスポート処理を開始します");
        
        if (!outputLogPath) {
            // Try to construct the path if not provided | パスが提供されていない場合はパスを構築する
            var doc = app.activeDocument;
            if (!doc) {
                DebugLogManager.error("[CSV EXPORT] No active document | アクティブなドキュメントがありません");
                return false;
            }
            outputLogPath = doc.path + "/" + doc.name.replace(/\.ai$/i, '') + "_output_log.txt";
        }
        
        // Verify log file exists | ログファイルが存在することを確認
        var logFile = new File(outputLogPath);
        if (!logFile.exists) {
            DebugLogManager.error("[CSV EXPORT] Output log file not found: " + outputLogPath + " | 出力ログファイルが見つかりません");
            return false;
        }
        
        // Generate timestamp for filenames if requested | 要求された場合、ファイル名用のタイムスタンプを生成
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
        
        // Determine CSV output paths | CSV出力パスを決定
        var basePath = outputLogPath.replace(/_output_log\.txt$/i, '');
        var mainCSVPath = basePath + timestamp + "_data.csv";
        var simplifiedCSVPath = basePath + timestamp + "_shapes.csv";
        
        // Export main CSV | メインCSVをエクスポート
        var mainSuccess = CSVExportManager.exportLogToCSV(
            outputLogPath, 
            mainCSVPath,
            true // create Excel-compatible version | Excel互換バージョンを作成
        );
        
        // Export simplified shape data | 簡略化された形状データをエクスポート
        var shapeSuccess = CSVExportManager.exportSimplifiedShapeData(
            outputLogPath,
            simplifiedCSVPath
        );
        
        DebugLogManager.info("[CSV EXPORT] Export complete. Main CSV: " + 
                          (mainSuccess ? "Success | 成功" : "Failed | 失敗") + 
                          ", Shape CSV: " + 
                          (shapeSuccess ? "Success | 成功" : "Failed | 失敗"));
        
        return mainSuccess && shapeSuccess;
        
    } catch (error) {
        DebugLogManager.error("[CSV EXPORT] Export process failed: " + error.toString() + " | エクスポート処理に失敗しました");
        return false;
    }
}

// Stub for DebugLogManager in case it's not defined in the environment
if (typeof DebugLogManager === 'undefined') {
    var DebugLogManager = {
        info: function(message) {
            $.writeln("[INFO] " + message);
        },
        warn: function(message) {
            $.writeln("[WARNING] " + message);
        },
        error: function(message) {
            $.writeln("[ERROR] " + message);
        }
    };
}