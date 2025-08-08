import { authenticate } from '../../server/middleware/auth';

jest.mock('../../server/services/auth', () => ({
  verifyAccessToken: jest.fn(),
  isUserBlacklisted: jest.fn(),
}));

const { verifyAccessToken, isUserBlacklisted } = jest.requireMock('../../server/services/auth');

function mockReq(headers: any = {}) {
  return { headers, method: 'GET', path: '/api/test', ip: '127.0.0.1' } as any;
}
function mockRes() {
  return { status: jest.fn().mockReturnThis(), json: jest.fn() } as any;
}

describe('authenticate middleware', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('passes on optional when no token', async () => {
    const req = mockReq();
    const res = mockRes();
    const next = jest.fn();
    await authenticate({ optional: true })(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('rejects when required and no token', async () => {
    const req = mockReq();
    const res = mockRes();
    await authenticate({ optional: false })(req, res, jest.fn());
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('accepts valid token', async () => {
    (verifyAccessToken as jest.Mock).mockResolvedValue({ userId: 'u1' });
    (isUserBlacklisted as jest.Mock).mockResolvedValue(false);
    const req = mockReq({ authorization: 'Bearer token' });
    const res = mockRes();
    const next = jest.fn();
    await authenticate({ optional: false })(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(req.user?.userId).toBe('u1');
  });

  it('denies blacklisted', async () => {
    (verifyAccessToken as jest.Mock).mockResolvedValue({ userId: 'u1' });
    (isUserBlacklisted as jest.Mock).mockResolvedValue(true);
    const req = mockReq({ authorization: 'Bearer token' });
    const res = mockRes();
    const next = jest.fn();
    await authenticate({ optional: false })(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
  });
});