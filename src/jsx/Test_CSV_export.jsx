#target illustrator

// Include the utility
#include "csv-export-utility.jsx"

// Auto-find output logs for the current document
function runExport() {
    try {
        if (app.documents.length === 0) {
            alert("Please open a document first");
            return;
        }
        
        var doc = app.activeDocument;
        var logPath = doc.path + "/" + doc.name.replace(/\.ai$/i, '') + "_output_log.txt";
        
        var result = exportCSVFiles(logPath);
        alert("CSV Export " + (result ? "succeeded!" : "failed!"));
    } catch(e) {
        alert("Error: " + e.toString());
    }
}

runExport();