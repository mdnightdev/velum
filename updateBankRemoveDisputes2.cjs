const fs = require('fs');
let code = fs.readFileSync('src/components/Admin/AdminBank.tsx', 'utf8');

const disputeTableStart = code.indexOf("{activeTab === 'DISPUTES' && (");
if (disputeTableStart !== -1) {
    const tableEnd = code.indexOf("</table>", disputeTableStart) + 8;
    const tableBlockEnd = code.indexOf(")}", tableEnd) + 2;
    code = code.substring(0, disputeTableStart) + code.substring(tableBlockEnd);
}

const disputeDetailsStart = code.indexOf("{activeTab === 'DISPUTES' && selectedDispute && (");
if (disputeDetailsStart !== -1) {
    const detailsEnd = code.indexOf("</div>\n           </div>", disputeDetailsStart) + 25;
    const detailsBlockEnd = code.indexOf(")}", detailsEnd) + 2;
    code = code.substring(0, disputeDetailsStart) + code.substring(detailsBlockEnd);
}

fs.writeFileSync('src/components/Admin/AdminBank.tsx', code);
