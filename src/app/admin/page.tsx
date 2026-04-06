'use client';

import dbRaw from '@/data/ulmadna_db.json';
import type { UlmadnaDB } from '@/types/calculator';

const db = dbRaw as UlmadnaDB;

// DB에서 통계 미리 계산
function getDBStats() {
  const { processes, config } = db;
  const bAreaCount = processes.filter(p => p.type === 'B_area').length;
  const aItemCount = processes.filter(p => p.type === 'A_item').length;

  let totalOptions = 0;
  const gradeSet = new Set<string>();
  const priceRanges: { name: string; min: number; max: number }[] = [];

  for (const p of processes) {
    const prices: number[] = [];

    if (p.options) {
      totalOptions += p.options.length;
      for (const opt of p.options) {
        gradeSet.add(opt.grade);
        if (opt.price) prices.push(opt.price);
        if (opt.price_per_pyeong) prices.push(opt.price_per_pyeong);
      }
    }
    if (p.presets) {
      totalOptions += Object.keys(p.presets).length;
      for (const [grade, preset] of Object.entries(p.presets)) {
        gradeSet.add(grade);
        if (preset.total) prices.push(preset.total);
        if (preset.total_per_unit) prices.push(preset.total_per_unit);
      }
    }
    if (p.items) {
      for (const item of p.items) {
        if (item.options) {
          totalOptions += item.options.length;
          for (const opt of item.options) {
            gradeSet.add(opt.grade);
          }
        }
      }
    }
    if (p.sub_items) {
      for (const item of p.sub_items) {
        if (item.options) {
          totalOptions += item.options.length;
        }
      }
    }

    if (prices.length > 0) {
      priceRanges.push({
        name: p.name,
        min: Math.min(...prices),
        max: Math.max(...prices),
      });
    }
  }

  return {
    processCount: processes.length,
    bAreaCount,
    aItemCount,
    totalOptions,
    gradeCount: gradeSet.size,
    grades: Array.from(gradeSet),
    priceRanges,
    marginRange: config.margin_rate_range,
    contingencyRate: config.contingency_rate,
  };
}

function StatCard({ label, value, sub, accent }: { label: string; value: string | number; sub: string; accent?: string }) {
  return (
    <div className="bg-white rounded-xl p-5 border border-gray-100">
      <p className="text-xs text-gray-400 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${accent || 'text-brown'}`}>{value}</p>
      <p className="text-[10px] text-gray-300 mt-1">{sub}</p>
    </div>
  );
}

export default function AdminDashboard() {
  const stats = getDBStats();

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-800 mb-6">대시보드</h2>

      {/* 데이터 현황 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard label="DB 공정 수" value={stats.processCount} sub="ulmadna_db.json 기준" />
        <StatCard label="총 옵션 수" value={stats.totalOptions} sub="프리셋+옵션+세부항목 합산" accent="text-gold" />
        <StatCard label="등급 종류" value={stats.gradeCount} sub={stats.grades.slice(0, 5).join(', ') + '...'} accent="text-violet-600" />
        <StatCard label="마지막 업데이트" value={db.meta.updated} sub={`v${db.meta.version}`} accent="text-emerald-600" />
      </div>

      {/* 타입별 분포 + 가격 범위 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 공정 타입 분포 */}
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">공정 타입별 분포</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">면적 기반 (B_area)</span>
                <span className="font-mono text-emerald-600">{stats.bAreaCount}개</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-emerald-400 rounded-full h-2 transition-all"
                  style={{ width: `${(stats.bAreaCount / stats.processCount) * 100}%` }}
                />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-gray-600">개수 기반 (A_item)</span>
                <span className="font-mono text-violet-600">{stats.aItemCount}개</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-violet-400 rounded-full h-2 transition-all"
                  style={{ width: `${(stats.aItemCount / stats.processCount) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-medium text-gray-500 mb-2">등급별 커버리지</p>
            <div className="flex flex-wrap gap-1.5">
              {stats.grades.sort().map(grade => (
                <span key={grade} className="text-[10px] bg-cream px-2 py-1 rounded-full text-brown font-medium">
                  {grade}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 가격 범위 요약 */}
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">공정별 가격 범위</h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {stats.priceRanges.map((range) => (
              <div key={range.name} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 last:border-0">
                <span className="text-gray-600 truncate mr-3">{range.name}</span>
                <span className="font-mono text-xs text-gray-400 whitespace-nowrap">
                  {(range.min / 10000).toLocaleString('ko-KR')}만
                  <span className="mx-1 text-gray-300">~</span>
                  <span className="text-brown font-medium">{(range.max / 10000).toLocaleString('ko-KR')}만</span>
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* DB 설정 요약 */}
      <div className="bg-white rounded-xl p-6 border border-gray-100 mb-8">
        <h3 className="font-semibold text-gray-800 mb-4">DB 설정 요약</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="bg-cream/30 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">마진율</p>
            <p className="font-mono text-brown">{(stats.marginRange.min * 100).toFixed(0)}% ~ {(stats.marginRange.max * 100).toFixed(0)}%</p>
          </div>
          <div className="bg-cream/30 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">예비비율</p>
            <p className="font-mono text-brown">{(stats.contingencyRate * 100).toFixed(0)}%</p>
          </div>
          <div className="bg-cream/30 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">데이터 소스</p>
            <p className="text-xs text-brown leading-relaxed">{db.meta.source.slice(0, 40)}...</p>
          </div>
          <div className="bg-cream/30 rounded-lg p-3">
            <p className="text-xs text-gray-400 mb-1">평형 범위</p>
            <p className="font-mono text-brown">
              {Object.keys(db.pyeong_to_area.data)[0]}평 ~ {Object.keys(db.pyeong_to_area.data).slice(-1)[0]}평
            </p>
          </div>
        </div>
      </div>

      {/* 퀵 링크 */}
      <h3 className="font-semibold text-gray-800 mb-3">관리 메뉴</h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-2">단가 관리</h3>
          <p className="text-sm text-gray-400 mb-3">
            {stats.processCount}개 공정, {stats.totalOptions}개 옵션의 단가를 확인합니다.
          </p>
          <a href="/admin/pricing" className="text-sm text-gold hover:text-brown transition-colors">관리하기 →</a>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-2">배너 광고</h3>
          <p className="text-sm text-gray-400 mb-3">파트너 배너를 등록하고 노출을 관리합니다.</p>
          <a href="/admin/banners" className="text-sm text-gold hover:text-brown transition-colors">관리하기 →</a>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-2">파트너 관리</h3>
          <p className="text-sm text-gray-400 mb-3">제휴 업체 정보를 등록하고 엑셀 시트에 반영합니다.</p>
          <a href="/admin/partners" className="text-sm text-gold hover:text-brown transition-colors">관리하기 →</a>
        </div>
        <div className="bg-white rounded-xl p-6 border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-2">사이트 설정</h3>
          <p className="text-sm text-gray-400 mb-3">카피, SEO, 사업자 정보 등을 수정합니다.</p>
          <a href="/admin/settings" className="text-sm text-gold hover:text-brown transition-colors">관리하기 →</a>
        </div>
      </div>
    </div>
  );
}
