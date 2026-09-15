import * as XLSX from 'xlsx';

export interface RentalData {
  brand: string;
  category: string;
  product_name: string;
  model_code: string;
  spec_detail: string;
  contract_period: string;
  service_type: string;
  base_price: number;
  promo_price: number;
  dealer_fee: number;
  bonus_fee: number;
  benefit_notes: string;
  // 코웨이 전용 추가 필드
  half_price_period?: string;
  other_compensation?: number;
  half_price_compensation?: number;
}

// 엑셀 컬럼 매핑 기준
const columnMapping: Record<string, keyof RentalData> = {
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

export const parseExcelFile = (file: File, targetBrand: string): Promise<RentalData[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        
        // 첫 번째 시트 사용
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // JSON으로 변환 (첫 번째 행을 헤더로)
        const jsonData = XLSX.utils.sheet_to_json(worksheet) as any[];
        
        // 매핑 처리
        const parsedData: RentalData[] = jsonData.map(row => {
          const item: Partial<RentalData> = {};
          
          Object.keys(row).forEach(key => {
            const trimmedKey = key.trim();
            const noSpaceKey = key.replace(/\s/g, '');
            const mappedKey = columnMapping[trimmedKey] || columnMapping[noSpaceKey];
            if (mappedKey) {
              item[mappedKey] = row[key];
            }
          });
          
          // 사용자가 업로드할 때 선택한 탭의 브랜드로 데이터 전체를 고정 (독립적 관리)
          item.brand = targetBrand;
          
          // 정상렌탈료가 없고 약정할인가(프로모션)만 있다면 동일하게 세팅 (표시 오류 방지)
          if (!item.base_price && item.promo_price) {
            item.base_price = item.promo_price;
          }
          
          return item as RentalData;
        });

        resolve(parsedData);
      } catch (error) {
        reject(error);
      }
    };
    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

const STORAGE_KEY = 'rental_dashboard_data';

export const saveToLocalStorage = (data: RentalData[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }
};

export const loadFromLocalStorage = (): RentalData[] => {
  if (typeof window !== 'undefined') {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  }
  return [];
};
