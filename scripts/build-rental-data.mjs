import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import XLSX from "xlsx";

const ROOT = process.cwd();
const INPUT_DIR = path.join(ROOT, "data");
const OUTPUT_DIR = path.join(ROOT, "src", "data", "generated");
const COMPANY_FILES = [
  ["쿠쿠", "쿠쿠_통합양식.xlsx"],
  ["코웨이", "코웨이_통합양식.xlsx"],
  ["SK매직", "SK매직_통합양식.xlsx"],
];

const cleanText = (value) => value == null ? "" : String(value).trim();
const numberOrNull = (value) => {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const parsed = Number(String(value).replace(/[원,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
};

const readRows = (workbook, sheetName) => {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) throw new Error(`필수 시트가 없습니다: ${sheetName}`);
  return XLSX.utils.sheet_to_json(sheet, { defval: null, raw: true });
};

const products = [];
const rentalOptions = [];
const sourceFiles = {};

for (const [company, fileName] of COMPANY_FILES) {
  const filePath = path.join(INPUT_DIR, fileName);
  if (!fs.existsSync(filePath)) throw new Error(`입력 파일이 없습니다: data/${fileName}`);

  const workbook = XLSX.readFile(filePath, { cellDates: false });
  const productRows = readRows(workbook, "PRODUCT");
  const optionRows = readRows(workbook, "RENTAL_OPTION");

  sourceFiles[company] = {
    fileName,
    productCount: productRows.length,
    optionCount: optionRows.length,
  };

  for (const row of productRows) {
    products.push({
      productId: cleanText(row.product_id),
      company: cleanText(row.회사명) || company,
      category: cleanText(row.제품군),
      originalCategory: cleanText(row.원본제품군),
      productName: cleanText(row.상품명),
      displayName: cleanText(row.display_name),
      model: cleanText(row.모델명),
      detailModel: cleanText(row.세부모델명),
      nameVerificationStatus: cleanText(row.상품명확인상태),
      nameSource: cleanText(row.상품명출처),
      baseMonth: cleanText(row.기준월),
      notes: cleanText(row.비고),
    });
  }

  for (const row of optionRows) {
    rentalOptions.push({
      optionId: cleanText(row.option_id),
      productId: cleanText(row.product_id),
      selectionPeriod: numberOrNull(row.선택기간),
      contractPeriod: numberOrNull(row.약정기간),
      mandatoryPeriod: numberOrNull(row.의무사용기간),
      ownershipPeriod: numberOrNull(row.소유권이전),
      serviceType: cleanText(row.서비스방식),
      managementType: cleanText(row.관리방식),
      inspectionCycle: cleanText(row.점검주기),
      type: cleanText(row.구분),
      monthlyPrice: numberOrNull(row.월렌탈료),
      totalCommission: numberOrNull(row.총수수료),
      promotionName: cleanText(row.프로모션명),
      promotionPeriod: numberOrNull(row.프로모션기간),
      promotionDescription: cleanText(row.프로모션내용),
      originalOptionName: cleanText(row.원본옵션명),
      baseMonth: cleanText(row.기준월),
      notes: cleanText(row.비고),
    });
  }
}

const errors = [];
const warnings = [];
const duplicateValues = (items, key) => {
  const seen = new Set();
  const duplicates = new Set();
  for (const item of items) {
    const value = item[key];
    if (seen.has(value)) duplicates.add(value);
    seen.add(value);
  }
  return [...duplicates];
};

const duplicateProductIds = duplicateValues(products, "productId");
const duplicateOptionIds = duplicateValues(rentalOptions, "optionId");
if (duplicateProductIds.length) errors.push(`중복 product_id ${duplicateProductIds.length}개`);
if (duplicateOptionIds.length) errors.push(`중복 option_id ${duplicateOptionIds.length}개`);

const productIds = new Set(products.map((product) => product.productId));
const orphanOptions = rentalOptions.filter((option) => !productIds.has(option.productId));
if (orphanOptions.length) errors.push(`PRODUCT에 없는 product_id를 참조하는 옵션 ${orphanOptions.length}개`);

const emptyModels = products.filter((product) => !product.model);
if (emptyModels.length) errors.push(`모델명이 빈 상품 ${emptyModels.length}개`);

const invalidMonthlyPrices = rentalOptions.filter((option) => !Number.isFinite(option.monthlyPrice));
const invalidCommissions = rentalOptions.filter((option) => !Number.isFinite(option.totalCommission));
const negativePrices = rentalOptions.filter((option) => option.monthlyPrice < 0 || option.totalCommission < 0);
if (invalidMonthlyPrices.length) errors.push(`월렌탈료가 숫자가 아닌 옵션 ${invalidMonthlyPrices.length}개`);
if (invalidCommissions.length) errors.push(`총수수료가 숫자가 아닌 옵션 ${invalidCommissions.length}개`);
if (negativePrices.length) errors.push(`음수 금액 옵션 ${negativePrices.length}개`);

const optionCounts = new Map();
for (const option of rentalOptions) optionCounts.set(option.productId, (optionCounts.get(option.productId) ?? 0) + 1);
const productsWithoutOptions = products.filter((product) => !optionCounts.has(product.productId));
if (productsWithoutOptions.length) warnings.push(`옵션이 없는 상품 ${productsWithoutOptions.length}개`);

const optionFingerprint = (option) => JSON.stringify([
  option.productId, option.selectionPeriod, option.contractPeriod, option.mandatoryPeriod,
  option.ownershipPeriod, option.serviceType, option.managementType, option.inspectionCycle,
  option.type, option.monthlyPrice, option.totalCommission, option.promotionName,
  option.promotionPeriod, option.promotionDescription, option.originalOptionName,
]);
const seenFingerprints = new Set();
let exactDuplicateCount = 0;
for (const option of rentalOptions) {
  const fingerprint = optionFingerprint(option);
  if (seenFingerprints.has(fingerprint)) exactDuplicateCount += 1;
  seenFingerprints.add(fingerprint);
}
if (exactDuplicateCount) warnings.push(`내용이 완전히 같은 옵션 ${exactDuplicateCount}개`);

const metadata = {
  generatedAt: new Date().toISOString(),
  baseMonths: [...new Set(products.map((product) => product.baseMonth).filter(Boolean))].sort(),
  productCount: products.length,
  optionCount: rentalOptions.length,
  sourceFiles,
  validation: { errors, warnings },
};

if (errors.length) {
  console.error("[rental-data] 심각한 데이터 오류");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.writeFileSync(path.join(OUTPUT_DIR, "products.json"), JSON.stringify(products));
fs.writeFileSync(path.join(OUTPUT_DIR, "rental-options.json"), JSON.stringify(rentalOptions));
fs.writeFileSync(path.join(OUTPUT_DIR, "metadata.json"), JSON.stringify(metadata, null, 2));

console.log(`[rental-data] 상품 ${products.length.toLocaleString()}개, 옵션 ${rentalOptions.length.toLocaleString()}개 생성`);
for (const [company, info] of Object.entries(sourceFiles)) {
  console.log(`- ${company}: 상품 ${info.productCount.toLocaleString()}개, 옵션 ${info.optionCount.toLocaleString()}개`);
}
if (warnings.length) {
  console.warn("[rental-data] 확인이 필요한 예외");
  for (const warning of warnings) console.warn(`- ${warning}`);
} else {
  console.log("[rental-data] 검증 완료: 경고 없음");
}
