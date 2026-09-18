import products from "@/data/generated/products.json";
import rentalOptions from "@/data/generated/rental-options.json";
import metadata from "@/data/generated/metadata.json";
import type { RentalDataset } from "@/lib/rentalData";

export const dynamic = "force-static";

export async function GET() {
  const data: RentalDataset = {
    products: products as RentalDataset["products"],
    rentalOptions: rentalOptions as RentalDataset["rentalOptions"],
    metadata: metadata as RentalDataset["metadata"],
  };

  return Response.json(data);
}

export async function POST() {
  return Response.json(
    { error: "data 폴더의 통합양식 Excel을 교체한 뒤 npm run build:rental-data를 실행해주세요." },
    { status: 405 },
  );
}
