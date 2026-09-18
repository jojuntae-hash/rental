export type RentalCompany = "쿠쿠" | "코웨이" | "SK매직";

export type RentalProduct = {
  productId: string;
  company: RentalCompany;
  category: string;
  originalCategory: string;
  productName: string;
  displayName: string;
  model: string;
  detailModel: string;
  nameVerificationStatus: string;
  nameSource: string;
  baseMonth: string;
  notes: string;
};

export type RentalOption = {
  optionId: string;
  productId: string;
  selectionPeriod: number | null;
  contractPeriod: number | null;
  mandatoryPeriod: number | null;
  ownershipPeriod: number | null;
  serviceType: string;
  managementType: string;
  inspectionCycle: string;
  type: string;
  monthlyPrice: number;
  totalCommission: number;
  promotionName: string;
  promotionPeriod: number | null;
  promotionDescription: string;
  originalOptionName: string;
  baseMonth: string;
  notes: string;
};

export type RentalMetadata = {
  generatedAt: string;
  baseMonths: string[];
  productCount: number;
  optionCount: number;
  sourceFiles: Record<RentalCompany, {
    fileName: string;
    productCount: number;
    optionCount: number;
  }>;
  validation: { errors: string[]; warnings: string[] };
};

export type RentalDataset = {
  products: RentalProduct[];
  rentalOptions: RentalOption[];
  metadata: RentalMetadata;
};

export const normalizeSearchText = (value: string) =>
  value.toLocaleLowerCase("ko-KR").replace(/\s+/g, "");

export const getOptionPeriod = (option: RentalOption) =>
  option.selectionPeriod ?? option.mandatoryPeriod ?? option.contractPeriod;

export const formatPeriod = (period: number | null) => period == null ? "기간 미정" : `${period}개월`;

export const getOptionConditionLabel = (option: RentalOption) => {
  const parts = [
    option.serviceType,
    option.managementType,
    option.inspectionCycle,
    option.type,
    option.promotionName && `${option.promotionName}${option.promotionPeriod ? ` ${option.promotionPeriod}개월` : ""}`,
  ].filter(Boolean);
  return [...new Set(parts)].join(" · ") || "일반";
};
