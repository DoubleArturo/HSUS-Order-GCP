import { Response } from 'express';

type SuccessPayload<T> = {
  success: true;
  message: string | null;
  data: T;
  error: null;
};

export const ok = <T>(res: Response, data: T, message: string | null = null): void => {
  const payload: SuccessPayload<T> = { success: true, message, data, error: null };
  res.status(200).json(payload);
};

export const created = <T>(
  res: Response,
  data: T,
  message: string | null = null,
): void => {
  const payload: SuccessPayload<T> = { success: true, message, data, error: null };
  res.status(201).json(payload);
};
