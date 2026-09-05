const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const fileBuffer = fs.readFileSync('public/data/excel/코웨이___2609 코웨이.xlsx');
const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
const firstSheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[firstSheetName];
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

// 헤더 행 찾기
let headerRowIndex = 0;
for (let i = 0; i < Math.min(10, jsonData.length); i++) {
  const row = jsonData[i];
  if (row.some(cell => typeof cell === 'string' && (cell.includes('제품군') || cell.includes('상품명') || cell.includes('모델명')))) {
    headerRowIndex = i;
    break;
  }
}

const headers = jsonData[headerRowIndex].map(h => typeof h === 'string' ? h.replace(/[\r\n\s]/g, '') : h);

const parsedData = [];
for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
  const row = jsonData[i];
  if (!row || row.length === 0) continue;
  
  const obj = {};
  for (let j = 0; j < headers.length; j++) {
    if (headers[j]) {
      obj[headers[j]] = row[j];
    }
  }
  parsedData.push(obj);
}

console.log(JSON.stringify(headers));
console.log(JSON.stringify(parsedData.slice(0, 2), null, 2));
