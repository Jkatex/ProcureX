/* Exercises identity behavior so regressions are caught close to the domain workflow they protect. */
import { describe, expect, it } from 'vitest';
import { createEncryptedSigningCredential, signCanonicalPayloadHash, validateRepeatedKeyphrase } from './signing.js';

describe('identity signing credentials', () => {
  it('validates repeated keyphrases', () => {
    expect(() => validateRepeatedKeyphrase('abc', 'abc')).toThrow(/at least 6/i);
    expect(() => validateRepeatedKeyphrase('Signing123', 'Signing456')).toThrow(/do not match/i);
    expect(() => validateRepeatedKeyphrase('Signing123', 'Signing123')).not.toThrow();
  });

  it('creates encrypted Ed25519 credentials and signs only with the correct keyphrase', async () => {
    const keyphrase = 'Signing123';
    const credential = await createEncryptedSigningCredential(keyphrase);
    const stored = {
      id: 'credential-1',
      userId: 'user-1',
      status: 'ACTIVE',
      ...credential
    };

    expect(credential.publicKeyPem).toContain('PUBLIC KEY');
    expect(credential.encryptedPrivateKey).not.toContain('PRIVATE KEY');
    expect(JSON.stringify(credential)).not.toContain(keyphrase);

    const signed = await signCanonicalPayloadHash(stored, keyphrase, 'a'.repeat(64));
    expect(signed.signatureBase64).toEqual(expect.any(String));
    expect(signed.signatureHash).toMatch(/^[a-f0-9]{64}$/);
    expect(signed.providerMetadata).toMatchObject({
      provider: 'procurex-keyphrase-ed25519-v1',
      algorithm: 'Ed25519',
      keyFingerprint: credential.keyFingerprint,
      publicKeyPem: credential.publicKeyPem
    });

    await expect(signCanonicalPayloadHash(stored, 'Wrong123', 'a'.repeat(64))).rejects.toMatchObject({ status: 403 });
    await expect(signCanonicalPayloadHash({ ...stored, status: 'REVOKED' }, keyphrase, 'a'.repeat(64))).rejects.toMatchObject({ status: 409 });
  });
});
