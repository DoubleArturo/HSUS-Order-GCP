/**
 * @fileoverview Local TypeScript migration of BOL Entry Tool GAS logic.
 * Includes Mocks for Google Apps Script services (SpreadsheetApp, CacheService, etc.).
 */

// ==========================================
// 1. MOCK INFRASTRUCTURE
// ==========================================

const mockCacheStorage: { [key: string]: string } = {};

const CacheService = {
    getScriptCache: () => ({
        get: (key: string) => mockCacheStorage[key] || null,
        put: (key: string, value: string, expirationInSeconds?: number) => {
            mockCacheStorage[key] = value;
            // In a real mock we might handle expiration, but for now we ignore it.
        },
        remove: (key: string) => {
            delete mockCacheStorage[key];
        },
    }),
};

class MockRange {
    private sheet: MockSheet;
    private startRow: number;
    private startCol: number;
    private numRows: number;
    private numCols: number;

    constructor(sheet: MockSheet, row: number, col: number, numRows: number, numCols: number) {
        this.sheet = sheet;
        this.startRow = row;
        this.startCol = col;
        this.numRows = numRows;
        this.numCols = numCols;
    }

    getValues(): any[][] {
        const data: any[][] = [];
        for (let i = 0; i < this.numRows; i++) {
            const rowData = [];
            for (let j = 0; j < this.numCols; j++) {
                const r = this.startRow + i - 1; // 0-indexed in array
                const c = this.startCol + j - 1; // 0-indexed in array
                rowData.push(this.sheet._data[r] ? this.sheet._data[r][c] : '');
            }
            data.push(rowData);
        }
        return data;
    }

    setValue(value: any) {
        // Set single value for the whole range or top-left (implied simple set)
        // For this migration, we usually set specific cells.
        if (this.sheet._data[this.startRow - 1]) {
            this.sheet._data[this.startRow - 1][this.startCol - 1] = value;
        }
    }

    setValues(values: any[][]) {
        for (let i = 0; i < values.length; i++) {
            const r = this.startRow + i - 1;
            if (!this.sheet._data[r]) this.sheet._data[r] = [];
            for (let j = 0; j < values[i].length; j++) {
                const c = this.startCol + j - 1;
                this.sheet._data[r][c] = values[i][j];
            }
        }
    }
}

class MockSheet {
    name: string;
    _data: any[][];

    constructor(name: string, data: any[][]) {
        this.name = name;
        this._data = data;
    }

    getName() { return this.name; }

    getLastRow() {
        return this._data.length;
    }

    getRange(rowOrA1: number | string, col?: number, numRows?: number, numCols?: number): MockRange {
        if (typeof rowOrA1 === 'string') {
            // Very basic A1 notation parser for A2:G{lastRow} or C2:C{lastRow}
            // Assuming simple cases used in script: 'A2:G...', 'C2:G...', 'C2:C...'
            // We will cheat and look at our data dimensions or arguments used in the script.
            // For this specific script, we can mostly infer or just return the whole data block if needed,
            // but let's try to be slightly precise.

            const parts = rowOrA1.split(':');
            const start = parts[0];
            // Parse 'A2'
            const startColChar = start.charAt(0);
            const startRowStr = start.substring(1);

            const startRow = parseInt(startRowStr, 10);
            const startCol = startColChar.charCodeAt(0) - 'A'.charCodeAt(0) + 1;

            // Calculate end if exists
            let endRow = this.getLastRow();
            let endCol = this._data[0]?.length || 1;

            if (parts.length > 1) {
                const end = parts[1];
                // matches G + number
                const match = end.match(/([A-Z]+)(\d+)?/);
                if (match) {
                    const endColChar = match[1];
                    endCol = endColChar.charCodeAt(0) - 'A'.charCodeAt(0) + 1;
                    if (match[2]) {
                        endRow = parseInt(match[2], 10);
                    }
                }
            }

            const rows = endRow - startRow + 1;
            const cols = endCol - startCol + 1;

            return new MockRange(this, startRow, startCol, rows > 0 ? rows : 1, cols);
        }

        // Numeric arguments
        return new MockRange(this, rowOrA1, col!, numRows || 1, numCols || 1);
    }

    getDataRange(): MockRange {
        return new MockRange(this, 1, 1, this.getLastRow(), this._data[0]?.length || 1);
    }

    deleteRow(rowPos: number) {
        this._data.splice(rowPos - 1, 1);
    }
}

const mockSheets: { [key: string]: MockSheet } = {};

const SpreadsheetApp = {
    getActiveSpreadsheet: () => ({
        getSheetByName: (name: string) => mockSheets[name] || null,
    }),
    flush: () => {
        // console.log("SpreadsheetApp.flush() called");
    },
    getUi: () => ({
        alert: (title: string, msg: string) => console.log(`[UI ALERT] ${title}: ${msg}`),
        ButtonSet: { OK: 'OK' },
        showSidebar: () => console.log('[UI] showSidebar called')
    }),
};

