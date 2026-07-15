async function run() {
    const res = await fetch('http://localhost:3000/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: "14002" })
    });
    console.log("Verify:", await res.text());
}
run();
