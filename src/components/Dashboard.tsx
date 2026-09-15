"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { Search, LogOut, Eye, EyeOff, Upload, Settings } from "lucide-react";
import { RentalData } from "@/lib/excelParser";
import { parseAndApplyRules } from "@/lib/ruleEngine";

export default function Dashboard() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [autoLogin, setAutoLogin] = useState(false);
  const [isAuthChecking, setIsAuthChecking] = useState(true);
  
  const [activeBrand, setActiveBrand] = useState("코웨이");
  const [hideMargin, setHideMargin] = useState(false);
  const [rentalData, setRentalData] = useState<RentalData[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  
  // 상태 관리: 필터
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [selectedModelCode, setSelectedModelCode] = useState<string>("");
  const [selectedServiceType, setSelectedServiceType] = useState<string>("");
  const [selectedContractPeriod, setSelectedContractPeriod] = useState<string>("");
  const [orderType, setOrderType] = useState<string>("신규");
  const [simultaneousCount, setSimultaneousCount] = useState<number>(2);
  const [extraBenefit, setExtraBenefit] = useState<string>("");
  
  // 규칙 에디터 상태
  const [isRuleSettingsOpen, setIsRuleSettingsOpen] = useState(false);
  const [ruleModalBrand, setRuleModalBrand] = useState("코웨이");
  const [ruleTexts, setRuleTexts] = useState<Record<string, string>>({
    "코웨이": "",
    "쿠쿠": "",
    "SK매직": ""
  });
  
  // 마진 설정
  const [giftDeduction, setGiftDeduction] = useState<number>(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 엑셀 모달 상태
  const [excelModalBrand, setExcelModalBrand] = useState("코웨이");
  const [uploadedFiles, setUploadedFiles] = useState<Record<string, string>>({});

  const fetchInitialData = async () => {
    try {
      // 엑셀 데이터 패치
      const resData = await fetch('/api/data/excel');
      if (resData.ok) {
        const { data, files } = await resData.json();
        setRentalData(data);
        if (files) setUploadedFiles(files);
      }
      
      // 규칙 데이터 패치
      const resRules = await fetch('/api/data/rules');
      if (resRules.ok) {
        const rules = await resRules.json();
        setRuleTexts(rules);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchInitialData();

    const savedAuth = localStorage.getItem("rental_auth_token");
    if (savedAuth === "true") {
      setIsLoggedIn(true);
      setAutoLogin(true);
    }
    setIsAuthChecking(false);
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("brand", excelModalBrand);

      const res = await fetch('/api/data/excel', {
        method: 'POST',
        body: formData
      });

      if (!res.ok) {
        const err = await res.json();
        alert(`업로드 실패: ${err.error}`);
        return;
      }

      alert(`${excelModalBrand} 데이터 업로드가 완료되었습니다!`);
      setIsSettingsOpen(false);
      // 업로드 완료 후 다시 데이터 패치
      fetchInitialData();
    } catch (error) {
      console.error(error);
      alert("데이터 업로드 중 오류가 발생했습니다.");
    }
  };

  const handleSaveRules = async () => {
    try {
      const res = await fetch('/api/data/rules', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(ruleTexts)
      });
      
      if (!res.ok) {
        const err = await res.json();
        alert(`규칙 저장 실패: ${err.error}`);
        return;
      }

      alert("규칙이 성공적으로 저장되었습니다!");
      setIsRuleSettingsOpen(false);
      fetchInitialData();
    } catch (error) {
      console.error(error);
      alert("규칙 저장 중 오류가 발생했습니다.");
    }
  };

  // 현재 브랜드 데이터 필터링
  const currentBrandData = useMemo(() => {
    return rentalData.filter(d => d.brand === activeBrand);
  }, [rentalData, activeBrand]);

  // 카테고리 목록
  const categories = useMemo(() => {
    return Array.from(new Set(currentBrandData.map(d => d.category))).filter(Boolean);
  }, [currentBrandData]);

  // 제품명 목록
  const products = useMemo(() => {
    return Array.from(new Set(currentBrandData.filter(d => d.category === selectedCategory).map(d => d.product_name))).filter(Boolean);
  }, [currentBrandData, selectedCategory]);

  // 모델 코드 목록
  const modelCodes = useMemo(() => {
    return Array.from(new Set(currentBrandData.filter(d => d.product_name === selectedProduct).map(d => d.model_code))).filter(Boolean);
  }, [currentBrandData, selectedProduct]);

  // 선택된 모델의 데이터
  const selectedModelDataList = useMemo(() => {
    return currentBrandData.filter(d => d.model_code === selectedModelCode);
  }, [currentBrandData, selectedModelCode]);

  // 관리방식 목록
  const serviceTypes = useMemo(() => {
    return Array.from(new Set(selectedModelDataList.map(d => d.service_type))).filter(Boolean);
  }, [selectedModelDataList]);

  // 약정기간 목록
  const contractPeriods = useMemo(() => {
    return Array.from(new Set(selectedModelDataList.filter(d => d.service_type === selectedServiceType).map(d => d.contract_period))).filter(Boolean);
  }, [selectedModelDataList, selectedServiceType]);

  // 최종 선택된 단일 데이터
  const finalData = useMemo(() => {
    return selectedModelDataList.find(d => d.service_type === selectedServiceType && d.contract_period === selectedContractPeriod);
  }, [selectedModelDataList, selectedServiceType, selectedContractPeriod]);

  // 룰 엔진 연동 계산
  const computedFinalData = useMemo(() => {
    if (!finalData) return null;
    
    let rulesStr = ruleTexts[activeBrand] || "";
    const baseFee = (Number(finalData.dealer_fee) || 0) + (Number(finalData.bonus_fee) || 0);
    
    const actualOrderType = orderType === '동시가입' ? `동시가입 ${simultaneousCount}대` : orderType;
    
    if (extraBenefit) {
      rulesStr += `\n\n조건: 주문유형 == ${actualOrderType}\n할인: 렌탈료 ${extraBenefit}`;
    }
    
    const { newPrice, newFee, appliedRules, discountPeriod } = parseAndApplyRules(
      rulesStr,
      finalData.promo_price || finalData.base_price || 0,
      baseFee,
      actualOrderType
    );
    
    return {
      ...finalData,
      computedPrice: newPrice,
      computedFee: newFee,
      appliedRules,
      discountPeriod,
      half_price_period: orderType === '타사보상' ? '-' : finalData.half_price_period
    };
  }, [finalData, activeBrand, orderType, simultaneousCount, ruleTexts, extraBenefit]);

  // 자동 리셋 로직
  useEffect(() => {
    if (categories.length > 0 && !categories.includes(selectedCategory)) setSelectedCategory(categories[0]);
  }, [categories, selectedCategory]);

  useEffect(() => {
    if (products.length > 0 && !products.includes(selectedProduct)) setSelectedProduct(products[0]);
  }, [products, selectedProduct]);

  useEffect(() => {
    if (modelCodes.length > 0 && !modelCodes.includes(selectedModelCode)) setSelectedModelCode(modelCodes[0]);
  }, [modelCodes, selectedModelCode]);

  useEffect(() => {
    if (serviceTypes.length > 0 && !serviceTypes.includes(selectedServiceType)) setSelectedServiceType(serviceTypes[0]);
  }, [serviceTypes, selectedServiceType]);

  useEffect(() => {
    if (contractPeriods.length > 0 && !contractPeriods.includes(selectedContractPeriod)) setSelectedContractPeriod(contractPeriods[0]);
  }, [contractPeriods, selectedContractPeriod]);

  // 고객 사은품 공제액 자동 계산 (본사 총수수료의 70%를 만원 단위 절사)
  useEffect(() => {
    if (computedFinalData?.computedFee) {
      const autoGift = Math.floor((computedFinalData.computedFee * 0.7) / 10000) * 10000;
      setGiftDeduction(autoGift);
    } else {
      setGiftDeduction(0);
    }
  }, [computedFinalData?.computedFee]);

  // 매트릭스 표 데이터 (선택된 모델의 모든 약정/관리방식 조합)
  const matrixData = useMemo(() => {
    const serviceTypeSet = Array.from(new Set(selectedModelDataList.map(d => d.service_type))).filter(Boolean);
    const contractPeriodSet = Array.from(new Set(selectedModelDataList.map(d => d.contract_period))).filter(Boolean).sort();
    
    return {
      rows: serviceTypeSet,
      cols: contractPeriodSet,
      data: selectedModelDataList
    };
  }, [selectedModelDataList]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("복사되었습니다.");
  };

  const getChatText = () => {
    if (!computedFinalData) return "데이터가 없습니다.";
    let text = `========================\n[${computedFinalData.brand}] ${computedFinalData.product_name} (${computedFinalData.model_code})\n========================\n▶ 선택조건: ${computedFinalData.contract_period} / ${computedFinalData.service_type}`;
    
    const actualOrderType = orderType === '동시가입' ? `동시가입 ${simultaneousCount}대` : orderType;
    
    if (actualOrderType !== '신규') {
      text += ` (${actualOrderType})`;
    }

    if (computedFinalData.discountPeriod) {
      text += `\n▶ 할인가: 월 ${computedFinalData.computedPrice?.toLocaleString()}원 (${computedFinalData.discountPeriod})\n`;
      text += `▶ ${computedFinalData.discountPeriod} 이후: 월 ${computedFinalData.base_price?.toLocaleString()}원`;
    } else {
      text += `\n▶ 정상 렌탈료: 월 ${computedFinalData.base_price?.toLocaleString()}원\n▶ 최종 렌탈료: 월 ${computedFinalData.computedPrice?.toLocaleString()}원`;
    }
    
    if (computedFinalData.appliedRules && computedFinalData.appliedRules.length > 0) {
      text += `\n▶ [${actualOrderType} 혜택 적용완료]`;
    }
    
    text += `\n------------------------\n🎁 실시간 본사 혜택:\n`;
    if (computedFinalData.half_price_period && computedFinalData.half_price_period !== "-") {
      text += `- 반값 프로모션 지원: ${computedFinalData.half_price_period}\n`;
    }
    if (extraBenefit) {
      text += `- 추가 지원: 렌탈료 ${extraBenefit}\n`;
    }
    text += `- 설치비 3만원 무료시공\n`;
    if (giftDeduction > 0) {
      text += `- 상품권 ${giftDeduction / 10000}만원\n`;
    }
    if (computedFinalData.benefit_notes) {
      text += computedFinalData.benefit_notes.split(',').map((n:string) => '- ' + n.trim()).join('\n') + '\n';
    }
    
    text += `========================`;
    return text;
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordInput === "admin123!") {
      setIsLoggedIn(true);
      if (autoLogin) {
        localStorage.setItem("rental_auth_token", "true");
      }
    } else {
      alert("비밀번호가 일치하지 않습니다.");
    }
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    setAutoLogin(false);
    localStorage.removeItem("rental_auth_token");
    setPasswordInput("");
  };

  if (isAuthChecking) {
    return <div className="flex h-screen items-center justify-center bg-gray-100">Loading...</div>;
  }

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col h-screen bg-gray-100 items-center justify-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl w-96 flex flex-col items-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">렌탈상담Pro</h1>
          <p className="text-gray-500 mb-6">대외비 마진 보호를 위해 로그인해주세요.</p>
          <form onSubmit={handleLogin} className="w-full flex flex-col">
            <input 
              type="password"
              placeholder="비밀번호 입력"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full border border-gray-300 text-gray-900 rounded-lg p-3 mb-3 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 outline-none"
            />
            <label className="flex items-center gap-2 mb-4 cursor-pointer text-gray-600 text-sm">
              <input 
                type="checkbox" 
                checked={autoLogin} 
                onChange={(e) => setAutoLogin(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              자동 로그인 (현재 기기)
            </label>
            <button 
              type="submit"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-lg p-3 font-semibold transition-colors"
            >
              입장하기
            </button>
          </form>
          <p className="text-xs text-gray-400 mt-4">초기 비밀번호: admin123!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 text-sm">
      {/* 1. 상단 글로벌 네비게이션 */}
      <header className="h-auto min-h-[64px] bg-white border-b border-gray-200 flex flex-col md:flex-row items-center justify-between px-4 py-3 md:py-0 md:px-6 shrink-0 gap-4 md:gap-0">
        <div className="flex items-center space-x-6 w-full md:w-auto justify-between md:justify-start">
          <h1 className="text-xl font-bold text-gray-800 tracking-tight shrink-0">렌탈 상담 Pro</h1>
          <div className="flex bg-gray-100 p-1 rounded-lg shrink-0">
            {["코웨이", "쿠쿠", "SK매직"].map((brand) => (
              <button
                key={brand}
                onClick={() => setActiveBrand(brand)}
                className={`px-3 md:px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                  activeBrand === brand 
                    ? "bg-blue-600 text-white shadow-sm" 
                    : "text-gray-600 hover:bg-gray-200"
                }`}
              >
                {brand}
              </button>
            ))}
          </div>
          
          {/* 업로드된 파일명 표시 */}
          <div className="hidden md:flex text-sm text-gray-500 bg-gray-50 px-3 py-1.5 rounded border border-gray-200 items-center gap-2 shrink-0">
            <span className="font-medium text-gray-700">현재 데이터:</span>
            <span className="truncate max-w-[200px]" title={uploadedFiles[activeBrand] || "없음"}>
              {uploadedFiles[activeBrand] || "없음"}
            </span>
          </div>
        </div>

        <div className="flex items-center space-x-2 md:space-x-4 w-full md:w-auto justify-between md:justify-end overflow-x-auto pb-1 md:pb-0 text-sm md:text-base">
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 shrink-0"
          >
            <Settings size={18} />
            <span className="hidden md:inline">설정(엑셀)</span>
            <span className="md:hidden">엑셀</span>
          </button>
          <div className="text-gray-300">|</div>
          <button
            onClick={() => {
              setRuleModalBrand(activeBrand);
              setIsRuleSettingsOpen(true);
            }}
            className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 shrink-0"
          >
            <Settings size={18} />
            <span className="hidden md:inline">설정(규칙)</span>
            <span className="md:hidden">규칙</span>
          </button>
          <div className="text-gray-300">|</div>
          <button
            onClick={() => setHideMargin(!hideMargin)}
            className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 shrink-0"
          >
            {hideMargin ? <EyeOff size={18} /> : <Eye size={18} />}
            <span>마진숨김</span>
          </button>
          <div className="text-gray-300">|</div>
          <button 
            onClick={handleLogout}
            className="flex items-center space-x-1 text-gray-600 hover:text-gray-900 shrink-0"
          >
            <LogOut size={18} />
            <span>로그아웃</span>
          </button>
        </div>
      </header>

      {/* 설정 모달 */}
      {isSettingsOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setIsSettingsOpen(false)}
        >
          <div 
            className="bg-white p-6 rounded-xl shadow-lg w-96"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">관리자 설정 (엑셀)</h2>
            
            <div className="flex border-b border-gray-200 mb-4">
              {["코웨이", "쿠쿠", "SK매직"].map((brand) => (
                <button
                  key={brand}
                  onClick={() => setExcelModalBrand(brand)}
                  className={`px-4 py-2 font-medium ${
                    excelModalBrand === brand
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {brand}
                </button>
              ))}
            </div>

            <div className="mb-4">
              <label className="block text-gray-700 mb-2 font-medium">{excelModalBrand} 엑셀 업로드</label>
              
              {uploadedFiles[excelModalBrand] && (
                <div className="mb-3 p-3 bg-blue-50 border border-blue-100 rounded-lg text-sm text-blue-800">
                  <span className="font-semibold">현재 업로드된 파일:</span><br/>
                  {uploadedFiles[excelModalBrand]}
                </div>
              )}

              <input 
                type="file" 
                accept=".xlsx, .xls"
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileUpload}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-lg p-4 text-gray-600 hover:bg-gray-50 hover:border-blue-400 transition-colors"
              >
                <Upload size={20} />
                <span>새로운 {excelModalBrand} 파일 선택</span>
              </button>
              <p className="text-xs text-gray-500 mt-2">업로드 시 '{excelModalBrand}' 기존 데이터만 새 파일로 덮어쓰기 됩니다.</p>
            </div>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setIsSettingsOpen(false)} 
                className="px-4 py-2 bg-gray-200 text-gray-800 hover:bg-gray-300 rounded-lg transition-colors font-medium"
              >
                닫기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 규칙 설정 모달 */}
      {isRuleSettingsOpen && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
        >
          <div 
            className="bg-white p-6 rounded-xl shadow-lg w-[600px] flex flex-col h-[600px]"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">프로모션 규칙 설정</h2>
            
            <div className="flex border-b border-gray-200 mb-4">
              {["코웨이", "쿠쿠", "SK매직"].map((brand) => (
                <button
                  key={brand}
                  onClick={() => setRuleModalBrand(brand)}
                  className={`px-4 py-2 font-medium ${
                    ruleModalBrand === brand
                      ? "text-blue-600 border-b-2 border-blue-600"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {brand}
                </button>
              ))}
            </div>

            <div className="flex-1 flex flex-col gap-2 mb-4">
              <p className="text-sm text-gray-600">
                작성 예시:<br/>
                <code>조건: 주문유형 == 재렌탈</code><br/>
                <code>할인: 렌탈료 10%</code> 또는 <code>할인: 렌탈료 -3000원</code><br/>
                <code>수수료차감: 50000원</code>
              </p>
              <textarea 
                className="flex-1 border border-gray-300 rounded-lg p-3 text-sm focus:border-blue-500 outline-none resize-none"
                value={ruleTexts[ruleModalBrand]}
                onChange={(e) => setRuleTexts({ ...ruleTexts, [ruleModalBrand]: e.target.value })}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button 
                onClick={() => setIsRuleSettingsOpen(false)} 
                className="px-4 py-2 bg-gray-200 text-gray-800 hover:bg-gray-300 rounded-lg transition-colors font-medium"
              >
                취소
              </button>
              <button 
                onClick={handleSaveRules} 
                className="px-4 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-colors font-medium"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 메인 3단 분할 레이아웃 */}
      <main className="flex flex-col md:flex-row flex-1 overflow-auto md:overflow-hidden">
        {/* 2. 좌측 조건 설정 패널 */}
        <aside className="w-full md:w-80 bg-white border-b md:border-r border-gray-200 md:overflow-y-auto p-4 flex flex-col gap-6 shrink-0">
          <h2 className="font-semibold text-lg text-gray-800 mb-2">조건 검색</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-gray-600 mb-1">1. 주문 유형</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {["신규", "재렌탈", "패키지", "타사보상", "동시가입"].map(t => (
                  <button 
                    key={t}
                    onClick={() => setOrderType(t)}
                    className={`flex-1 py-1.5 border rounded whitespace-nowrap px-2 text-sm ${orderType === t ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-600'}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              {orderType === "동시가입" && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-gray-600">가입 대수:</span>
                  <select 
                    value={simultaneousCount}
                    onChange={(e) => setSimultaneousCount(Number(e.target.value))}
                    className="border border-gray-300 rounded p-1 text-sm focus:border-blue-500 outline-none"
                  >
                    {Array.from({ length: 10 }, (_, i) => i + 1).map(num => (
                      <option key={num} value={num}>{num}대</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div>
              <label className="block text-gray-600 mb-1">2. 제품군 선택</label>
              <select 
                value={selectedCategory} 
                onChange={e => setSelectedCategory(e.target.value)}
                className="w-full border border-gray-300 rounded p-2 focus:border-blue-500 outline-none disabled:bg-gray-100"
                disabled={categories.length === 0}
              >
                {categories.length === 0 && <option value="">분류 없음 (전체 표시)</option>}
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            
            <div>
              <label className="block text-gray-600 mb-1">3. 상품명 선택</label>
              <select 
                value={selectedProduct} 
                onChange={e => setSelectedProduct(e.target.value)}
                className="w-full border border-gray-300 rounded p-2 focus:border-blue-500 outline-none"
              >
                {products.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-gray-600 mb-1">4. 모델명 선택</label>
              <select 
                value={selectedModelCode} 
                onChange={e => setSelectedModelCode(e.target.value)}
                className="w-full border border-gray-300 rounded p-2 focus:border-blue-500 outline-none"
              >
                {modelCodes.map(m => {
                  const spec = currentBrandData.find(d => d.model_code === m)?.spec_detail;
                  return <option key={m} value={m}>{m} {spec ? `(${spec})` : ''}</option>
                })}
              </select>
            </div>

            <div>
              <label className="block text-gray-600 mb-1">5. 관리/점검 방식</label>
              <div className="flex flex-wrap gap-2">
                {serviceTypes.map(s => (
                  <button 
                    key={s}
                    onClick={() => setSelectedServiceType(s)}
                    className={`flex-1 py-1.5 border rounded whitespace-nowrap px-2 ${selectedServiceType === s ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-600'}`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-gray-600 mb-1">6. 의무 약정 기간</label>
              <div className="flex flex-wrap gap-2">
                {contractPeriods.map(c => (
                  <button 
                    key={c}
                    onClick={() => setSelectedContractPeriod(c)}
                    className={`flex-1 py-1.5 border rounded whitespace-nowrap px-2 ${selectedContractPeriod === c ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-gray-300 bg-white text-gray-600'}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-gray-600 font-bold mb-1">7. 추가 혜택 (선택)</label>
              <select 
                value={extraBenefit} 
                onChange={e => setExtraBenefit(e.target.value)}
                className="w-full border border-blue-300 rounded p-2 focus:border-blue-500 outline-none bg-blue-50 text-blue-800 font-medium"
              >
                <option value="">적용 안함 (선택)</option>
                <option value="1년간 1만원 할인">01. 1년간 1만원 할인</option>
                <option value="1년간 2만원 할인">02. 1년간 2만원 할인</option>
                <option value="1년간 10% 할인">03. 1년간 10% 할인</option>
                <option value="1년간 20% 할인">04. 1년간 20% 할인</option>
              </select>
            </div>
          </div>
        </aside>

        {/* 3. 중앙 실시간 견적 & 수수료 카드 */}
        <section className="flex-1 md:overflow-y-auto p-4 md:p-6 bg-gray-50 flex flex-col gap-6 shrink-0">
          {computedFinalData ? (
            <>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
                <div className="flex flex-col md:flex-row justify-between items-start mb-4 gap-2">
                  <div>
                    <h2 className="text-xl md:text-2xl font-bold text-gray-800 mb-1">{computedFinalData.product_name}</h2>
                    <p className="text-sm md:text-base text-gray-500">{computedFinalData.model_code} {computedFinalData.spec_detail && `(${computedFinalData.spec_detail})`} / {computedFinalData.contract_period} / {computedFinalData.service_type}</p>
                  </div>
                  {orderType !== "신규" && (
                    <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-sm font-bold shrink-0">
                      {orderType} 적용중
                    </span>
                  )}
                </div>
                
                <div className="space-y-4 mb-6">
                  <div className="flex justify-between items-center text-gray-500">
                    <span>정상 렌탈료</span>
                    <span className="line-through">{computedFinalData.base_price?.toLocaleString() || 0}원</span>
                  </div>
                  <div className="flex justify-between items-center font-semibold text-lg text-gray-800">
                    <span>최종 적용가</span>
                    <span className="text-blue-600 text-xl">{computedFinalData.computedPrice?.toLocaleString() || 0}원</span>
                  </div>
                  {computedFinalData.half_price_period && computedFinalData.half_price_period !== "-" && (
                    <div className="flex justify-between items-center text-sm mt-1">
                      <span className="text-pink-600 font-medium">✨ 반값할인 적용기간</span>
                      <span className="text-pink-600 font-bold bg-pink-50 px-2 py-0.5 rounded">{computedFinalData.half_price_period}</span>
                    </div>
                  )}
                </div>

                {computedFinalData.appliedRules && computedFinalData.appliedRules.length > 0 && (
                  <div className="bg-blue-50 rounded-lg p-4 border border-blue-100 mb-6">
                    <h3 className="font-semibold text-blue-800 mb-2">⚡ 룰 엔진 자동계산 내역</h3>
                    <ul className="list-disc pl-5 text-blue-700 space-y-1">
                      {computedFinalData.appliedRules.map((r: string, i: number) => <li key={i}>{r}</li>)}
                    </ul>
                  </div>
                )}

                <div className="bg-gray-50 rounded-lg p-4 border border-gray-100">
                  <h3 className="font-semibold text-gray-700 mb-2">🎁 본사 실시간 지원 혜택</h3>
                  <ul className="list-disc pl-5 text-gray-600 space-y-1">
                    {computedFinalData.half_price_period && computedFinalData.half_price_period !== "-" && (
                      <li className="text-pink-600 font-medium">반값 프로모션 지원: {computedFinalData.half_price_period}</li>
                    )}
                    {extraBenefit && (
                      <li className="text-blue-600 font-medium">추가 지원: 렌탈료 {extraBenefit}</li>
                    )}
                    <li>설치비 3만원 무료시공</li>
                    {giftDeduction > 0 && (
                      <li className="font-bold text-blue-700">최대 사은품(상품권) {giftDeduction / 10000}만원 지원</li>
                    )}
                    {computedFinalData.benefit_notes && computedFinalData.benefit_notes.split(',').map((n: string, i: number) => (
                      <li key={i}>{n.trim()}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 md:p-6">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-bold text-gray-800 text-lg flex items-center gap-2">
                    💰 딜러 수수료 (대외비)
                  </h3>
                  {hideMargin && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded">보안 모드 활성화</span>}
                </div>
                
                <div className={`space-y-4 ${hideMargin ? 'blur-md select-none' : ''}`}>
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center text-red-500 bg-red-50 p-3 rounded-lg border border-red-100 gap-2">
                    <span className="font-medium">고객 사은품 공제 (-)</span>
                    <input 
                      type="number" 
                      step="10000"
                      value={giftDeduction}
                      onChange={(e) => setGiftDeduction(Number(e.target.value))}
                      className="border border-red-200 rounded px-2 py-1 w-full sm:w-32 text-right focus:border-red-500 outline-none"
                      placeholder="0"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex flex-col justify-between">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">기본 / 신규 / 재렌탈시</div>
                        <div className="flex justify-between text-sm text-gray-600">
                          <span>총 수수료</span>
                          <span>{computedFinalData.computedFee.toLocaleString()}원</span>
                        </div>
                      </div>
                      <div className="flex justify-between font-bold text-green-600 mt-2 pt-2 border-t border-gray-200">
                        <span>순마진 (Net)</span>
                        <span>{(computedFinalData.computedFee - giftDeduction).toLocaleString()}원</span>
                      </div>
                    </div>

                    {computedFinalData.other_compensation && (
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex flex-col justify-between">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">타사보상 혜택 적용시</div>
                          <div className="flex justify-between text-sm text-gray-600">
                            <span>타사보상 수수료</span>
                            <span>{Number(computedFinalData.other_compensation).toLocaleString()}원</span>
                          </div>
                        </div>
                        <div className="flex justify-between font-bold text-green-600 mt-2 pt-2 border-t border-gray-200">
                          <span>순마진 (Net)</span>
                          <span>{(Number(computedFinalData.other_compensation) - giftDeduction).toLocaleString()}원</span>
                        </div>
                      </div>
                    )}

                    {computedFinalData.half_price_compensation && (
                      <div className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex flex-col justify-between">
                        <div>
                          <div className="text-xs text-gray-500 mb-1">반값할인 혜택 적용시</div>
                          <div className="flex justify-between text-sm text-gray-600">
                            <span>반값할인 수수료</span>
                            <span>{Number(computedFinalData.half_price_compensation).toLocaleString()}원</span>
                          </div>
                        </div>
                        <div className="flex justify-between font-bold text-green-600 mt-2 pt-2 border-t border-gray-200">
                          <span>순마진 (Net)</span>
                          <span>{(Number(computedFinalData.half_price_compensation) - giftDeduction).toLocaleString()}원</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 bg-white rounded-xl shadow-sm border border-gray-200 p-8 text-center min-h-[300px]">
              {rentalData.length === 0 ? "우측 상단 ⚙️설정에서 엑셀 데이터를 업로드해주세요." : "선택된 조건에 맞는 데이터가 없습니다."}
            </div>
          )}
        </section>

        {/* 4. 우측 상담톡 자동완성 */}
        <aside className="w-full md:w-80 bg-white border-t md:border-l border-gray-200 flex flex-col h-[500px] md:h-full shrink-0">
          <div className="p-4 border-b border-gray-200 shrink-0">
            <h2 className="font-semibold text-lg text-gray-800">💬 상담톡 1초 완성</h2>
          </div>
          <div className="p-4 flex-1 flex flex-col min-h-0">
            <textarea 
              className="w-full h-full p-3 border border-gray-200 rounded-lg bg-gray-50 text-gray-700 resize-none focus:outline-none"
              readOnly
              value={getChatText()}
            />
          </div>
          <div className="p-4 border-t border-gray-200 flex flex-col gap-2 shrink-0">
            <button 
              onClick={() => copyToClipboard(getChatText())}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors text-lg"
            >
              📋 상담 문자 1초 복사
            </button>
          </div>
        </aside>
      </main>

      {/* 5. 하단 매트릭스 표 */}
      <footer className="h-auto max-h-[40vh] md:h-48 bg-white border-t border-gray-200 p-4 overflow-y-auto shrink-0">
        <h3 className="font-semibold text-gray-800 mb-2">📊 1초 즉답 단가 비교표 {selectedModelCode && `(${selectedModelCode})`}</h3>
        {matrixData.rows.length > 0 ? (
          <table className="w-full text-center border-collapse">
            <thead>
              <tr className="bg-gray-100 text-gray-600">
                <th className="border border-gray-200 py-1.5 font-medium">관리방식 \ 약정기간</th>
                {matrixData.cols.map(c => (
                  <th key={c} className="border border-gray-200 py-1.5 font-medium">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrixData.rows.map(r => (
                <tr key={r}>
                  <td className="border border-gray-200 py-1.5 bg-gray-50 font-medium">{r}</td>
                  {matrixData.cols.map(c => {
                    const match = matrixData.data.find(d => d.service_type === r && d.contract_period === c);
                    const isSelected = r === selectedServiceType && c === selectedContractPeriod;
                    return (
                      <td key={c} className={`border border-gray-200 py-1.5 ${isSelected ? 'font-bold text-blue-600 bg-blue-50' : ''}`}>
                        {match ? `${match.promo_price?.toLocaleString()}원` : '-'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-gray-500 text-sm">표시할 단가 데이터가 없습니다.</p>
        )}
      </footer>
    </div>
  );
}