const Utilities = {
    formatDate: (date: Date, tz: string, format: string) => {
        return date.toISOString().split('T')[0]; // Simple mock for yyyy-MM-dd
    }
};

const Session = {
    getScriptTimeZone: () => "GMT"
};

const HtmlService = {
    createTemplateFromFile: () => ({
        evaluate: () => ({
            setTitle: () => ({})
        })
    })
};

// Mock Helper function from SharedUtils.gs
function getPoSkuKeyModelMap(): Map<string, string> {
    const map = new Map<string, string>();
    map.set('PO123|SKU001', 'Test Model X');
    map.set('PO456|SKU002', 'Test Model Y');
    return map;
}

// ==========================================
// 2. MOCK DATA INITIALIZATION
// ==========================================

function resetMockData() {
    // Planning Sheet: Columns A-G (0-6)
    // A: Timestamp, C: PO|SKU Key (index 2), G: Status (index 6)
    const planningData = [
        ['Timestamp', 'ColB', 'Key', 'ColD', 'ActShipDate', 'ColF', 'Status'], // Header ROW 1
        [new Date('2023-01-01'), 'B', 'PO123|SKU001', 'D', '', 'F', 'Pending'], // ROW 2
        [new Date('2023-01-05'), 'B', 'PO456|SKU002', 'D', 'Fulfilled', 'F', 'Fulfilled'], // ROW 3
    ];

    // BOL DB: Columns A-F (0-5)
    // A: Bol#, B: PO|SKU Key, C: Qty, D: Fee, E: ActShipDate, F: Signed
    const bolData = [
        ['BOL#', 'PO|SKU Key', 'Qty', 'Fee', 'ActShipDate', 'Signed'], // Header
        ['BOL-001', 'PO456|SKU002', 100, 50.0, new Date('2023-01-05'), true]
    ];

    mockSheets['Shipment_Planning_DB'] = new MockSheet('Shipment_Planning_DB', planningData);
    mockSheets['BOL_DB'] = new MockSheet('BOL_DB', bolData);

    // Clear cache
    for (const k in mockCacheStorage) delete mockCacheStorage[k];
}


// ==========================================
// 3. ADAPTED GAS CODE
// ==========================================
// Replacements: Logger.log -> console.log

const BOL_SHEET_NAME = 'BOL_DB';
const PLANNING_SHEET_NAME = 'Shipment_Planning_DB';
const CACHE_KEY_PENDING = 'pendingBolData';
const CACHE_KEY_FULFILLED = 'fulfilledBolData';

function openBolEntryTool() {
    const html = HtmlService.createTemplateFromFile('BolEntryTool')
        .evaluate()
        .setTitle('BOL Entry Tool');
    SpreadsheetApp.getUi().showSidebar(html);
}

