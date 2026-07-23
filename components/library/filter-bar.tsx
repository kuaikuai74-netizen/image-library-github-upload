"use client";

import { RotateCcw, Search } from "lucide-react";
import { useEffect, useRef } from "react";
import { assetTypeOptions, countryOptions } from "@/lib/library/countries";

export type Filters = {
  country: string;
  assetType: string;
  color: string;
  query: string;
};

type FilterBarProps = {
  filters: Filters;
  colors: string[];
  onChange: (filters: Filters) => void;
  onClear: () => void;
};

export function FilterBar({ filters, colors, onChange, onClear }: FilterBarProps) {
  const { country, assetType, color, query } = filters;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryTimeoutRef = useRef<number | undefined>(undefined);
  const currentQuery = () => searchInputRef.current?.value ?? query;
  const update = (field: keyof Filters, value: string) => onChange({ country, assetType, color, query: currentQuery(), [field]: value });

  useEffect(() => {
    return () => window.clearTimeout(queryTimeoutRef.current);
  }, []);

  function scheduleQueryChange(value: string) {
    window.clearTimeout(queryTimeoutRef.current);
    queryTimeoutRef.current = window.setTimeout(() => onChange({ country, assetType, color, query: value }), 450);
  }

  function commitQueryChange(value: string) {
    window.clearTimeout(queryTimeoutRef.current);
    onChange({ country, assetType, color, query: value });
  }

  return (
    <section className="page-section" aria-labelledby="filter-heading">
      <div className="section-heading">
        <div>
          <p>精确筛选</p>
          <h2 id="filter-heading">定位素材</h2>
        </div>
        <span>筛选仅作用于当前渠道和品类</span>
      </div>
      <div className="filter-toolbar">
        <label>
          <span>国家</span>
          <select value={country} onChange={(event) => update("country", event.target.value)}>
            <option value="all">全部国家</option>
            {countryOptions.map((country) => <option key={country.code} value={country.code}>{country.name}</option>)}
          </select>
        </label>
        <label>
          <span>图片类型</span>
          <select value={assetType} onChange={(event) => update("assetType", event.target.value)}>
            <option value="all">全部素材</option>
            {assetTypeOptions.map((assetType) => <option key={assetType}>{assetType}</option>)}
          </select>
        </label>
        <label>
          <span>其他</span>
          <select value={color} onChange={(event) => update("color", event.target.value)}>
            <option value="all">全部其他</option>
            {colors.map((color) => <option key={color} value={color}>{color}</option>)}
          </select>
        </label>
        <label className="filter-search">
          <span>SPU 或文件名</span>
          <span className="input-with-icon">
            <Search aria-hidden="true" />
            <input
              key={query}
              ref={searchInputRef}
              defaultValue={query}
              onChange={(event) => scheduleQueryChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") commitQueryChange(event.currentTarget.value);
              }}
              placeholder="搜索 SPU 或文件名"
            />
          </span>
        </label>
        <button className="clear-button" type="button" onClick={onClear}>
          <RotateCcw aria-hidden="true" />
          清除筛选
        </button>
      </div>
    </section>
  );
}
