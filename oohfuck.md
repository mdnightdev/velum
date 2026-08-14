Added 2 lines
      221
      222        if (!record) return null;
      223
      224 +      const subtle = window.crypto.subtle;
      225 +
      226        // Validate checksum if present
      227        if (record.checksum) {
      228          const checksumData = {
● Edit(~/velum/src/services/cryptoDbStore.ts)
  ⎿  Removed 1 line
 234          };
 235          const dataString = JSON.stringify(checksumData);
 236          const dataBytes = new TextEncoder().encode(dataString);
 235 -        const subtle = window.crypto.subtle;
 237          const hashBuffer = await subtle.digest('SHA-256', dataBytes);
 238          const hashArray = Array.from(new Uint8Array(hashBuffer));
 239          const calculatedChecksum = hashArray.map(b =>
b.toString(16).padStart(2, '0')).join('');
● Bash(npx tsc --noEmit)
● ManageTask(status 7af2d571-b5c7-4471-99c7-fb4470f8908b/task-2779) (ctrl+o to
collapse)

  I fixed the scope issue with subtle in cryptoDbStore.ts and launched a
  TypeScript compilation check to verify there are no remaining type or build
  errors.
