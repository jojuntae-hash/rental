export interface RuleResult {
  newPrice: number;
  newFee: number;
  appliedRules: string[];
  discountPeriod?: string;
}

export const parseAndApplyRules = (
  rulesText: string,
  currentPrice: number,
  currentFee: number,
  orderType: string
): RuleResult => {
  let newPrice = currentPrice;
  let newFee = currentFee;
  let discountPeriod: string | undefined = undefined;
  const appliedRules: string[] = [];

  if (!rulesText || !orderType || orderType === '신규') {
    return { newPrice, newFee, appliedRules, discountPeriod };
  }

  // 룰 블록 분리 (더블 줄바꿈 기준)
  const ruleBlocks = rulesText.split(/\n\s*\n/);

  for (const block of ruleBlocks) {
    const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) continue;

    // 조건 파싱
    const normalizedCondition = lines.find(l => l.replace(/\s+/g, '').startsWith('조건:'));
    if (!normalizedCondition) continue;

    const conditionStr = normalizedCondition.replace(/^조건\s*:/, '').trim();
    // 공백을 모두 제거한 후 비교하여 "주문유형 == 패키지" 나 "주문유형==패키지" 모두 매칭
    const isOrderTypeMatch = conditionStr.replace(/\s+/g, '').includes(`주문유형==${orderType.replace(/\s+/g, '')}`);

    if (isOrderTypeMatch) {
      // 룰 매칭됨! 액션 적용
      appliedRules.push(`[${orderType} 적용]`);

      lines.forEach(line => {
        const normalizedLine = line.replace(/\s+/g, ' ').trim();
        
        if (normalizedLine.startsWith('할인:') || normalizedLine.startsWith('할인 :')) {
          const discountStr = normalizedLine.replace(/^할인\s*:/, '').trim();
          
          // 기간 추출 (예: 1년간, 6개월간)
          const periodMatch = discountStr.match(/(\d+)\s*(년|개월)\s*간?/);
          if (periodMatch) {
            discountPeriod = periodMatch[0]; // "1년간"
          }

          // % 할인 추출 (예: "1년간 20% 할인" -> 20)
          const percentMatch = discountStr.match(/(\d+)\s*%/);
          if (percentMatch) {
            const percent = parseInt(percentMatch[1], 10);
            if (!isNaN(percent)) {
              const discountAmount = currentPrice * (percent / 100);
              newPrice -= discountAmount;
              // 원본 텍스트 느낌을 살려서 룰 적용 내역에 추가
              const applyText = discountPeriod
                ? `${discountPeriod} 렌탈료 ${percent}% 할인` 
                : `렌탈료 ${percent}% 할인`;
              appliedRules.push(applyText);
            }
          }
          // 금액 차감 추출 (예: "-3000원", "1만원 할인")
          else {
            const amountMatch = discountStr.match(/(\d+)(,(\d+))*\s*(원|만)/);
            if (amountMatch) {
              const rawNum = amountMatch[0].replace(/[^0-9]/g, '');
              let amount = parseInt(rawNum, 10);
              if (amountMatch[0].includes('만')) amount *= 10000;
              
              if (!isNaN(amount) && amount > 0) {
                newPrice -= amount;
                
                const formattedAmount = (amount % 10000 === 0) 
                  ? `${amount / 10000}만원` 
                  : `${amount.toLocaleString()}원`;
                  
                const applyText = discountPeriod
                  ? `${discountPeriod} 렌탈료 ${formattedAmount} 할인` 
                  : `렌탈료 ${formattedAmount} 할인`;
                appliedRules.push(applyText);
              }
            }
          }
        }
        else if (normalizedLine.match(/^수수료\s*차감\s*:/)) {
          const feeStr = normalizedLine.split(':')[1].trim();
          const amount = parseInt(feeStr.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(amount)) {
            newFee -= amount;
            appliedRules.push(`수수료 ${amount.toLocaleString()}원 차감`);
          }
        }
        else if (normalizedLine.match(/^수수료\s*추가\s*:/)) {
          const feeStr = normalizedLine.split(':')[1].trim();
          const amount = parseInt(feeStr.replace(/[^0-9]/g, ''), 10);
          if (!isNaN(amount)) {
            newFee += amount;
            appliedRules.push(`수수료 ${amount.toLocaleString()}원 추가`);
          }
        }
      });
    }
  }

  // 가격이 0 이하로 떨어지지 않게 방어
  if (newPrice < 0) newPrice = 0;

  return { newPrice, newFee, appliedRules };
};

const DEFAULT_RULES = `조건: 주문유형 == 재렌탈
할인: 렌탈료 10%
수수료차감: 50000원

조건: 주문유형 == 패키지
할인: 렌탈료 -3000원`;

export const loadRules = (brand: string): string => {
  if (typeof window !== 'undefined') {
    const rules = localStorage.getItem(`rental_rules_${brand}`);
    return rules || DEFAULT_RULES;
  }
  return DEFAULT_RULES;
};

export const saveRules = (brand: string, rules: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`rental_rules_${brand}`, rules);
  }
};
