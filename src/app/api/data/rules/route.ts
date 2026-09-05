import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const DEFAULT_RULES = `조건: 주문유형 == 재렌탈
할인: 렌탈료 10%
수수료차감: 50000원

조건: 주문유형 == 패키지
할인: 렌탈료 -3000원`;

export async function GET() {
  try {
    const rulesDir = path.join(process.cwd(), 'public', 'data', 'rules');
    const brands = ['코웨이', '쿠쿠', 'SK매직'];
    const rules: Record<string, string> = {};

    for (const brand of brands) {
      const filePath = path.join(rulesDir, `${brand}.md`);
      if (fs.existsSync(filePath)) {
        rules[brand] = fs.readFileSync(filePath, 'utf-8');
      } else {
        rules[brand] = DEFAULT_RULES;
      }
    }

    return NextResponse.json(rules);
  } catch (error) {
    console.error('Failed to read rules:', error);
    return NextResponse.json({ error: 'Failed to read rules' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: '운영 환경에서는 규칙을 수정할 수 없습니다. 로컬(PC) 환경에서만 가능합니다.' }, { status: 403 });
  }

  try {
    const data = await request.json();
    const rulesDir = path.join(process.cwd(), 'public', 'data', 'rules');

    if (!fs.existsSync(rulesDir)) {
      fs.mkdirSync(rulesDir, { recursive: true });
    }

    for (const [brand, content] of Object.entries(data)) {
      if (typeof content === 'string') {
        const filePath = path.join(rulesDir, `${brand}.md`);
        fs.writeFileSync(filePath, content, 'utf-8');
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to write rules:', error);
    return NextResponse.json({ error: 'Failed to save rules' }, { status: 500 });
  }
}