function getInitialBolData() {
    try {
        console.log('--- Starting getInitialBolData() [V12.9 - Unified Source] ---');

        const cache = CacheService.getScriptCache();
        const cachedPending = cache.get(CACHE_KEY_PENDING);
        const cachedFulfilled = cache.get(CACHE_KEY_FULFILLED);

        if (cachedPending != null && cachedFulfilled != null) {
            console.log('[CHECKPOINT C] Returning RAW STRING data from cache.');
            const payload = {
                success: true,
                pendingList: JSON.parse(cachedPending),
                fulfilledList: JSON.parse(cachedFulfilled)
            };
            return JSON.stringify(payload);
        }

        console.log('[CHECKPOINT D] Cache miss. Reading data...');
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const planningSheet = ss.getSheetByName(PLANNING_SHEET_NAME);
        if (!planningSheet) throw new Error(`Sheet '${PLANNING_SHEET_NAME}' not found.`);

        // --- 🚀 [V12.9 關鍵修改] ---
        // 呼叫來自 SharedUtils.gs 的新函式
        const poSkuKeyModelMap = getPoSkuKeyModelMap();
        console.log('[CHECKPOINT D.1] PO|SKU -> Model Map created.');
        // --- [修改結束] ---

        const lastRow = planningSheet.getLastRow();
        if (lastRow < 2) {
            console.log('INFO: Sheet is empty, returning empty lists.');
            cache.put(CACHE_KEY_PENDING, '[]', 300);
            cache.put(CACHE_KEY_FULFILLED, '[]', 300);
            return JSON.stringify({ success: true, pendingList: [], fulfilledList: [] });
        }

        const dataRange = planningSheet.getRange('A2:G' + lastRow);
        const planningData = dataRange.getValues();

        const pendingMap = new Map();
        const fulfilledList: any[] = [];

        console.log('[CHECKPOINT E] Processing ' + planningData.length + ' rows.');

        planningData.forEach(row => {
            const timestamp = row[0]; // Column A
            const key = String(row[2] || '');       // Column C
            const status = row[6];    // Column G

            if (key) {
                // --- 🚀 [V12.9 關鍵修改] ---
                // 直接用 PO_SKU_Key 查詢 Map
                const modelName = poSkuKeyModelMap.get(key) || 'Model N/A'; // 備援
                const display = `${key} (${modelName})`;
                // --- [修改結束] ---

                if (status === 'Fulfilled') {
                    const validTimestampString = (timestamp instanceof Date && !isNaN(timestamp.getTime()))
                        ? timestamp.toISOString()
                        : new Date(0).toISOString();
                    fulfilledList.push({ key: key, display: display, timestamp: validTimestampString });
                } else {
                    if (!pendingMap.has(key)) {
                        pendingMap.set(key, { key: key, display: display });
                    }
                }
            }
        });

        console.log('[CHECKPOINT E.1] Sorting lists...');
        fulfilledList.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        const uniquePendingList = [...pendingMap.values()].sort((a, b) => a.display.localeCompare(b.display));

        const serializableFulfilledList = fulfilledList.map(item => ({ key: item.key, display: item.display }));

        console.log('[CHECKPOINT F] Writing results back to cache.');
        cache.put(CACHE_KEY_PENDING, JSON.stringify(uniquePendingList), 300);
        cache.put(CACHE_KEY_FULFILLED, JSON.stringify(serializableFulfilledList), 300);

        const payload = {
            success: true,
            pendingList: uniquePendingList,
            fulfilledList: serializableFulfilledList
        };

        console.log('[CHECKPOINT G] Payload constructed. Forcing serialization NOW...');
        const stringPayload = JSON.stringify(payload);
        console.log('[CHECKPOINT G.1] Serialization successful. Returning safe string.');
        return stringPayload;

    } catch (e: any) {
        console.log(`[ERROR H] getInitialBolData FAILED: ${e.message}\n${e.stack}`);
        return JSON.stringify({ success: false, message: `getInitialBolData Error: ${e.message}` });
    }
}

function getExistingBolData(poSkuKey: string) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const bolSheet = ss.getSheetByName(BOL_SHEET_NAME);
        if (!bolSheet) throw new Error(`Sheet '${BOL_SHEET_NAME}' not found.`);
        const lastRow = bolSheet.getLastRow();
        if (lastRow < 2) return { success: true, bols: [], actShipDate: null, isFulfilled: false };
        const data = bolSheet.getRange('A2:F' + lastRow).getValues();
        const existingBols: any[] = [];
        let actShipDate = null;
        data.forEach(row => {
            if (row[1] === poSkuKey) {
                if (!actShipDate && row[4] instanceof Date) {
                    actShipDate = Utilities.formatDate(row[4], Session.getScriptTimeZone(), "yyyy-MM-dd");
                }
                existingBols.push({
                    bolNumber: row[0],
                    shippedQty: row[2],
                    shippingFee: row[3],
                    signed: row[5]
                });
            }
        });
        const planningSheet = ss.getSheetByName(PLANNING_SHEET_NAME);
        const planningData = planningSheet.getRange('C2:G' + planningSheet.getLastRow()).getValues();

        // In original code: row[0] is C (Key), row[4] is G (Status)
        const isFulfilled = planningData.some(row => row[0] === poSkuKey && row[4] === 'Fulfilled');
        return { success: true, bols: existingBols, actShipDate: actShipDate, isFulfilled: isFulfilled };
    } catch (e: any) {
        console.log(`getExistingBolData Error: ${e.message}`);
        return { success: false, message: e.toString() };
    }
}

