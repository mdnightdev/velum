async function run() {
    const res = await fetch('http://localhost:3000/api/admin/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ passcode: "14002" })
    });
    const data = await res.json();
    console.log("Verify:", data);
    if(data.token) {
        const acc = await fetch('http://localhost:3000/api/bank/accounts', {
            headers: { 'Authorization': 'Bearer ' + data.token }
        });
        console.log("Accounts:", await acc.text());
    }
}
run();
