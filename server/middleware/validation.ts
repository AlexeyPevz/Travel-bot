import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { fromZodError } from 'zod-validation-error';
import logger from '../utils/logger';

export class ValidationError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'ValidationError';
	}
}

declare global {
	namespace Express {
		interface Request {
			validated?: {
				body?: any;
				query?: any;
				params?: any;
			};
		}
	}
}

interface ValidationOptions {
	mode?: 'strict' | 'strip';
	statusCode?: number;
	errorLabel?: string; // default 'Validation failed'
	detailsMode?: 'array' | 'object'; // default 'array'
	transformQuery?: boolean; // default false
}

function normalizeMessage(message: string): string {
	return message.replace('character(s)', 'characters');
}

function mapZodErrors(error: z.ZodError) {
	return (error.errors || []).map(err => ({
		field: err.path.join('.'),
		message: normalizeMessage(err.message)
	}));
}

function formatDetails(error: z.ZodError, mode: 'array' | 'object') {
	if (mode === 'object') {
		const msg = normalizeMessage(fromZodError(error, {
			prefix: 'Validation failed',
			prefixSeparator: ': ',
			issueSeparator: '; '
		}).message);
		return { message: msg, errors: mapZodErrors(error) };
	}
	return mapZodErrors(error);
}

function hasCircularReference(value: any, seen: WeakSet<object> = new WeakSet()): boolean {
	if (value && typeof value === 'object') {
		if (seen.has(value)) return true;
		seen.add(value);
		for (const key of Object.keys(value)) {
			if (hasCircularReference((value as any)[key], seen)) return true;
		}
		seen.delete(value);
	}
	return false;
}

export function validateBody<T>(
	schema: z.ZodType<any, z.ZodTypeDef, any>,
	options: ValidationOptions = {}
) {
	const { mode = 'strip', statusCode = 400, errorLabel = 'Validation failed', detailsMode = 'array' } = options;
	return async (req: Request, res: Response, next: NextFunction) => {
		try {
			if (req.body && typeof req.body === 'object' && hasCircularReference(req.body)) {
				return res.status(statusCode).json({ error: errorLabel, details: [{ field: '', message: 'Circular structure is not allowed' }] });
			}
			const parseMethod = mode === 'strict' ? 'parse' : 'parseAsync';
			const validated = await (schema as any)[parseMethod](req.body);
			req.body = validated;
			const container = (req.validated = (req.validated ?? {}) as any);
			container.body = validated;
			logger.debug('Body validation passed', { path: req.path, method: req.method });
			next();
		} catch (error) {
			if (error instanceof z.ZodError) {
				return res.status(statusCode).json({ error: errorLabel, details: formatDetails(error, detailsMode) });
			}
			return res.status(400).json({ error: errorLabel, details: { message: 'Validation failed' } });
		}
	};
}

export function validateQuery<T>(
	schema: z.ZodType<any, z.ZodTypeDef, any>,
	options: ValidationOptions = {}
) {
	const { mode = 'strip', statusCode = 400, errorLabel = 'Validation failed', detailsMode = 'array', transformQuery = false } = options;
	return async (req: Request, res: Response, next: NextFunction) => {
		try {
			const transformedQuery = transformQuery ? transformQueryParams(req.query) : req.query;
			const parseMethod = mode === 'strict' ? 'parse' : 'parseAsync';
			const validated = await (schema as any)[parseMethod](transformedQuery);
			req.query = validated as any;
			const container = (req.validated = (req.validated ?? {}) as any);
			container.query = validated;
			logger.debug('Query validation passed', { path: req.path, method: req.method });
			next();
		} catch (error) {
			if (error instanceof z.ZodError) {
				return res.status(statusCode).json({ error: errorLabel, details: formatDetails(error, detailsMode) });
			}
			return res.status(400).json({ error: errorLabel, details: { message: 'Validation failed' } });
		}
	};
}

