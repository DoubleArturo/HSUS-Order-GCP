import { Request, Response, NextFunction } from 'express';
import { ok, created } from '../utils/responses.js';
import { BolService } from '../services/BolService.js';
import { AppError } from '../utils/errors.js';

export const getInitialData = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const dataRaw = await BolService.getInitialBolData();
        const data = JSON.parse(dataRaw);
        ok(res, data);
    } catch (err) {
        next(err);
    }
};

export const getExistingData = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const { poSkuKey } = req.params;
        if (!poSkuKey) {
            throw new AppError('PO/SKU Key is required', 400, 'BAD_REQUEST');
        }
        const data = await BolService.getExistingBolData(poSkuKey);
        ok(res, data);
    } catch (err) {
        next(err);
    }
};

export const saveData = async (
    req: Request,
    res: Response,
    next: NextFunction,
): Promise<void> => {
    try {
        const payload = req.body;
        const result = await BolService.saveBolData(payload);

        // Check internal success flag from Service logic
        if (!result.success) {
            throw new AppError(result.message || 'Save failed', 400, 'SAVE_FAILED');
        }

        created(res, { success: true });
    } catch (err) {
        next(err);
    }
};
