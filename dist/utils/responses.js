export const ok = (res, data, message = null) => {
    const payload = { success: true, message, data, error: null };
    res.status(200).json(payload);
};
export const created = (res, data, message = null) => {
    const payload = { success: true, message, data, error: null };
    res.status(201).json(payload);
};
