import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import * as XLSX from 'xlsx';

// 엑셀 컬럼 매핑 기준
const columnMapping: Record<string, string> = {
  "브랜드": "brand",
  "제품군": "category",
  "상품명": "product_name",
  "품명": "product_name",
  "모델명": "model_code",
  "모델코드": "model_code",
  "세부사양": "spec_detail",
  "옵션": "spec_detail",
  "약정기간": "contract_period",
  "약정기간(의무사용기간)": "contract_period",
  "의무": "contract_period",
  "관리방식": "service_type",
  "점검주기": "service_type",
  "정상렌탈료": "base_price",
  "렌탈료": "base_price",
  "프로모션렌탈료": "promo_price",
  "약정할인가": "promo_price",
  "판매수수료": "dealer_fee",
  "총수수료(vat포함)": "dealer_fee",
  "총 수수료(vat포함)": "dealer_fee",
  "추가시책": "bonus_fee",
  "기본혜택": "benefit_notes",
  "반값할인적용기간": "half_price_period",
  "타사보상(vat포함)": "other_compensation",
  "반값할인(vat포함)": "half_price_compensation"
};

export async function GET() {
  try {
    const excelDir = path.join(process.cwd(), 'public', 'data', 'excel');
    if (!fs.existsSync(excelDir)) {
      return NextResponse.json({ data: [], files: {} });
    }

    const files = fs.readdirSync(excelDir).filter(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
    let allData: any[] = [];
    let fileInfo: Record<string, string> = {};

    for (const file of files) {
      const filePath = path.join(excelDir, file);
      const fileBuffer = fs.readFileSync(filePath);
      
      const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
      const firstSheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[firstSheetName];
      const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

      // 헤더 행 찾기
      let headerRowIndex = 0;
      for (let i = 0; i < Math.min(10, rawData.length); i++) {
        const row = rawData[i];
        if (row && row.some(cell => typeof cell === 'string' && (cell.includes('제품군') || cell.includes('상품명') || cell.includes('모델명')))) {
          headerRowIndex = i;
          break;
        }
      }

      const headers = (rawData[headerRowIndex] || []).map(h => typeof h === 'string' ? h.replace(/[\r\n\s]/g, '') : h);

      // 파일명 패턴: 코웨이___원본파일.xlsx 또는 코웨이.xlsx (구버전 호환)
      let brandFromName = path.parse(file).name;
      let originalFileName = file;
      
      if (file.includes('___')) {
        const parts = file.split('___');
        brandFromName = parts[0];
        originalFileName = parts.slice(1).join('___');
      }

      fileInfo[brandFromName] = originalFileName;

      const parsedData = [];
      for (let i = headerRowIndex + 1; i < rawData.length; i++) {
        const row = rawData[i];
        if (!row || row.length === 0) continue;
        
        const item: any = {};
        for (let j = 0; j < headers.length; j++) {
          if (headers[j]) {
            const mappedKey = columnMapping[headers[j]];
            if (mappedKey) {
              item[mappedKey] = row[j];
            }
          }
        }
        
        item.brand = brandFromName;
        if (!item.base_price && item.promo_price) {
          item.base_price = item.promo_price;
        }
        parsedData.push(item);
      }

      allData = [...allData, ...parsedData];
    }

    return NextResponse.json({ data: allData, files: fileInfo });
  } catch (error) {
    console.error('Failed to read excel:', error);
    return NextResponse.json({ error: 'Failed to read excel' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: '운영 환경에서는 데이터를 업로드할 수 없습니다. 로컬(PC) 환경에서만 가능합니다.' }, { status: 403 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const brand = formData.get('brand') as string;

    if (!file || !brand) {
      return NextResponse.json({ error: 'File or brand is missing' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const excelDir = path.join(process.cwd(), 'public', 'data', 'excel');
    
    if (!fs.existsSync(excelDir)) {
      fs.mkdirSync(excelDir, { recursive: true });
    }

    // 기존 브랜드 파일 삭제 (구버전 '브랜드.xlsx' 와 신버전 '브랜드___...' 모두 삭제)
    const existingFiles = fs.readdirSync(excelDir);
    for (const f of existingFiles) {
      if (f === `${brand}.xlsx` || f === `${brand}.xls` || f.startsWith(`${brand}___`)) {
        fs.unlinkSync(path.join(excelDir, f));
      }
    }

    // 새 파일 저장 (브랜드___원본명)
    const originalName = file.name;
    const filePath = path.join(excelDir, `${brand}___${originalName}`);
    fs.writeFileSync(filePath, buffer);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to upload excel:', error);
    return NextResponse.json({ error: 'Failed to upload excel' }, { status: 500 });
  }
}
