const { subtle } = require('crypto').webcrypto;

async function run() {
  const aliceIK = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const aliceSPK = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  
  const bobIK = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const bobSPK = await subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);

  // Alice computes
  const dh1A = await subtle.deriveBits({ name: 'ECDH', public: bobIK.publicKey }, aliceIK.privateKey, 256);
  const dh2A = await subtle.deriveBits({ name: 'ECDH', public: bobSPK.publicKey }, aliceSPK.privateKey, 256);
  const dh3A = await subtle.deriveBits({ name: 'ECDH', public: bobSPK.publicKey }, aliceIK.privateKey, 256);
  const dh4A = await subtle.deriveBits({ name: 'ECDH', public: bobIK.publicKey }, aliceSPK.privateKey, 256);

  // Bob computes
  const dh1B = await subtle.deriveBits({ name: 'ECDH', public: aliceIK.publicKey }, bobIK.privateKey, 256);
  const dh2B = await subtle.deriveBits({ name: 'ECDH', public: aliceSPK.publicKey }, bobSPK.privateKey, 256);
  const dh3B = await subtle.deriveBits({ name: 'ECDH', public: aliceSPK.publicKey }, bobIK.privateKey, 256);
  const dh4B = await subtle.deriveBits({ name: 'ECDH', public: aliceIK.publicKey }, bobSPK.privateKey, 256);

  console.log('dh1 matches?', Buffer.from(dh1A).equals(Buffer.from(dh1B)));
  console.log('dh2 matches?', Buffer.from(dh2A).equals(Buffer.from(dh2B)));
  console.log('dh3A == dh4B?', Buffer.from(dh3A).equals(Buffer.from(dh4B)));
  console.log('dh4A == dh3B?', Buffer.from(dh4A).equals(Buffer.from(dh3B)));

  const aliceSet = [dh1A, dh2A, dh3A, dh4A].map(b => Buffer.from(b).toString('hex')).sort();
  const bobSet = [dh1B, dh2B, dh3B, dh4B].map(b => Buffer.from(b).toString('hex')).sort();

  console.log('Alice set:', aliceSet);
  console.log('Bob set:', bobSet);
  console.log('Sets match?', aliceSet.join('') === bobSet.join(''));
}

run().catch(console.error);
