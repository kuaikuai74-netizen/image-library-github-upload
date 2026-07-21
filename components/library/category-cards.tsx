"use client";

import type { CategoryListItem } from "@/lib/library/contracts";

type CategoryCardsProps = {
  categories: CategoryListItem[];
  activeCategory: string;
  onChange: (categoryId: string) => void;
};

export function CategoryCards({ categories, activeCategory, onChange }: CategoryCardsProps) {
  return (
    <section className="page-section" aria-labelledby="category-heading">
      <div className="section-heading">
        <div>
          <p>二级导航</p>
          <h2 id="category-heading">选择品类</h2>
        </div>
        <span>{categories.length} 个品类</span>
      </div>
      <div className="category-scroller">
        {categories.map((category) => {
          const active = category.id === activeCategory;
          return (
            <button
              className={active ? "category-card is-active" : "category-card"}
              key={category.id}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(category.id)}
            >
              <span className={`category-thumb slot-${category.previewSlot}`} aria-hidden="true" />
              <span>
                <strong>{category.name}</strong>
                <small>{category.assetGroupCount} 个素材组 · {category.assetCount} 张</small>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
