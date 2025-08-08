import { errorHandler } from '../../server/middleware/errorHandler';
import { AppError } from '../../server/utils/errors';
import { ZodError } from 'zod';

function run(handler: any, err: any) {
  const req: any = { path: '/api/test', method: 'GET', body: {}, query: {}, params: {} };
  const res: any = { headersSent: false, status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  handler(err, req, res, next);
  return res;
}

describe('errorHandler', () => {
  it('formats ZodError as 400', () => {
    const zodErr = new ZodError([]);
    const res = run(errorHandler, zodErr);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('formats AppError with its status', () => {
    class TestError extends AppError { constructor(){ super('x', 418, true); } }
    const res = run(errorHandler, new TestError());
    expect(res.status).toHaveBeenCalledWith(418);
  });
});