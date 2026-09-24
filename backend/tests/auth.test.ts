import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { app, resetDatabase, registerUser, activateAndLogin, createStaff, auth, PASSWORD } from './helpers';
import { prisma } from '../src/config/prisma';

describe('Authentication', () => {
  beforeEach(resetDatabase);

  it('registers a user, hashes the password and issues a referral code', async () => {
    const { response, body } = await registerUser();

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data.referralCode).toMatch(/^[A-Z0-9]{6,8}$/);

    const stored = await prisma.user.findUniqueOrThrow({ where: { email: body.email } });
    expect(stored.passwordHash).not.toBe(body.password);
    expect(JSON.stringify(response.body)).not.toContain(body.password);
    expect(JSON.stringify(response.body)).not.toContain(stored.passwordHash);
  });

  it('rejects weak passwords with a field-level validation error', async () => {
    const response = await request(app).post('/api/v1/auth/register').send({
      fullName: 'Weak Password', email: 'weak@test.local', phone: '+919812345678',
      password: 'short', acceptedTerms: true,
    });
    expect(response.status).toBe(422);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(response.body.error.details).toHaveProperty('password');
  });

  it('prevents duplicate email registration', async () => {
    const { body } = await registerUser();
    const { response } = await registerUser({ email: body.email });
    expect(response.status).toBe(409);
  });

  it('returns the same error for unknown emails and wrong passwords', async () => {
    const { body } = await registerUser();
    await activateAndLogin(body.email);

    const wrongPassword = await request(app).post('/api/v1/auth/login').send({ email: body.email, password: 'WrongPassword123' });
    const unknownEmail = await request(app).post('/api/v1/auth/login').send({ email: 'nobody@test.local', password: PASSWORD });

    expect(wrongPassword.status).toBe(401);
    expect(unknownEmail.status).toBe(401);
    expect(wrongPassword.body.error.message).toBe(unknownEmail.body.error.message);
  });

  it('rejects requests without a token', async () => {
    const response = await request(app).get('/api/v1/wallet');
    expect(response.status).toBe(401);
  });

  it('blocks a suspended account even with a previously valid token', async () => {
    const { body } = await registerUser();
    const { token, user } = await activateAndLogin(body.email);

    const before = await request(app).get('/api/v1/wallet').set(auth(token));
    expect(before.status).toBe(200);

    await prisma.user.update({ where: { id: user.id }, data: { status: 'SUSPENDED' } });

    const after = await request(app).get('/api/v1/wallet').set(auth(token));
    expect(after.status).toBe(403);
  });

  it('locks an account after repeated failed sign-in attempts', async () => {
    const { body } = await registerUser();
    await activateAndLogin(body.email);

    for (let i = 0; i < 5; i += 1) {
      await request(app).post('/api/v1/auth/login').send({ email: body.email, password: 'WrongPassword123' });
    }
    const locked = await prisma.user.findUniqueOrThrow({ where: { email: body.email } });
    expect(locked.lockedUntil).not.toBeNull();
  });
});

describe('Authorization', () => {
  beforeEach(resetDatabase);

  it('denies ambassadors access to admin endpoints', async () => {
    const { body } = await registerUser();
    const { token } = await activateAndLogin(body.email);
    const response = await request(app).get('/api/v1/verifications').set(auth(token));
    expect(response.status).toBe(403);
  });

  it('denies admins access to super-admin-only endpoints', async () => {
    const { token } = await createStaff('ADMIN');
    const response = await request(app).get('/api/v1/audit').set(auth(token));
    expect(response.status).toBe(403);
  });

  it('allows super admins into governance endpoints', async () => {
    const { token } = await createStaff('SUPER_ADMIN');
    const response = await request(app).get('/api/v1/audit').set(auth(token));
    expect(response.status).toBe(200);
  });
});