function saveBolData(data: any) {
    try {
        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const bolSheet = ss.getSheetByName(BOL_SHEET_NAME);
        if (!bolSheet) throw new Error(`Sheet '${BOL_SHEET_NAME}' not found`);
        const poSkuKey = data.poSkuKey;
        if (!poSkuKey) throw new Error("PO|SKU Key is missing.");
        const dataRange = bolSheet.getDataRange();
        const allData = dataRange.getValues();
        const rowsToDelete: number[] = [];

        // allData includes headers, so index 0 is header.
        allData.forEach((row, index) => {
            if (index > 0 && row[1] === poSkuKey) {
                rowsToDelete.push(index + 1); // 1-based index
            }
        });

        // Reverse loop to delete safely
        for (let i = rowsToDelete.length - 1; i >= 0; i--) {
            bolSheet.deleteRow(rowsToDelete[i]);
        }

        const actShipDate = new Date(data.actShipDate);
        const newStatus = data.isFulfilled ? 'Fulfilled' : '';
        const timestamp = new Date();
        const newRows: any[] = [];
        data.bols.forEach((bol: any) => {
            const shippedQty = parseInt(bol.shippedQty, 10);
            const shippingFee = parseFloat(bol.shippingFee);
            if (bol.bolNumber && shippedQty > 0) {
                newRows.push([
                    bol.bolNumber, poSkuKey, shippedQty,
                    isNaN(shippingFee) ? 0 : shippingFee,
                    actShipDate, bol.signed,
                    newStatus, timestamp
                ]);
            }
        });
        if (newRows.length > 0) {
            // In real GAS this appends, but our mock setValues logic is simple.
            // We will just push to underlining data for the mock
            const startRow = bolSheet.getLastRow() + 1;
            // We need to extend the mock data array
            const sheetData = bolSheet._data;
            for (const row of newRows) {
                sheetData.push(row);
            }
        }
        updateFulfillmentStatus(poSkuKey, newStatus, timestamp);
        SpreadsheetApp.flush();
        const cache = CacheService.getScriptCache();
        cache.remove(CACHE_KEY_PENDING);
        cache.remove(CACHE_KEY_FULFILLED);
        return { success: true, message: `Successfully saved for '${poSkuKey}'.` };
    } catch (e: any) {
        console.log(`saveBolData Error: ${e.message}\n${e.stack}`);
        return { success: false, message: e.toString() };
    }
}

function updateFulfillmentStatus(keyToUpdate: string, status: string, timestamp: Date) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const planningSheet = ss.getSheetByName(PLANNING_SHEET_NAME);
    if (!planningSheet) return;
    const lastRow = planningSheet.getLastRow();
    if (lastRow < 2) return;
    const keys = planningSheet.getRange('C2:C' + lastRow).getValues();
    for (let i = 0; i < keys.length; i++) {
        if (keys[i][0] === keyToUpdate) {
            const targetRow = i + 2;
            // planningSheet.getRange(targetRow, 1).setValue(timestamp); 
            // planningSheet.getRange(targetRow, 7).setValue(status);

            // Update mock directly
            const rowIdx = targetRow - 1; // 0-indexed
            planningSheet._data[rowIdx][0] = timestamp; // Column A is 0
            planningSheet._data[rowIdx][6] = status;    // Column G is 6
            break;
        }
    }
}

function clearBolCache_Manual() {
    const cache = CacheService.getScriptCache();
    cache.remove('pendingBolData');
    cache.remove('fulfilledBolData');
    SpreadsheetApp.getUi().alert(
        'BOL Tool Cache Cleared!',
        'The cache for the BOL Entry Tool has been successfully cleared. Please close and re-open the tool.',
        SpreadsheetApp.getUi().ButtonSet.OK
    );
    console.log('BOL Tool cache (pendingBolData, fulfilledBolData) has been manually cleared.');
}

// ==========================================
// 4. TEST EXECUTION
// ==========================================

async function runTests() {
    console.log('=== INITIALIZING MOCKS ===');
    resetMockData();

    console.log('\n=== TEST 1: getInitialBolData ===');
    const initialDataRaw = getInitialBolData();
    const initialData = JSON.parse(initialDataRaw);
    console.log('Success:', initialData.success);
    console.log('Pending List:', initialData.pendingList);
    console.log('Fulfilled List:', initialData.fulfilledList);

    console.log('\n=== TEST 2: getExistingBolData (Fulfilled Item) ===');
    const existing = getExistingBolData('PO456|SKU002');
    console.log('Existing Data:', existing);

    console.log('\n=== TEST 3: saveBolData (New Entry) ===');
    const savePayload = {
        poSkuKey: 'PO123|SKU001',
        actShipDate: '2023-01-10',
        isFulfilled: true,
        bols: [
            { bolNumber: 'NEW-BOL-999', shippedQty: '500', shippingFee: '100', signed: false }
        ]
    };
    const saveResult = saveBolData(savePayload);
    console.log('Save Result:', saveResult);

    console.log('\n=== TEST 4: Verify Update in Planning Sheet ===');
    // Check if status changed to Fulfilled in mock sheet
    const sheet = mockSheets['Shipment_Planning_DB'];
    // Row 2 is PO123|SKU001
    console.log('Row 2 Status (Expected "Fulfilled"):', sheet._data[1][6]);
    console.log('Row 2 Timestamp Updated:', sheet._data[1][0]);

    console.log('\n=== TEST 5: Verify Cache Cleared ===');
    const cache = CacheService.getScriptCache();
    console.log('Pending Cache (Expected null):', cache.get(CACHE_KEY_PENDING));

}

runTests();
