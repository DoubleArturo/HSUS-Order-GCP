/**
 * @fileoverview Migration Test Entry Point
 * Uses BolService to verify database interactions.
 */

import dotenv from 'dotenv';
import { pool } from '../config/db.js';
import { BolService } from '../services/BolService.js';

dotenv.config();

async function runTests() {
    try {
        console.log('\n=== TEST 1: getInitialBolData (BolService) ===');
        const initialDataRaw = await BolService.getInitialBolData();
        const initialData = JSON.parse(initialDataRaw);

        console.log('Success:', initialData.success);
        console.log(`Pending List (${initialData.pendingList?.length || 0}):`, initialData.pendingList);
        console.log(`Fulfilled List (${initialData.fulfilledList?.length || 0}):`, initialData.fulfilledList);


        console.log('\n=== TEST 2: getExistingBolData (BolService) ===');
        const existingData = await BolService.getExistingBolData('PO-TEST-002');
        console.log('Existing Data Result:', existingData.success);


        console.log('\n=== TEST 3: saveBolData (BolService - Transaction) ===');
        // Scenario: Mark PO-TEST-001 as Shipped with 1 BOL.
        const savePayload = {
            poSkuKey: 'PO-TEST-001',
            actShipDate: '2026-01-08',
            isFulfilled: true,
            bols: [
                { bolNumber: 'TRACK-999-XYZ', shippedQty: '15', shippingFee: '0', signed: false }
            ]
        };
        const saveResult = await BolService.saveBolData(savePayload);
        console.log('Save Result:', saveResult);

        // Verify changes
        console.log('\n=== TEST 3.1: Verify PO-TEST-001 Updated ===');
        const verifyData = await BolService.getExistingBolData('PO-TEST-001');
        console.log('Updated Data:', JSON.stringify(verifyData, null, 2));


    } catch (err) {
        console.error('Test Execution Failed:', err);
    } finally {
        await pool.end();
    }
}

runTests();
