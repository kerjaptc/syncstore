'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent } from '@/components/ui/card';
import { LoadingSpinner } from '@/components/ui/loading-spinner';

/**
 * Category grid for browsing products by category
 */
export function CategoryGrid() {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch('/api/storefront/categories');
        if (!response.ok) {
          throw new Error('Failed to fetch categories');
        }
        const categoryList = await response.json();
        setCategories(categoryList.slice(0, 6)); // Show first 6 categories
      } catch (error) {
        console.error('Error loading categories:', error);
      } finally {
        setLoading(false);
      }
    };

    loadCategories();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <LoadingSpinner />
      </div>
    );
  }

  if (categories.length === 0) {
    return null;
  }

  return (
    <section className="py-12">
      <div className="mb-8">
        <h2 className="text-3xl font-bold text-center mb-4">Shop by Category</h2>
        <p className="text-muted-foreground text-center max-w-2xl mx-auto">
          Browse our wide selection of products organized by category to find exactly what you&apos;re looking for.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {categories.map((category) => (
          <Link key={category} href={`/store/products?category=${encodeURIComponent(category)}`}>
            <Card className="group hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6 text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-primary/20 transition-colors">
                  <span className="text-2xl">
                    {getCategoryIcon(category)}
                  </span>
                </div>
                <h3 className="font-semibold text-sm group-hover:text-primary transition-colors">
                  {category}
                </h3>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="text-center mt-8">
        <Link 
          href="/store/products" 
          className="text-primary hover:underline font-medium"
        >
          View All Categories →
        </Link>
      </div>
    </section>
  );
}

/**
 * Get icon for category (simple emoji mapping)
 */
function getCategoryIcon(category: string): string {
  const iconMap: Record<string, string> = {
    'Electronics': '📱',
    'Clothing': '👕',
    'Home & Garden': '🏠',
    'Sports': '⚽',
    'Books': '📚',
    'Beauty': '💄',
    'Toys': '🧸',
    'Food': '🍎',
    'Health': '💊',
    'Automotive': '🚗',
  };

  return iconMap[category] || '📦';
}