export function validateParams<T>(
	schema: z.ZodType<any, z.ZodTypeDef, any>,
	options: ValidationOptions = {}
) {
	const { mode = 'strip', statusCode = 400, errorLabel = 'Validation failed', detailsMode = 'array' } = options;
	return async (req: Request, res: Response, next: NextFunction) => {
		try {
			const parseMethod = mode === 'strict' ? 'parse' : 'parseAsync';
			const validated = await (schema as any)[parseMethod](req.params);
			req.params = validated as any;
			const container = (req.validated = (req.validated ?? {}) as any);
			container.params = validated;
			logger.debug('Params validation passed', { path: req.path, method: req.method });
			next();
		} catch (error) {
			if (error instanceof z.ZodError) {
				return res.status(statusCode).json({ error: errorLabel, details: formatDetails(error, detailsMode) });
			}
			return res.status(400).json({ error: errorLabel, details: { message: 'Validation failed' } });
		}
	};
}

interface ValidateAllOptions extends ValidationOptions {
	body?: z.ZodType<any, z.ZodTypeDef, any>;
	query?: z.ZodType<any, z.ZodTypeDef, any>;
	params?: z.ZodType<any, z.ZodTypeDef, any>;
}

export function validateAll(options: ValidateAllOptions) {
	const middlewares: Array<(req: Request, res: Response, next: NextFunction) => any> = [];
	if (options.body) middlewares.push(validateBody(options.body, options));
	if (options.query) middlewares.push(validateQuery(options.query, options));
	if (options.params) middlewares.push(validateParams(options.params, options));
	return async (req: Request, res: Response, next: NextFunction) => {
		for (const m of middlewares) {
			let calledNext = false;
			await m(req, res, (err?: any) => {
				calledNext = true;
				if (err) next(err);
			});
			if (!calledNext) {
				return;
			}
		}
		next();
	};
}

function transformQueryParams(query: any): any {
	const transformed: any = {};
	for (const [key, value] of Object.entries(query)) {
		if (typeof value !== 'string') { transformed[key] = value; continue; }
		if (/^\d+$/.test(value)) transformed[key] = parseInt(value, 10);
		else if (/^\d+\.\d+$/.test(value)) transformed[key] = parseFloat(value);
		else if (value === 'true') transformed[key] = true;
		else if (value === 'false') transformed[key] = false;
		else if (value.includes(',')) transformed[key] = value.split(',').map(v => v.trim());
		else transformed[key] = value;
	}
	return transformed;
}

type HandlerSchemas = {
	body?: z.ZodType<any, z.ZodTypeDef, any>;
	query?: z.ZodType<any, z.ZodTypeDef, any>;
	params?: z.ZodType<any, z.ZodTypeDef, any>;
};

export function createValidatedHandler<TBody = any, TQuery = any, TParams = any>(
	optionsOrSchema: HandlerSchemas | z.ZodType<any, z.ZodTypeDef, any>,
	handler: (
		req: Request & { body: TBody; query: TQuery; params: TParams; },
		res: Response,
		next: NextFunction
	) => Promise<void> | void
) {
	if (typeof (optionsOrSchema as any)?.parse === 'function' || typeof (optionsOrSchema as any)?.safeParse === 'function') {
		const combinedSchema = optionsOrSchema as z.ZodType<any, z.ZodTypeDef, any>;
		return async (req: Request, res: Response, next: NextFunction) => {
			try {
				const parsed = await (combinedSchema as any).parseAsync({ body: req.body, query: req.query, params: req.params });
				const container = (req.validated = (req.validated ?? {}) as any);
				if (parsed.body !== undefined) { req.body = parsed.body; container.body = parsed.body; }
				if (parsed.query !== undefined) { req.query = parsed.query; container.query = parsed.query; }
				if (parsed.params !== undefined) { req.params = parsed.params; container.params = parsed.params; }
				await handler(req as any, res, next);
			} catch (error) {
				if (error instanceof z.ZodError) {
					return res.status(400).json({ error: 'Validation failed', details: mapZodErrors(error) });
				}
				return next(error);
			}
		};
	}

	const options = optionsOrSchema as HandlerSchemas;
	const middleware = validateAll(options as any);
	return async (req: Request, res: Response, next: NextFunction) => {
		await middleware(req, res, () => {});
		if (!res) return; // no-op guard
		await handler(req as any, res, next);
	};
}

export type ValidatedRequest<TBody = any, TQuery = any, TParams = any> = Request & {
	body: TBody;
	query: TQuery;
	params: TParams;
	validated: { body: TBody; query: TQuery; params: TParams; };
};